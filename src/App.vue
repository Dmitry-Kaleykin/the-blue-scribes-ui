<script setup lang="ts">
	import { computed, onMounted, onUnmounted, ref } from 'vue'
	import {
		BookOpenText,
		FolderCode,
		LayoutDashboard,
		LoaderCircle,
		Menu,
		Plus,
		Search,
		Server,
		Settings,
		X,
	} from '@lucide/vue'

	import type { BootstrapResponse, IndexingJob, ProjectSummary, ProviderProfile } from '../shared/contracts'
	import IndexProjectModal from './features/index-project/IndexProjectModal.vue'
	import ProfileModal from './features/profile-form/ProfileModal.vue'
	import DashboardPage from './pages/dashboard/DashboardPage.vue'
	import ProfilesPage from './pages/profiles/ProfilesPage.vue'
	import ProjectPage from './pages/project/ProjectPage.vue'
	import SearchPage from './pages/search/SearchPage.vue'
	import { api, subscribeToJob } from './shared/api/client'

	type View = 'dashboard' | 'profiles' | 'search' | 'project'

	const data = ref<BootstrapResponse>({
		profiles: [],
		projects: [],
		jobs: [],
		environment: { mcpCommand: 'scribes-mcp' },
	})
	const activeView = ref<View>('dashboard')
	const selectedProjectId = ref('')
	const initialSearchProject = ref('')
	const loading = ref(true)
	const loadError = ref('')
	const mobileMenu = ref(false)
	const indexModal = ref(false)
	const profileModal = ref(false)
	const editingProfile = ref<ProviderProfile>()
	const toast = ref<{ tone: 'success' | 'danger'; message: string }>()
	const subscriptions = new Map<string, () => void>()
	let toastTimer: ReturnType<typeof setTimeout> | undefined

	const selectedProject = computed(() =>
		data.value.projects.find(({ projectIdentifier }) => projectIdentifier === selectedProjectId.value),
	)
	const activeJobCount = computed(
		() => data.value.jobs.filter(({ status }) => status === 'running' || status === 'queued').length,
	)

	onMounted(load)
	onUnmounted(() => {
		for (const unsubscribe of subscriptions.values()) unsubscribe()
		if (toastTimer) clearTimeout(toastTimer)
	})

	async function load(): Promise<void> {
		loading.value = data.value.projects.length === 0 && data.value.profiles.length === 0
		loadError.value = ''
		try {
			data.value = await api.bootstrap()
			for (const job of data.value.jobs) {
				if (job.status === 'running' || job.status === 'queued') watchJob(job.id)
			}
			if (activeView.value === 'project' && !selectedProject.value) {
				activeView.value = 'dashboard'
			}
		} catch (reason: unknown) {
			loadError.value = reason instanceof Error ? reason.message : String(reason)
		} finally {
			loading.value = false
		}
	}

	function navigate(view: View): void {
		activeView.value = view
		mobileMenu.value = false
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	function openProject(project: ProjectSummary): void {
		selectedProjectId.value = project.projectIdentifier
		navigate('project')
	}

	function openSearch(project?: ProjectSummary): void {
		initialSearchProject.value = project?.projectIdentifier ?? selectedProjectId.value
		navigate('search')
	}

	function openProfile(profile?: ProviderProfile): void {
		editingProfile.value = profile
		profileModal.value = true
	}

	function watchJob(id: string): void {
		if (subscriptions.has(id)) return
		subscriptions.set(
			id,
			subscribeToJob(id, (event) => {
				const value = event as { job?: IndexingJob }
				if (!value.job) return
				const index = data.value.jobs.findIndex((job) => job.id === value.job!.id)
				if (index === -1) data.value = { ...data.value, jobs: [value.job, ...data.value.jobs] }
				else {
					const jobs = [...data.value.jobs]
					jobs[index] = value.job
					data.value = { ...data.value, jobs }
				}
				if (value.job.status === 'completed' || value.job.status === 'failed' || value.job.status === 'cancelled') {
					subscriptions.get(id)?.()
					subscriptions.delete(id)
					showToast(
						value.job.status === 'completed' ? 'success' : 'danger',
						value.job.status === 'completed'
							? `${value.job.label} was indexed successfully.`
							: (value.job.error?.message ?? `Indexing ${value.job.status}.`),
					)
					void load()
				}
			}),
		)
	}

	function jobStarted(job: IndexingJob): void {
		data.value = { ...data.value, jobs: [job, ...data.value.jobs] }
		indexModal.value = false
		watchJob(job.id)
		showToast('success', 'Indexing started. You can keep using the UI while it runs.')
		navigate('dashboard')
	}

	async function cancelJob(id: string): Promise<void> {
		try {
			await api.cancelJob(id)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function profileSaved(profile: ProviderProfile): Promise<void> {
		profileModal.value = false
		editingProfile.value = undefined
		await load()
		showToast('success', `Profile ${profile.name} was saved.`)
	}

	async function testProfile(profile: ProviderProfile): Promise<void> {
		showToast('success', `Testing ${profile.name} against LM Studio…`)
		try {
			const result = await api.testProfile(profile.name)
			const reranking = result.reranking ? ` Reranker score: ${result.reranking.score.toFixed(3)}.` : ''
			showToast('success', `${result.embedding.model} returned ${result.embedding.dimensions} dimensions.${reranking}`)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function removeProfile(profile: ProviderProfile): Promise<void> {
		if (
			!window.confirm(
				`Delete provider profile "${profile.name}"? Existing recipes that refer to it will need another profile.`,
			)
		)
			return
		try {
			await api.deleteProfile(profile.name)
			await load()
			showToast('success', `Profile ${profile.name} was deleted.`)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function reindexProject(): Promise<void> {
		if (!selectedProject.value) return
		try {
			const job = await api.reindex(selectedProject.value.projectIdentifier)
			jobStarted(job)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function activateTarget(target: string): Promise<void> {
		if (!selectedProject.value) return
		try {
			await api.activateTarget(selectedProject.value.projectIdentifier, target)
			await load()
			showToast('success', `Retrieval switched to ${target}.`)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function renameTarget(target: string, name: string): Promise<void> {
		if (!selectedProject.value) return
		try {
			await api.renameTarget(selectedProject.value.projectIdentifier, target, name)
			await load()
			showToast('success', `Target ${target} was renamed to ${name}.`)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	async function removeProject(): Promise<void> {
		const project = selectedProject.value
		if (!project) return
		const label = project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier
		if (!window.confirm(`Delete the managed index for "${label}"? The source project will not be changed.`)) return
		try {
			await api.deleteProject(project.projectIdentifier)
			selectedProjectId.value = ''
			await load()
			navigate('dashboard')
			showToast('success', `The local index for ${label} was deleted.`)
		} catch (reason: unknown) {
			showFailure(reason)
		}
	}

	function showFailure(reason: unknown): void {
		showToast('danger', reason instanceof Error ? reason.message : String(reason))
	}

	function showToast(tone: 'success' | 'danger', message: string): void {
		toast.value = { tone, message }
		if (toastTimer) clearTimeout(toastTimer)
		toastTimer = setTimeout(() => {
			toast.value = undefined
		}, 5000)
	}
</script>

<template>
	<div class="app-shell">
		<aside
			class="sidebar"
			:class="{ 'sidebar--open': mobileMenu }"
		>
			<div class="brand">
				<span class="brand__mark"><BookOpenText :size="23" /></span>
				<div><strong>The Blue Scribes</strong><small>Local retrieval</small></div>
				<button
					class="icon-button sidebar__close"
					type="button"
					aria-label="Close menu"
					@click="mobileMenu = false"
				>
					<X :size="19" />
				</button>
			</div>

			<nav
				class="nav-list"
				aria-label="Primary navigation"
			>
				<button
					:class="{ active: activeView === 'dashboard' }"
					type="button"
					@click="navigate('dashboard')"
				>
					<LayoutDashboard :size="19" /> Overview
				</button>
				<button
					:class="{ active: activeView === 'search' }"
					type="button"
					@click="openSearch()"
				>
					<Search :size="19" /> Search
				</button>
				<button
					:class="{ active: activeView === 'profiles' }"
					type="button"
					@click="navigate('profiles')"
				>
					<Server :size="19" /> Provider profiles
				</button>
			</nav>

			<div class="sidebar__section">
				<p>Projects</p>
				<button
					v-for="project in data.projects.slice(0, 7)"
					:key="project.projectIdentifier"
					class="project-link"
					:class="{
						active: activeView === 'project' && selectedProjectId === project.projectIdentifier,
					}"
					type="button"
					@click="openProject(project)"
				>
					<FolderCode :size="17" />
					<span>{{ project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier }}</span>
					<i v-if="project.active" />
				</button>
				<span
					v-if="data.projects.length === 0"
					class="sidebar__empty"
					>No indexes yet</span
				>
			</div>

			<div class="sidebar__bottom">
				<button
					class="sidebar-index"
					type="button"
					:disabled="data.profiles.length === 0"
					@click="indexModal = true"
				>
					<Plus :size="17" /> Index project
				</button>
				<div class="local-status"><span /> Local only · 127.0.0.1</div>
			</div>
		</aside>

		<div
			v-if="mobileMenu"
			class="sidebar-scrim"
			@click="mobileMenu = false"
		/>

		<section class="workspace">
			<header class="topbar">
				<button
					class="icon-button mobile-menu"
					type="button"
					aria-label="Open menu"
					@click="mobileMenu = true"
				>
					<Menu :size="20" />
				</button>
				<div class="topbar__status">
					<span v-if="activeJobCount > 0"
						><LoaderCircle
							class="spin"
							:size="15"
						/>
						{{ activeJobCount }} indexing</span
					>
					<span v-else><i /> Ready</span>
				</div>
				<button
					class="icon-button"
					type="button"
					aria-label="Refresh workspace"
					@click="load"
				>
					<Settings :size="18" />
				</button>
			</header>

			<div
				v-if="loading"
				class="app-loading"
			>
				<LoaderCircle
					class="spin"
					:size="28"
				/>
				<p>Reading local Scribes state…</p>
			</div>
			<div
				v-else-if="loadError"
				class="app-error"
			>
				<h1>Could not load the local workspace</h1>
				<p>{{ loadError }}</p>
				<button
					class="button button--primary"
					type="button"
					@click="load"
				>
					Try again
				</button>
			</div>
			<template v-else>
				<DashboardPage
					v-if="activeView === 'dashboard'"
					:projects="data.projects"
					:profiles="data.profiles"
					:jobs="data.jobs"
					@index="indexModal = true"
					@project="openProject"
					@search="openSearch"
					@profiles="navigate('profiles')"
					@cancel-job="cancelJob"
				/>
				<ProfilesPage
					v-else-if="activeView === 'profiles'"
					:profiles="data.profiles"
					@create="openProfile()"
					@edit="openProfile"
					@test="testProfile"
					@remove="removeProfile"
				/>
				<SearchPage
					v-else-if="activeView === 'search'"
					:projects="data.projects"
					:profiles="data.profiles"
					:initial-project="initialSearchProject"
				/>
				<ProjectPage
					v-else-if="activeView === 'project' && selectedProject"
					:project="selectedProject"
					:mcp-command="data.environment.mcpCommand"
					@back="navigate('dashboard')"
					@search="openSearch(selectedProject)"
					@reindex="reindexProject"
					@activate="activateTarget"
					@rename="renameTarget"
					@remove="removeProject"
				/>
			</template>
		</section>

		<IndexProjectModal
			v-if="indexModal"
			:profiles="data.profiles"
			@close="indexModal = false"
			@started="jobStarted"
		/>
		<ProfileModal
			v-if="profileModal"
			:profile="editingProfile"
			@close="profileModal = false"
			@saved="profileSaved"
		/>

		<div
			v-if="toast"
			class="toast"
			:class="`toast--${toast.tone}`"
			role="status"
		>
			<span />
			{{ toast.message }}
			<button
				type="button"
				aria-label="Dismiss notification"
				@click="toast = undefined"
			>
				<X :size="16" />
			</button>
		</div>
	</div>
</template>
