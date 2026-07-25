<script setup lang="ts">
	import { computed } from 'vue'
	import { ArrowRight, Database, FolderCode, Layers3, Plus, RefreshCw, Search, Server } from '@lucide/vue'

	import type { IndexingJob, ProjectSummary, ProviderProfile } from '../../../shared/contracts'
	import JobPanel from '../../entities/project/JobPanel.vue'
	import StatusPill from '../../shared/components/StatusPill.vue'

	const props = defineProps<{
		projects: readonly ProjectSummary[]
		profiles: readonly ProviderProfile[]
		jobs: readonly IndexingJob[]
	}>()

	const emit = defineEmits<{
		index: []
		project: [project: ProjectSummary]
		search: [project: ProjectSummary]
		profiles: []
		cancelJob: [id: string]
	}>()

	const activeJobs = computed(() => props.jobs.filter(({ status }) => status === 'running' || status === 'queued'))
	const recentJobs = computed(() =>
		props.jobs.filter(({ status }) => status !== 'running' && status !== 'queued').slice(0, 3),
	)
	const readyBuilds = computed(() => props.projects.reduce((total, project) => total + project.buildsByStatus.ready, 0))
	const storage = computed(() => props.projects.reduce((total, project) => total + project.databaseBytes, 0))

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
		if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
		return `${(bytes / 1024 ** 3).toFixed(1)} GB`
	}

	function projectName(project: ProjectSummary): string {
		return project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier
	}

	function projectSubtitle(project: ProjectSummary): string {
		return project.root ?? project.projectIdentifier
	}
</script>

<template>
	<main class="page">
		<header class="page-header page-header--split">
			<div>
				<p class="eyebrow">Local retrieval workspace</p>
				<h1>Your indexed knowledge</h1>
				<p class="page-lead">Build, inspect, and search private indexes without reconstructing CLI commands.</p>
			</div>
			<button
				class="button button--primary"
				type="button"
				@click="emit('index')"
			>
				<Plus :size="17" />
				Index project
			</button>
		</header>

		<section
			class="metric-grid"
			aria-label="Workspace summary"
		>
			<article class="metric-card">
				<span class="metric-card__icon"><FolderCode :size="20" /></span>
				<div>
					<strong>{{ projects.length }}</strong
					><span>Indexed projects</span>
				</div>
			</article>
			<article class="metric-card">
				<span class="metric-card__icon metric-card__icon--teal"><Layers3 :size="20" /></span>
				<div>
					<strong>{{ readyBuilds }}</strong
					><span>Ready builds</span>
				</div>
			</article>
			<article class="metric-card">
				<span class="metric-card__icon metric-card__icon--violet"><Server :size="20" /></span>
				<div>
					<strong>{{ profiles.length }}</strong
					><span>Provider profiles</span>
				</div>
			</article>
			<article class="metric-card">
				<span class="metric-card__icon metric-card__icon--sand"><Database :size="20" /></span>
				<div>
					<strong>{{ formatBytes(storage) }}</strong
					><span>Local index storage</span>
				</div>
			</article>
		</section>

		<section
			v-if="activeJobs.length > 0 || recentJobs.length > 0"
			class="content-section"
		>
			<div class="section-heading">
				<div>
					<p class="eyebrow">Activity</p>
					<h2>Indexing jobs</h2>
				</div>
			</div>
			<div class="job-list">
				<JobPanel
					v-for="job in [...activeJobs, ...recentJobs]"
					:key="job.id"
					:job="job"
					@cancel="emit('cancelJob', $event)"
				/>
			</div>
		</section>

		<section class="content-section">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Projects</p>
					<h2>Retrieval indexes</h2>
				</div>
				<span class="muted">{{ projects.length }} total</span>
			</div>

			<div
				v-if="projects.length > 0"
				class="project-table"
			>
				<div class="project-table__head">
					<span>Project</span>
					<span>Active retrieval</span>
					<span>Latest build</span>
					<span>Storage</span>
					<span />
				</div>
				<article
					v-for="project in projects"
					:key="project.projectIdentifier"
					class="project-row"
				>
					<button
						class="project-row__identity"
						type="button"
						@click="emit('project', project)"
					>
						<span class="project-mark"><FolderCode :size="20" /></span>
						<span>
							<strong>{{ projectName(project) }}</strong>
							<small>{{ projectSubtitle(project) }}</small>
						</span>
					</button>
					<div>
						<StatusPill
							v-if="project.active"
							tone="success"
							:label="project.active.target ?? project.active.type"
						/>
						<span
							v-else
							class="muted"
							>Not selected</span
						>
					</div>
					<div class="project-row__build">
						<strong>{{ project.latestReadyBuild?.model ?? 'No ready build' }}</strong>
						<small v-if="project.latestReadyBuild"> {{ project.latestReadyBuild.dimensions }} dimensions </small>
					</div>
					<span class="mono-muted">{{ formatBytes(project.databaseBytes) }}</span>
					<div class="project-row__actions">
						<button
							class="button button--secondary button--small"
							type="button"
							@click="emit('search', project)"
						>
							<Search :size="15" /> Search
						</button>
						<button
							class="icon-button"
							type="button"
							aria-label="Open project"
							@click="emit('project', project)"
						>
							<ArrowRight :size="18" />
						</button>
					</div>
				</article>
			</div>

			<div
				v-else
				class="empty-state"
			>
				<span class="empty-state__mark"><FolderCode :size="30" /></span>
				<h3>No projects indexed yet</h3>
				<p v-if="profiles.length > 0">Choose a directory and build your first private retrieval index.</p>
				<p v-else>Create an LM Studio profile first, then index a project.</p>
				<div class="button-row">
					<button
						v-if="profiles.length === 0"
						class="button button--secondary"
						type="button"
						@click="emit('profiles')"
					>
						<Server :size="16" /> Set up a profile
					</button>
					<button
						class="button button--primary"
						type="button"
						:disabled="profiles.length === 0"
						@click="emit('index')"
					>
						<Plus :size="16" /> Index project
					</button>
				</div>
			</div>
		</section>

		<section class="quick-actions">
			<button
				class="quick-action"
				type="button"
				@click="emit('index')"
			>
				<span><RefreshCw :size="19" /></span>
				<strong>Start an index</strong>
				<small>Save a recipe and monitor every phase.</small>
			</button>
			<button
				class="quick-action"
				type="button"
				@click="emit('profiles')"
			>
				<span><Server :size="19" /></span>
				<strong>Manage providers</strong>
				<small>Discover and diagnose LM Studio models.</small>
			</button>
			<button
				class="quick-action"
				type="button"
				:disabled="projects.length === 0"
				@click="projects[0] && emit('search', projects[0])"
			>
				<span><Search :size="19" /></span>
				<strong>Test retrieval</strong>
				<small>Search the active target and inspect scores.</small>
			</button>
		</section>
	</main>
</template>
