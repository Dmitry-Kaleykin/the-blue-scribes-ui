import type { FastifyInstance } from 'fastify';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import {
	deleteIndexedProject,
	IndexingPresetService,
	listIndexedProjects,
	ProjectIndexingRecipeCatalog,
	ProjectInspectionService,
	ProjectRetrievalTargetService,
	ProjectSearchService,
	ProviderProfileService,
	SqliteStorageProvider,
} from 'the-blue-scribes';

import type {
	BootstrapResponse,
	IndexProjectInput,
	IndexingPresetInput,
	ProfileInput,
	ProjectSummary,
	SearchInput,
} from '../../shared/contracts.js';
import { IndexingJobRegistry } from '../modules/jobs/indexing-job-registry.js';
import { LegacyProfileIndexingRulesCatalog } from '../modules/presets/legacy-profile-indexing-rules-catalog.js';
import { boolean, integer, record, stringList, text } from '../shared/values.js';

export interface ApiRoutesOptions {
	jobs: IndexingJobRegistry;
}

export async function registerApiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
	const profiles = new ProviderProfileService({
		...(process.env.LM_STUDIO_API_KEY === undefined ? {} : { apiKey: process.env.LM_STUDIO_API_KEY }),
	});
	const presets = new IndexingPresetService();
	const profileIndexingRules = new LegacyProfileIndexingRulesCatalog();
	const targets = new ProjectRetrievalTargetService();
	const recipes = new ProjectIndexingRecipeCatalog();
	const search = new ProjectSearchService({
		...(process.env.LM_STUDIO_API_KEY === undefined ? {} : { apiKey: process.env.LM_STUDIO_API_KEY }),
	});
	const inspection = new ProjectInspectionService();
	let legacyMigration: Promise<void> | undefined;

	app.get('/api/health', async () => ({
		status: 'ready',
		service: 'the-blue-scribes-ui',
	}));

	app.get('/api/bootstrap', async (): Promise<BootstrapResponse> => {
		legacyMigration ??= migrateLegacyProfileRules();
		await legacyMigration;
		return {
			profiles: await profiles.list(),
			presets: await presets.list(),
			projects: await projectSummaries(),
			jobs: options.jobs.list(),
			environment: {
				mcpCommand: await executablePath('scribes-mcp'),
			},
		};
	});

	app.get('/api/profiles', async () => {
		const items = await profiles.list();
		return { count: items.length, profiles: items };
	});

	app.get('/api/presets', async () => {
		const items = await presets.list();
		return { count: items.length, presets: items };
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
		return saved;
	});

	app.post('/api/profiles/:name/test', async (request) => {
		const params = record(request.params, 'parameters');
		return profiles.diagnose(text(params.name, 'profile')!);
	});

	app.delete('/api/profiles/:name', async (request) => {
		const params = record(request.params, 'parameters');
		const name = text(params.name, 'profile')!;
		const references = (await presets.list())
			.filter(({ providerProfile }) => providerProfile === name)
			.map(({ name: preset }) => preset);
		if (references.length > 0) {
			throw new Error(`Provider profile ${name} is used by indexing preset(s): ${references.join(', ')}`);
		}
		return profiles.remove(name);
	});

	app.post('/api/presets', async (request) => {
		return presets.set(indexingPresetInput(request.body));
	});

	app.delete('/api/presets/:name', async (request) => {
		const params = record(request.params, 'parameters');
		return presets.remove(text(params.name, 'preset')!);
	});

	app.post('/api/indexing-jobs', async (request, reply) => {
		const input = indexProjectInput(request.body);
		const preset = await presets.get(input.preset);
		const job = options.jobs.startIndex({
			root: input.root,
			profile: preset.providerProfile,
			...(input.target === undefined ? {} : { target: input.target }),
			keepReplacedBuilds: input.keepReplacedBuilds,
			...(input.allowDirty === true ? { allowDirty: true } : {}),
			...(preset.maximumChunkSize === undefined ? {} : { maximumChunkSize: preset.maximumChunkSize }),
			...(preset.windows1251 === undefined ? {} : { windows1251: preset.windows1251 }),
			...(preset.include === undefined ? {} : { include: preset.include }),
			...(preset.exclude === undefined ? {} : { exclude: preset.exclude }),
		});
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

	app.delete('/api/index-builds/:id', async (request) => {
		const params = record(request.params, 'parameters');
		const id = text(params.id, 'index build')!;
		const projects = await listIndexedProjects();

		for (const project of projects) {
			const active = options.jobs
				.list()
				.some(
					(job) =>
						(job.status === 'running' || job.status === 'queued' || job.status === 'cancelling') &&
						(job.projectKey === project.projectIdentifier || job.projectKey === project.root),
				);
			if (active) {
				continue;
			}

			const storage = new SqliteStorageProvider(project.databasePath);
			try {
				const build = (await storage.listBuilds()).find(({ indexBuildId }) => indexBuildId === id);
				if (build === undefined) {
					continue;
				}
				if (build.status === 'ready') {
					throw new Error(`Ready index build ${id} cannot be removed as an interrupted build`);
				}
				await storage.deleteBuild(id);
				return {
					indexBuildId: id,
					previousStatus: build.status,
					projectIdentifier: project.projectIdentifier,
				};
			} finally {
				await storage.close();
			}
		}

		throw new Error(`Interrupted index build ${id} was not found or still has an active indexing job`);
	});

	app.delete('/api/projects/:id/interrupted-builds', async (request) => {
		const params = record(request.params, 'parameters');
		const id = text(params.id, 'project')!;
		const project = (await listIndexedProjects()).find(({ projectIdentifier }) => projectIdentifier === id);
		if (project === undefined) {
			throw new Error(`Indexed project ${id} was not found`);
		}
		const active = options.jobs
			.list()
			.some(
				(job) =>
					(job.status === 'running' || job.status === 'queued' || job.status === 'cancelling') &&
					(job.projectKey === project.projectIdentifier || job.projectKey === project.root),
			);
		if (active) {
			throw new Error(`An indexing job is still active for ${project.root ?? project.projectIdentifier}`);
		}

		const storage = new SqliteStorageProvider(project.databasePath);
		try {
			const interrupted = (await storage.listBuilds()).filter(({ status }) => status === 'building');
			for (const build of interrupted) {
				await storage.deleteBuild(build.indexBuildId);
			}
			return {
				projectIdentifier: project.projectIdentifier,
				count: interrupted.length,
				indexBuildIds: interrupted.map(({ indexBuildId }) => indexBuildId),
			};
		} finally {
			await storage.close();
		}
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

	async function migrateLegacyProfileRules(): Promise<void> {
		const existingPresets = new Set((await presets.list()).map(({ name }) => name));
		for (const profile of await profiles.list()) {
			const rules = await profileIndexingRules.read(profile.name);
			const hasRules = rules.include !== undefined || rules.exclude !== undefined || rules.windows1251 === true;
			if (!hasRules) {
				continue;
			}
			if (!existingPresets.has(profile.name)) {
				await presets.set({
					name: profile.name,
					providerProfile: profile.name,
					...rules,
				});
				existingPresets.add(profile.name);
			}
			await profileIndexingRules.remove(profile.name);
		}
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
	};
}

function indexingPresetInput(value: unknown): IndexingPresetInput {
	const body = record(value);
	return {
		name: text(body.name, 'name')!,
		providerProfile: text(body.providerProfile, 'providerProfile')!,
		...(integer(body.maximumChunkSize, 'maximumChunkSize', { optional: true, minimum: 1 }) === undefined
			? {}
			: { maximumChunkSize: integer(body.maximumChunkSize, 'maximumChunkSize', { minimum: 1 })! }),
		...(stringList(body.include, 'include') === undefined ? {} : { include: stringList(body.include, 'include')! }),
		...(stringList(body.exclude, 'exclude') === undefined ? {} : { exclude: stringList(body.exclude, 'exclude')! }),
		...(boolean(body.windows1251, 'windows1251', { optional: true }) === undefined
			? {}
			: { windows1251: boolean(body.windows1251, 'windows1251')! }),
	};
}

function indexProjectInput(value: unknown): IndexProjectInput {
	const body = record(value);
	return {
		root: text(body.root, 'root')!,
		preset: text(body.preset, 'preset')!,
		...(text(body.target, 'target', { optional: true }) === undefined ? {} : { target: text(body.target, 'target')! }),
		keepReplacedBuilds: integer(body.keepReplacedBuilds ?? 1, 'keepReplacedBuilds', { minimum: 0 })!,
		...(boolean(body.allowDirty, 'allowDirty', { optional: true }) === undefined
			? {}
			: { allowDirty: boolean(body.allowDirty, 'allowDirty')! }),
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
