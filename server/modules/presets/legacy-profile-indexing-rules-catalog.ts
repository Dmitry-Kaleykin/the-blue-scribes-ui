import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface LegacyProfileIndexingRules {
	include?: readonly string[];
	exclude?: readonly string[];
	windows1251?: boolean;
}

interface StoredProfileIndexingRules {
	schemaVersion: 1;
	profiles: Record<string, LegacyProfileIndexingRules>;
}

export interface LegacyProfileIndexingRulesCatalogOptions {
	path?: string;
}

export class LegacyProfileIndexingRulesCatalog {
	readonly #path: string;
	#pendingMutation: Promise<void> = Promise.resolve();

	constructor(options: LegacyProfileIndexingRulesCatalogOptions = {}) {
		this.#path = options.path ?? defaultPath();
	}

	async read(profile: string): Promise<LegacyProfileIndexingRules> {
		const catalog = await this.#readCatalog();
		return Object.hasOwn(catalog.profiles, profile) ? structuredClone(catalog.profiles[profile]!) : {};
	}

	async set(profile: string, rules: LegacyProfileIndexingRules): Promise<void> {
		return this.#mutate((catalog) => {
			if (rules.include === undefined && rules.exclude === undefined && rules.windows1251 !== true) {
				delete catalog.profiles[profile];
				return;
			}
			catalog.profiles[profile] = structuredClone(rules);
		});
	}

	async remove(profile: string): Promise<void> {
		return this.#mutate((catalog) => {
			delete catalog.profiles[profile];
		});
	}

	async #mutate(change: (catalog: StoredProfileIndexingRules) => void): Promise<void> {
		const operation = this.#pendingMutation.then(async () => {
			const catalog = await this.#readCatalog();
			change(catalog);
			await this.#writeCatalog(catalog);
		});
		this.#pendingMutation = operation.catch(() => {});
		return operation;
	}

	async #readCatalog(): Promise<StoredProfileIndexingRules> {
		let source: string;
		try {
			source = await readFile(this.#path, 'utf8');
		} catch (error: unknown) {
			if (isMissingFile(error)) {
				return emptyCatalog();
			}
			throw error;
		}
		return storedRules(JSON.parse(source) as unknown);
	}

	async #writeCatalog(catalog: StoredProfileIndexingRules): Promise<void> {
		await mkdir(dirname(this.#path), { recursive: true });
		const temporaryPath = `${this.#path}.${process.pid}.tmp`;
		await writeFile(temporaryPath, `${JSON.stringify(catalog, undefined, 2)}\n`, 'utf8');
		await rename(temporaryPath, this.#path);
	}
}

function defaultPath(): string {
	const configRoot = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config');
	return join(configRoot, 'the-blue-scribes-ui', 'profile-indexing-rules.json');
}

function emptyCatalog(): StoredProfileIndexingRules {
	return {
		schemaVersion: 1,
		profiles: Object.create(null) as Record<string, LegacyProfileIndexingRules>,
	};
}

function storedRules(value: unknown): StoredProfileIndexingRules {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('Saved profile indexing rules must be an object');
	}
	const record = value as Record<string, unknown>;
	if (
		record.schemaVersion !== 1 ||
		typeof record.profiles !== 'object' ||
		record.profiles === null ||
		Array.isArray(record.profiles)
	) {
		throw new Error('Saved profile indexing rules use an unsupported format');
	}
	const profiles: Record<string, LegacyProfileIndexingRules> = Object.create(null) as Record<
		string,
		LegacyProfileIndexingRules
	>;
	for (const [name, rules] of Object.entries(record.profiles)) {
		if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) {
			throw new Error(`Saved indexing rules for ${name} must be an object`);
		}
		const entry = rules as Record<string, unknown>;
		const include = validatedList(entry.include, `${name} include`);
		const exclude = validatedList(entry.exclude, `${name} exclude`);
		const windows1251 = validatedBoolean(entry.windows1251, `${name} windows1251`);
		profiles[name] = {
			...(include === undefined ? {} : { include }),
			...(exclude === undefined ? {} : { exclude }),
			...(windows1251 === true ? { windows1251: true } : {}),
		};
	}
	return { schemaVersion: 1, profiles };
}

function validatedList(value: unknown, label: string): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
		throw new Error(`Saved ${label} patterns must be a list of non-empty strings`);
	}
	return value.map((entry) => String(entry).trim());
}

function validatedBoolean(value: unknown, label: string): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'boolean') {
		throw new Error(`Saved ${label} setting must be a boolean`);
	}
	return value;
}

function isMissingFile(error: unknown): boolean {
	return (
		typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
	);
}
