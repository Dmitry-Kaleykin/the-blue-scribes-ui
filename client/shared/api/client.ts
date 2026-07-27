import type {
	ApiError,
	BootstrapResponse,
	IndexingJob,
	IndexProjectInput,
	ModelSummary,
	ProfileInput,
	ProviderProfile,
	SearchInput,
	SearchResponse,
} from '../../../shared/contracts';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
			...options.headers,
		},
	});
	const payload = (await response.json()) as T | ApiError;
	if (!response.ok) {
		const failure = payload as ApiError;
		throw new Error(failure.error?.message ?? `Request failed with ${response.status}`);
	}
	return payload as T;
}

export const api = {
	bootstrap: () => request<BootstrapResponse>('/api/bootstrap'),
	models: async (baseUrl?: string) => {
		const query = baseUrl === undefined ? '' : `?baseUrl=${encodeURIComponent(baseUrl)}`;
		return request<{ count: number; models: readonly ModelSummary[] }>(`/api/models${query}`);
	},
	saveProfile: (input: ProfileInput) =>
		request<ProviderProfile>('/api/profiles', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	testProfile: (name: string) =>
		request<{
			profile: string;
			embedding: { model: string; dimensions: number };
			reranking?: { model: string; score: number };
		}>(`/api/profiles/${encodeURIComponent(name)}/test`, { method: 'POST' }),
	deleteProfile: (name: string) => request(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
	startIndex: (input: IndexProjectInput) =>
		request<IndexingJob>('/api/indexing-jobs', {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	jobs: () => request<{ jobs: readonly IndexingJob[] }>('/api/indexing-jobs'),
	reindex: (projectIdentifier: string) =>
		request<IndexingJob>(`/api/projects/${encodeURIComponent(projectIdentifier)}/reindex`, { method: 'POST' }),
	cancelJob: (id: string) =>
		request<IndexingJob>(`/api/indexing-jobs/${encodeURIComponent(id)}`, {
			method: 'DELETE',
		}),
	search: (projectIdentifier: string, input: SearchInput) =>
		request<SearchResponse>(`/api/projects/${encodeURIComponent(projectIdentifier)}/search`, {
			method: 'POST',
			body: JSON.stringify(input),
		}),
	chunks: (projectIdentifier: string, path: string) =>
		request<{
			indexBuildId: string;
			chunks: {
				document: { metadata: Record<string, unknown> };
				chunks: ReadonlyArray<{
					content: string;
					metadata: Record<string, unknown>;
				}>;
			};
		}>(`/api/projects/${encodeURIComponent(projectIdentifier)}/chunks` + `?path=${encodeURIComponent(path)}`),
	activateTarget: (projectIdentifier: string, target: string) =>
		request(
			`/api/projects/${encodeURIComponent(projectIdentifier)}` + `/targets/${encodeURIComponent(target)}/activate`,
			{ method: 'POST' },
		),
	renameTarget: (projectIdentifier: string, target: string, name: string) =>
		request(
			`/api/projects/${encodeURIComponent(projectIdentifier)}` + `/targets/${encodeURIComponent(target)}/rename`,
			{ method: 'POST', body: JSON.stringify({ name }) },
		),
	deleteProject: (projectIdentifier: string) =>
		request(`/api/projects/${encodeURIComponent(projectIdentifier)}`, {
			method: 'DELETE',
		}),
};

export function subscribeToJob(id: string, onEvent: (event: unknown) => void): () => void {
	const source = new EventSource(`/api/indexing-jobs/${encodeURIComponent(id)}/events`);
	source.onmessage = ({ data }) => {
		onEvent(JSON.parse(data) as unknown);
	};
	return () => source.close();
}
