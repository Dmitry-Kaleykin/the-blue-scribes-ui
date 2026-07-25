export function record(value: unknown, label = 'request body'): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, options: { optional?: boolean } = {}): string | undefined {
	if (value === undefined && options.optional === true) {
		return undefined;
	}
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${label} must not be empty`);
	}
	return value.trim();
}

export function integer(
	value: unknown,
	label: string,
	options: { optional?: boolean; minimum?: number } = {},
): number | undefined {
	if (value === undefined && options.optional === true) {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < (options.minimum ?? 0)) {
		throw new Error(`${label} must be an integer of at least ${options.minimum ?? 0}`);
	}
	return parsed;
}

export function boolean(value: unknown, label: string, options: { optional?: boolean } = {}): boolean | undefined {
	if (value === undefined && options.optional === true) {
		return undefined;
	}
	if (typeof value !== 'boolean') {
		throw new Error(`${label} must be a boolean`);
	}
	return value;
}

export function stringList(value: unknown, label: string): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
		throw new Error(`${label} must be a list of non-empty strings`);
	}
	return value.map((entry) => String(entry).trim());
}
