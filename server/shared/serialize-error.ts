export interface SerializedError {
	message: string;
	code?: string;
	details?: Readonly<Record<string, unknown>>;
}

export function serializeError(error: unknown): SerializedError {
	if (!(error instanceof Error)) {
		return { message: String(error) };
	}
	const metadata = error as Error & {
		code?: unknown;
		details?: unknown;
	};
	return {
		message: error.message,
		...(metadata.code === undefined ? {} : { code: String(metadata.code) }),
		...(isRecord(metadata.details) ? { details: metadata.details } : {}),
	};
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
