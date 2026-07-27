import type { FastifyInstance } from 'fastify';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import {
	deleteIndexedProject,
	listIndexedProjects,
	ProjectIndexingRecipeCatalog,
	ProjectInspectionService,
	ProjectRetrievalTargetService,
	ProjectSearchService,
	ProviderProfileService,
} from 'the-blue-scribes';

import type {
	BootstrapResponse,
	IndexProjectInput,
	ProfileInput,
	ProfileIndexingRules,
	ProviderProfile,
	ProjectSummary,
	SearchInput,
} from '../../shared/contracts.js';
import { IndexingJobRegistry } from '../modules/jobs/indexing-job-registry.js';
import { ProfileIndexingRulesCatalog } from '../modules/profiles/profile-indexing-rules-catalog.js';
import { boolean, integer, record, stringList, text } from '../shared/values.js';

export interface ApiRoutesOptions {
	jobs: IndexingJobRegistry;
}

export async function registerApiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
	const profiles = new ProviderProfileService({
		...(process.env.LM_STUDIO_API_KEY === undefined ? {} : { apiKey: process.env.LM_STUDIO_API_KEY }),
	});
	const profileIndexingRules = new ProfileIndexingRulesCatalog();
	const targets = new ProjectRetrievalTargetService();
	const recipes = new ProjectIndexingRecipeCatalog();
	const search = new ProjectSearchService({
		...(process.env.LM_STUDIO_API_KEY === undefined ? {} : { apiKey: process.env.LM_STUDIO_API_KEY }),
	});
	const inspection = new ProjectInspectionService();

	app.get('/api/health', async () => ({
		status: 'ready',
		service: 'the-blue-scribes-ui',
	}));

	app.get('/api/bootstrap', async (): Promise<BootstrapResponse> => ({
		profiles: await enrichedProfiles(),
		projects: await projectSummaries(),
		jobs: options.jobs.list(),
		environment: {
			mcpCommand: await executablePath('scribes-mcp'),
		},
	}));

	app.get('/api/profiles', async () => {
		const items = await enrichedProfiles();
		return { count: items.length, profiles: items };
	});

	app.get('/api/models', async (request) => {
		const query = record(request.query, 'query');
		const baseUrl = text(query.baseUrl, 'baseUrl', { optional: true });
		const models = await profiles.listLmStudioModels(baseUrl);
		return { count: models.length, models };
	});

	app.post('/api/models/inspect', async (request) => {
		const body = record(request.body);
		return profiles.inspectLmStudioEmbeddingModel(
			text(body.model, 'model')!,
			text(body.baseUrl, 'baseUrl', { optional: true }),
			typeof body.embeddingSuffix === 'string' ? body.embeddingSuffix : undefined,
		);
	});

	app.post('/api/profiles', async (request) => {
		const input = profileInput(request.body);
		const dimensions =
			input.detectDimensions === true
				? (await profiles.inspectLmStudioEmbeddingModel(input.model, input.baseUrl, input.embeddingSuffix)).dimensions
				: input.dimensions;
		if (dimensions === undefined) {
			throw new Error('Dimensions are required when automatic detection is disabled');
		}
		const saved = await profiles.set({
			name: input.name,
			embedding: {
				provider: 'lm-studio',
				model: input.model,
				dimensions,
				...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
				...(input.maximumInputs === undefined ? {} : { maximumInputs: input.maximumInputs }),
				...(input.embeddingSuffix === undefined ? {} : { embeddingSuffix: input.embeddingSuffix }),
			},
			...(input.rerankingModel === undefined
				? {}
				: {
						reranking: {
							provider: 'lm-studio-qwen3' as const,
							model: input.rerankingModel,
							...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
							...(input.rerankingInstruction === undefined ? {} : { instruction: input.rerankingInstruction }),
						},
					}),
		});
		await profileIndexingRules.set(input.name, indexingRules(input));
		return enrichProfile(saved);
	});

	app.post('/api/profiles/:name/test', async (request) => {
		const params = record(request.params, 'parameters');
		return profiles.diagnose(text(params.name, 'profile')!);
	});

	app.delete('/api/profiles/:name', async (request) => {
		const params = record(request.params, 'parameters');
		const name = text(params.name, 'profile')!;
		const removed = await profiles.remove(name);
		await profileIndexingRules.remove(name);
		return removed;
	});

	app.post('/api/indexing-jobs', async (request, reply) => {
		const input = indexProjectInput(request.body);
		const rules = await profileIndexingRules.read(input.profile);
		const job = options.jobs.startIndex({ ...input, ...rules });
		return reply.code(202).send(job);
	});

	app.get('/api/indexing-jobs', async () => ({
		jobs: options.jobs.list(),
	}));

	app.get('/api/indexing-jobs/:id', async (request) => {
		const params = record(request.params, 'parameters');
		return options.jobs.get(text(params.id, 'job')!);
	});

	app.delete('/api/indexing-jobs/:id', async (request) => {
		const params = record(request.params, 'parameters');
		return options.jobs.cancel(text(params.id, 'job')!);
	});

	app.get('/api/indexing-jobs/:id/events', async (request, reply) => {
		const params = record(request.params, 'parameters');
		const id = text(params.id, 'job')!;
		reply.hijack();
		reply.raw.writeHead(200, {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no',
		});
		const send = (event: unknown) => {
			reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
		};
		let closed = false;
		const heartbeat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);
		const unsubscribe = options.jobs.subscribe(id, (event) => {
			if (!closed) {
				send(event);
				const job = options.jobs.get(id);
				if (job.status !== 'running' && job.status !== 'queued' && job.status !== 'cancelling') {
					close();
				}
			}
		});
		function close(): void {
			if (closed) {
				return;
			}
			closed = true;
			clearInterval(heartbeat);
			unsubscribe();
			reply.raw.end();
		}
		request.raw.on('close', close);
		for (const event of options.jobs.events(id)) {
			if (closed) {
				break;
			}
			send(event);
		}
		const job = options.jobs.get(id);
		if (job.status !== 'running' && job.status !== 'queued' && job.status !== 'cancelling') {
			close();
			return;
		}
	});

	app.post('/api/projects/:id/reindex', async (request, reply) => {
		const params = record(request.params, 'parameters');
		const id = text(params.id, 'project')!;
		const project = (await listIndexedProjects()).find(({ projectIdentifier }) => projectIdentifier === id);
		if (project === undefined) {
			throw new Error(`Indexed project ${id} was not found`);
		}
		const job = options.jobs.startReindex(id, project.root ?? id);
		return reply.code(202).send(job);
	});

	app.post('/api/projects/:id/search', async (request) => {
		const params = record(request.params, 'parameters');
		const id = text(params.id, 'project')!;
		const input = searchInput(request.body);
		const recipe = await recipes.read(id);
		const profile = input.profile ?? (recipe?.provider.type === 'profile' ? recipe.provider.profile : undefined);
		return search.search({
			projectReference: id,
			query: input.query,
			...(profile === undefined ? {} : { profile }),
			...(input.limit === undefined ? {} : { limit: input.limit }),
			...(input.language === undefined ? {} : { language: input.language }),
			...(input.contextBefore === undefined && input.contextAfter === undefined && input.contextCharacters === undefined
				? {}
				: {
						context: {
							...(input.contextBefore === undefined ? {} : { beforeChunks: input.contextBefore }),
							...(input.contextAfter === undefined ? {} : { afterChunks: input.contextAfter }),
							...(input.contextCharacters === undefined ? {} : { maximumCharacters: input.contextCharacters }),
						},
					}),
			...(input.reranking === undefined && input.rerankCandidates === undefined
				? {}
				: {
						reranking: {
							...(input.reranking === undefined ? {} : { enabled: input.reranking }),
							...(input.rerankCandidates === undefined ? {} : { candidateLimit: input.rerankCandidates }),
						},
					}),
		});
	});

	app.get('/api/projects/:id/chunks', async (request) => {
		const params = record(request.params, 'parameters');
		const query = record(request.query, 'query');
		return inspection.chunks({
			projectReference: text(params.id, 'project')!,
			path: text(query.path, 'path')!,
		});
	});

	app.post('/api/projects/:id/targets/:target/activate', async (request) => {
		const params = record(request.params, 'parameters');
		return targets.switchTarget(text(params.id, 'project')!, text(params.target, 'target')!);
	});

	app.post('/api/projects/:id/targets/:target/rename', async (request) => {
		const params = record(request.params, 'parameters');
		const body = record(request.body);
		return targets.renameTarget(
			text(params.id, 'project')!,
			text(params.target, 'target')!,
			text(body.name, 'new target')!,
		);
	});

	app.delete('/api/projects/:id', async (request) => {
		const params = record(request.params, 'parameters');
		return deleteIndexedProject(text(params.id, 'project')!);
	});

	async function projectSummaries(): Promise<ProjectSummary[]> {
		const projects = await listIndexedProjects();
		return Promise.all(
			projects.map(async (project): Promise<ProjectSummary> => {
				try {
					const targetState = (await targets.list(project.projectIdentifier)) as {
						active?: ProjectSummary['active'];
						targets: ProjectSummary['targets'];
					};
					const recipe = await recipes.read(project.projectIdentifier);
					return {
						...project,
						active: targetState.active ?? null,
						targets: targetState.targets,
						...(recipe === undefined ? {} : { recipe }),
					};
				} catch (error: unknown) {
					return {
						...project,
						active: null,
						targets: [],
						error: error instanceof Error ? error.message : String(error),
					};
				}
			}),
		);
	}

	async function enrichedProfiles(): Promise<ProviderProfile[]> {
		const items = await profiles.list();
		return Promise.all(items.map(enrichProfile));
	}

	async function enrichProfile(profile: Omit<ProviderProfile, 'indexing'>): Promise<ProviderProfile> {
		const indexing = await profileIndexingRules.read(profile.name);
		return {
			...profile,
			...(indexing.include === undefined && indexing.exclude === undefined && indexing.windows1251 !== true
				? {}
				: { indexing }),
		};
	}
}

async function executablePath(name: string): Promise<string> {
	for (const directory of (process.env.PATH ?? '').split(delimiter)) {
		if (directory.length === 0) {
			continue;
		}
		const candidate = join(directory, name);
		try {
			await access(candidate, constants.X_OK);
			return candidate;
		} catch {
			// Continue through PATH just like a shell would.
		}
	}
	return name;
}

function profileInput(value: unknown): ProfileInput {
	const body = record(value);
	return {
		name: text(body.name, 'name')!,
		model: text(body.model, 'model')!,
		...(integer(body.dimensions, 'dimensions', {
			optional: true,
			minimum: 1,
		}) === undefined
			? {}
			: {
					dimensions: integer(body.dimensions, 'dimensions', { minimum: 1 })!,
				}),
		...(boolean(body.detectDimensions, 'detectDimensions', {
			optional: true,
		}) === undefined
			? {}
			: {
					detectDimensions: boolean(body.detectDimensions, 'detectDimensions')!,
				}),
		...(text(body.baseUrl, 'baseUrl', { optional: true }) === undefined
			? {}
			: { baseUrl: text(body.baseUrl, 'baseUrl')! }),
		...(integer(body.maximumInputs, 'maximumInputs', {
			optional: true,
			minimum: 1,
		}) === undefined
			? {}
			: {
					maximumInputs: integer(body.maximumInputs, 'maximumInputs', {
						minimum: 1,
					})!,
				}),
		...(typeof body.embeddingSuffix === 'string' ? { embeddingSuffix: body.embeddingSuffix } : {}),
		...(text(body.rerankingModel, 'rerankingModel', { optional: true }) === undefined
			? {}
			: { rerankingModel: text(body.rerankingModel, 'rerankingModel')! }),
		...(text(body.rerankingInstruction, 'rerankingInstruction', {
			optional: true,
		}) === undefined
			? {}
			: {
					rerankingInstruction: text(body.rerankingInstruction, 'rerankingInstruction')!,
				}),
		...(stringList(body.include, 'include') === undefined ? {} : { include: stringList(body.include, 'include')! }),
		...(stringList(body.exclude, 'exclude') === undefined ? {} : { exclude: stringList(body.exclude, 'exclude')! }),
		...(boolean(body.windows1251, 'windows1251', { optional: true }) === undefined
			? {}
			: { windows1251: boolean(body.windows1251, 'windows1251')! }),
	};
}

function indexingRules(input: ProfileInput): ProfileIndexingRules {
	return {
		...(input.include === undefined ? {} : { include: input.include }),
		...(input.exclude === undefined ? {} : { exclude: input.exclude }),
		...(input.windows1251 === true ? { windows1251: true } : {}),
	};
}

function indexProjectInput(value: unknown): IndexProjectInput {
	const body = record(value);
	return {
		root: text(body.root, 'root')!,
		profile: text(body.profile, 'profile')!,
		...(text(body.target, 'target', { optional: true }) === undefined ? {} : { target: text(body.target, 'target')! }),
		keepReplacedBuilds: integer(body.keepReplacedBuilds ?? 1, 'keepReplacedBuilds', { minimum: 0 })!,
		...(boolean(body.allowDirty, 'allowDirty', { optional: true }) === undefined
			? {}
			: { allowDirty: boolean(body.allowDirty, 'allowDirty')! }),
		...(integer(body.maximumChunkSize, 'maximumChunkSize', {
			optional: true,
			minimum: 1,
		}) === undefined
			? {}
			: {
					maximumChunkSize: integer(body.maximumChunkSize, 'maximumChunkSize', {
						minimum: 1,
					})!,
				}),
	};
}

function searchInput(value: unknown): SearchInput {
	const body = record(value);
	return {
		query: text(body.query, 'query')!,
		...(text(body.profile, 'profile', { optional: true }) === undefined
			? {}
			: { profile: text(body.profile, 'profile')! }),
		...(integer(body.limit, 'limit', { optional: true, minimum: 1 }) === undefined
			? {}
			: { limit: integer(body.limit, 'limit', { minimum: 1 })! }),
		...(text(body.language, 'language', { optional: true }) === undefined
			? {}
			: { language: text(body.language, 'language')! }),
		...(integer(body.contextBefore, 'contextBefore', {
			optional: true,
			minimum: 0,
		}) === undefined
			? {}
			: { contextBefore: integer(body.contextBefore, 'contextBefore')! }),
		...(integer(body.contextAfter, 'contextAfter', {
			optional: true,
			minimum: 0,
		}) === undefined
			? {}
			: { contextAfter: integer(body.contextAfter, 'contextAfter')! }),
		...(integer(body.contextCharacters, 'contextCharacters', {
			optional: true,
			minimum: 1,
		}) === undefined
			? {}
			: {
					contextCharacters: integer(body.contextCharacters, 'contextCharacters', { minimum: 1 })!,
				}),
		...(boolean(body.reranking, 'reranking', { optional: true }) === undefined
			? {}
			: { reranking: boolean(body.reranking, 'reranking')! }),
		...(integer(body.rerankCandidates, 'rerankCandidates', {
			optional: true,
			minimum: 1,
		}) === undefined
			? {}
			: {
					rerankCandidates: integer(body.rerankCandidates, 'rerankCandidates', {
						minimum: 1,
					})!,
				}),
	};
}
