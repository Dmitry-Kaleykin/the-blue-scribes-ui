import staticPlugin from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { IndexingJobRegistry } from './modules/jobs/indexing-job-registry.js';
import { registerApiRoutes } from './routes/api-routes.js';
import { serializeError } from './shared/serialize-error.js';

export interface CreateAppOptions {
	development?: boolean;
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
	const app = Fastify({ logger: false });
	const jobs = new IndexingJobRegistry();

	app.addHook('onRequest', async (request, reply) => {
		const host = request.headers.host ?? '';
		if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/u.test(host)) {
			return reply.code(403).send({
				error: { message: 'The local UI accepts loopback requests only' },
			});
		}
		const origin = request.headers.origin;
		if (origin !== undefined && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(origin)) {
			return reply.code(403).send({
				error: { message: 'Cross-origin requests are not allowed' },
			});
		}
	});

	app.setErrorHandler((error, _request, reply) => {
		const failure = serializeError(error);
		void reply.code(statusFor(error)).send({
			error: {
				message: failure.message,
				...(failure.code === undefined ? {} : { code: failure.code }),
				...(failure.details === undefined ? {} : { details: failure.details }),
			},
		});
	});

	await registerApiRoutes(app, { jobs });

	if (options.development !== true) {
		const clientRoot = [
			fileURLToPath(new URL('../dist', import.meta.url)),
			fileURLToPath(new URL('../../dist', import.meta.url)),
		].find(existsSync);
		if (clientRoot === undefined) {
			throw new Error('The UI client is not built; run npm run build first');
		}
		await app.register(staticPlugin, {
			root: clientRoot,
			wildcard: false,
		});
		app.setNotFoundHandler((request, reply) => {
			if (request.url.startsWith('/api/')) {
				return reply.code(404).send({
					error: { message: 'API route was not found' },
				});
			}
			return reply.sendFile('index.html');
		});
	}

	return app;
}

function statusFor(error: unknown): number {
	const message = error instanceof Error ? error.message : String(error);
	if (/was not found|no saved indexing recipe/u.test(message)) {
		return 404;
	}
	if (/already running|already exists/u.test(message)) {
		return 409;
	}
	return 400;
}
