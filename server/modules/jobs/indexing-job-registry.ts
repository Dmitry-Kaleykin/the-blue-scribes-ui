import { randomUUID } from 'node:crypto'

import {
  ProjectIndexingService,
  type ProjectIndexingEvent,
  type ProjectIndexingOutcome,
} from 'the-blue-scribes'

import type {
  IndexingJob,
  IndexProjectInput,
} from '../../../shared/contracts.js'
import { serializeError } from '../../shared/serialize-error.js'

interface InternalJob {
  snapshot: IndexingJob
  controller: AbortController
  events: unknown[]
  listeners: Set<(event: unknown) => void>
  lastProgressAt: number
  previousPhase?: string
}

export interface IndexingJobRegistryOptions {
  indexingService?: ProjectIndexingService
}

export class IndexingJobRegistry {
  readonly #service: ProjectIndexingService
  readonly #jobs = new Map<string, InternalJob>()

  constructor(options: IndexingJobRegistryOptions = {}) {
    this.#service = options.indexingService ?? new ProjectIndexingService({
      ...(process.env.LM_STUDIO_API_KEY === undefined
        ? {}
        : { apiKey: process.env.LM_STUDIO_API_KEY }),
    })
  }

  list(): readonly IndexingJob[] {
    return [...this.#jobs.values()]
      .map(({ snapshot }) => structuredClone(snapshot))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  get(id: string): IndexingJob {
    return structuredClone(this.#required(id).snapshot)
  }

  events(id: string): readonly unknown[] {
    return [...this.#required(id).events]
  }

  subscribe(id: string, listener: (event: unknown) => void): () => void {
    const job = this.#required(id)
    job.listeners.add(listener)
    return () => job.listeners.delete(listener)
  }

  startIndex(input: IndexProjectInput): IndexingJob {
    const projectKey = input.root.trim()
    this.#assertAvailable(projectKey)
    const job = this.#create('index', projectKey, input.target ?? input.root)
    void this.#run(job, () => this.#service.index({
      root: input.root,
      provider: { type: 'profile', profile: input.profile },
      ...(input.target === undefined ? {} : { target: input.target }),
      keepReplacedBuilds: input.keepReplacedBuilds,
      ...(input.windows1251 === true ? { windows1251: true } : {}),
      ...(input.allowDirty === true ? { allowDirty: true } : {}),
      ...(input.maximumChunkSize === undefined
        ? {}
        : { maximumChunkSize: input.maximumChunkSize }),
      ...(input.include === undefined ? {} : { include: input.include }),
      ...(input.exclude === undefined ? {} : { exclude: input.exclude }),
      signal: job.controller.signal,
      onEvent: (event) => this.#onProgress(job, event),
    }))
    return structuredClone(job.snapshot)
  }

  startReindex(projectReference: string, label: string): IndexingJob {
    this.#assertAvailable(projectReference)
    const job = this.#create('reindex', projectReference, label)
    void this.#run(job, () => this.#service.reindex(
      projectReference,
      process.cwd(),
      (event) => this.#onProgress(job, event),
      job.controller.signal,
    ))
    return structuredClone(job.snapshot)
  }

  cancel(id: string): IndexingJob {
    const job = this.#required(id)
    if (job.snapshot.status !== 'running' && job.snapshot.status !== 'queued') {
      return structuredClone(job.snapshot)
    }
    job.controller.abort(new Error('Indexing cancelled from the UI'))
    job.snapshot.status = 'cancelled'
    job.snapshot.completedAt = new Date().toISOString()
    this.#publish(job, { type: 'job-cancelled', job: job.snapshot })
    return structuredClone(job.snapshot)
  }

  #create(
    kind: IndexingJob['kind'],
    projectKey: string,
    label: string,
  ): InternalJob {
    const job: InternalJob = {
      snapshot: {
        id: randomUUID(),
        kind,
        projectKey,
        label,
        status: 'queued',
        createdAt: new Date().toISOString(),
      },
      controller: new AbortController(),
      events: [],
      listeners: new Set(),
      lastProgressAt: 0,
    }
    this.#jobs.set(job.snapshot.id, job)
    this.#publish(job, { type: 'job-created', job: job.snapshot })
    return job
  }

  async #run(
    job: InternalJob,
    operation: () => Promise<ProjectIndexingOutcome>,
  ): Promise<void> {
    job.snapshot.status = 'running'
    job.snapshot.startedAt = new Date().toISOString()
    this.#publish(job, { type: 'job-started', job: job.snapshot })

    try {
      const outcome = await operation()
      if (job.controller.signal.aborted) return
      job.snapshot.status = 'completed'
      job.snapshot.completedAt = new Date().toISOString()
      job.snapshot.result = {
        ...(outcome.project === undefined
          ? {}
          : { projectIdentifier: outcome.project.projectIdentifier }),
        indexBuildId: outcome.result.indexBuildId,
        databasePath: outcome.databasePath,
        logPath: outcome.summary.logPath,
      }
      this.#publish(job, { type: 'job-completed', job: job.snapshot })
    } catch (error: unknown) {
      if (job.controller.signal.aborted) return
      const failure = serializeError(error)
      job.snapshot.status = failure.code === 'cancelled' ? 'cancelled' : 'failed'
      job.snapshot.completedAt = new Date().toISOString()
      job.snapshot.error = {
        message: failure.message,
        ...(failure.code === undefined ? {} : { code: failure.code }),
        ...(failure.details === undefined ? {} : { details: failure.details }),
      }
      this.#publish(job, { type: 'job-failed', job: job.snapshot })
    }
  }

  #onProgress(job: InternalJob, event: ProjectIndexingEvent): void {
    if (event.type === 'indexing-progress') {
      job.snapshot.progress = event.progress
      const now = Date.now()
      const phaseChanged = event.progress.phase !== job.previousPhase
      const complete = event.progress.total !== undefined
        && event.progress.completed === event.progress.total
      if (!phaseChanged && !complete && now - job.lastProgressAt < 200) return
      job.previousPhase = event.progress.phase
      job.lastProgressAt = now
    }
    this.#publish(job, event)
  }

  #publish(job: InternalJob, event: unknown): void {
    job.events.push(event)
    if (job.events.length > 500) job.events.shift()
    for (const listener of job.listeners) listener(event)
  }

  #assertAvailable(projectKey: string): void {
    const active = [...this.#jobs.values()].find(({ snapshot }) =>
      snapshot.projectKey === projectKey
      && (snapshot.status === 'queued' || snapshot.status === 'running')
    )
    if (active !== undefined) {
      throw new Error(`An indexing job is already running for ${projectKey}`)
    }
  }

  #required(id: string): InternalJob {
    const job = this.#jobs.get(id)
    if (job === undefined) throw new Error(`Indexing job ${id} was not found`)
    return job
  }
}
