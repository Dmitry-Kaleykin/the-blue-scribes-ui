import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type ProjectIndexingEvent, ProjectIndexingService, type ProjectIndexingOutcome } from 'the-blue-scribes';

import { IndexingJobRegistry } from './indexing-job-registry.js';

type IndexOptions = Parameters<ProjectIndexingService['index']>[0];

describe('IndexingJobRegistry', () => {
	it('passes profile file rules to the indexing service', () => {
		let options: IndexOptions | undefined;
		const service = {
			index(input: IndexOptions): Promise<ProjectIndexingOutcome> {
				options = input;
				return new Promise(() => {});
			},
		} as unknown as ProjectIndexingService;
		const jobs = new IndexingJobRegistry({ indexingService: service });

		jobs.startIndex({
			...input,
			include: ['src/**', 'docs/**'],
			exclude: ['dist/**'],
		});

		assert.deepEqual(options?.include, ['src/**', 'docs/**']);
		assert.deepEqual(options?.exclude, ['dist/**']);
	});

	it('includes the current job snapshot in progress events', () => {
		let options: IndexOptions | undefined;
		const service = {
			index(input: IndexOptions): Promise<ProjectIndexingOutcome> {
				options = input;
				return new Promise(() => {});
			},
		} as unknown as ProjectIndexingService;
		const jobs = new IndexingJobRegistry({ indexingService: service });
		const job = jobs.startIndex(input);
		const events: unknown[] = [];
		jobs.subscribe(job.id, (event) => events.push(event));

		options!.onEvent!({
			type: 'indexing-progress',
			progress: {
				phase: 'generating-embeddings',
				completed: 2,
				total: 4,
				currentPath: 'src/example.ts',
			},
		} as ProjectIndexingEvent);

		assert.equal(jobs.get(job.id).progress?.completed, 2);
		assert.deepEqual(events.at(-1), {
			type: 'indexing-progress',
			progress: {
				phase: 'generating-embeddings',
				completed: 2,
				total: 4,
				currentPath: 'src/example.ts',
			},
			job: {
				...jobs.get(job.id),
			},
		});
	});

	it('publishes cancellation before running synchronous abort listeners', async () => {
		let options: IndexOptions | undefined;
		let aborted = false;
		const service = {
			index(input: IndexOptions): Promise<ProjectIndexingOutcome> {
				options = input;
				return new Promise((_resolve, reject) => {
					input.signal?.addEventListener('abort', () => {
						aborted = true;
						reject(input.signal?.reason);
					});
				});
			},
		} as unknown as ProjectIndexingService;
		const jobs = new IndexingJobRegistry({ indexingService: service });
		const job = jobs.startIndex(input);

		const cancelled = jobs.cancel(job.id);

		assert.equal(cancelled.status, 'cancelling');
		assert.equal(aborted, false);
		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.equal(options!.signal?.aborted, true);
		assert.equal(aborted, true);
		assert.equal(jobs.get(job.id).status, 'cancelled');
	});
});

const input = {
	root: '/tmp/example',
	profile: 'local',
	keepReplacedBuilds: 1,
};
