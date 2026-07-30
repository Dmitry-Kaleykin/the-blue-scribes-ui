import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { LegacyProfileIndexingRulesCatalog } from './legacy-profile-indexing-rules-catalog.js';

describe('LegacyProfileIndexingRulesCatalog', () => {
	it('persists and removes profile-specific file rules', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'scribes-profile-rules-'));
		const path = join(directory, 'rules.json');
		const catalog = new LegacyProfileIndexingRulesCatalog({ path });

		assert.deepEqual(await catalog.read('local'), {});

		await catalog.set('local', {
			include: ['src/**', 'docs/**'],
			exclude: ['dist/**'],
			windows1251: true,
		});

		const reloaded = new LegacyProfileIndexingRulesCatalog({ path });
		assert.deepEqual(await reloaded.read('local'), {
			include: ['src/**', 'docs/**'],
			exclude: ['dist/**'],
			windows1251: true,
		});
		assert.match(await readFile(path, 'utf8'), /"schemaVersion": 1/u);

		await reloaded.remove('local');
		assert.deepEqual(await reloaded.read('local'), {});
	});

	it('does not keep empty rule entries', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'scribes-profile-rules-'));
		const path = join(directory, 'rules.json');
		const catalog = new LegacyProfileIndexingRulesCatalog({ path });

		await catalog.set('local', {});

		const stored = JSON.parse(await readFile(path, 'utf8')) as { profiles: Record<string, unknown> };
		assert.deepEqual(stored.profiles, {});
	});

	it('does not keep a disabled encoding fallback by itself', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'scribes-profile-rules-'));
		const path = join(directory, 'rules.json');
		const catalog = new LegacyProfileIndexingRulesCatalog({ path });

		await catalog.set('local', { windows1251: false });

		assert.deepEqual(await catalog.read('local'), {});
	});

	it('treats profile names as data rather than object properties', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'scribes-profile-rules-'));
		const path = join(directory, 'rules.json');
		const catalog = new LegacyProfileIndexingRulesCatalog({ path });

		await catalog.set('__proto__', { exclude: ['generated/**'] });

		assert.deepEqual(await catalog.read('__proto__'), { exclude: ['generated/**'] });
	});
});
