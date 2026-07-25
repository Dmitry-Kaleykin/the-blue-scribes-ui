import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { FastifyInstance } from 'fastify';

import { createApp } from './app.js';

describe('local UI server boundary', () => {
	let app: FastifyInstance;

	before(async () => {
		app = await createApp({ development: true });
	});

	after(async () => {
		await app.close();
	});

	it('serves its health endpoint to a loopback host', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/api/health',
			headers: { host: '127.0.0.1:43110' },
		});

		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json(), {
			status: 'ready',
			service: 'the-blue-scribes-ui',
		});
	});

	it('rejects non-loopback host headers', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/api/health',
			headers: { host: 'example.test' },
		});

		assert.equal(response.statusCode, 403);
		assert.match(response.body, /loopback requests only/u);
	});

	it('rejects cross-origin mutation attempts', async () => {
		const response = await app.inject({
			method: 'GET',
			url: '/api/health',
			headers: {
				host: 'localhost:43110',
				origin: 'https://example.test',
			},
		});

		assert.equal(response.statusCode, 403);
		assert.match(response.body, /Cross-origin requests are not allowed/u);
	});
});
