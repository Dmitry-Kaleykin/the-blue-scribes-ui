export interface EmbeddingProfile {
	provider: 'lm-studio'
	model: string
	dimensions: number
	baseUrl?: string
	maximumInputs?: number
	embeddingSuffix?: string
}

export interface RerankingProfile {
	provider: 'lm-studio-qwen3'
	model: string
	baseUrl?: string
	instruction?: string
}

export interface ProviderProfile {
	name: string
	embedding: EmbeddingProfile
	reranking?: RerankingProfile
	createdAt: string
	updatedAt: string
}

export interface IndexingRecipe {
	schemaVersion: 1
	projectIdentifier: string
	provider: { type: 'profile'; profile: string } | { type: 'inline'; embedding: EmbeddingProfile }
	target?: string
	keepReplacedBuilds: number
	allowDirty?: boolean
	maximumChunkSize?: number
	windows1251?: boolean
	include?: readonly string[]
	exclude?: readonly string[]
	createdAt: string
	updatedAt: string
}

export interface RetrievalTarget {
	name: string
	indexBuildId: string
	retainedBuildIds?: readonly string[]
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface ProjectSummary {
	projectIdentifier: string
	root?: string
	databasePath: string
	databaseBytes: number
	buildCount: number
	buildsByStatus: Record<'building' | 'ready' | 'failed' | 'cancelled', number>
	latestReadyBuild?: {
		indexBuildId: string
		completedAt?: string
		model: string
		dimensions: number
	}
	active?: {
		type: string
		target?: string
		indexBuildId: string
	} | null
	targets: readonly RetrievalTarget[]
	recipe?: IndexingRecipe
	error?: string
}

export interface BootstrapResponse {
	profiles: readonly ProviderProfile[]
	projects: readonly ProjectSummary[]
	jobs: readonly IndexingJob[]
	environment: {
		mcpCommand: string
	}
}

export type IndexingJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface IndexingJob {
	id: string
	kind: 'index' | 'reindex'
	projectKey: string
	label: string
	status: IndexingJobStatus
	createdAt: string
	startedAt?: string
	completedAt?: string
	progress?: {
		phase: string
		completed?: number
		total?: number
		currentPath?: string
		discoveredFiles?: number
		queuedChunks?: number
		reusedDocuments?: number
		reusedEmbeddings?: number
		generatedEmbeddings?: number
	}
	result?: {
		projectIdentifier?: string
		indexBuildId: string
		databasePath: string
		logPath: string
	}
	error?: {
		message: string
		code?: string
		details?: Readonly<Record<string, unknown>>
	}
}

export interface IndexProjectInput {
	root: string
	profile: string
	target?: string
	keepReplacedBuilds: number
	windows1251?: boolean
	allowDirty?: boolean
	maximumChunkSize?: number
	include?: readonly string[]
	exclude?: readonly string[]
}

export interface ProfileInput {
	name: string
	model: string
	dimensions?: number
	detectDimensions?: boolean
	baseUrl?: string
	maximumInputs?: number
	embeddingSuffix?: string
	rerankingModel?: string
	rerankingInstruction?: string
}

export interface SearchInput {
	query: string
	profile?: string
	limit?: number
	language?: string
	contextBefore?: number
	contextAfter?: number
	contextCharacters?: number
	reranking?: boolean
	rerankCandidates?: number
}

export interface SearchResult {
	score: number
	semanticScore?: number
	rerankScore?: number
	path: string
	language: string
	format: string
	content: string
	range: {
		startLine: number
		endLine: number
		startOffset: number
		endOffset: number
	}
	context?: {
		before: readonly ContextChunk[]
		after: readonly ContextChunk[]
	}
}

export interface ContextChunk {
	chunkId: string
	index: number
	content: string
	range: {
		startLine: number
		endLine: number
	}
}

export interface SearchResponse {
	projectIdentifier: string
	indexBuildId: string
	resultCount: number
	results: readonly SearchResult[]
}

export interface ModelSummary {
	id: string
	object?: string
	ownedBy?: string
}

export interface ApiError {
	error: {
		message: string
		code?: string
		details?: Readonly<Record<string, unknown>>
	}
}
