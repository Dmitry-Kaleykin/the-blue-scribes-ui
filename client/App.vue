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
				<template v-if="data.projects.length > 0">
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
				</template>
				<span
					v-else
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
					v-tippy="{
						content: 'Refresh workspace',
						placement: 'bottom',
					}"
					class="icon-button"
					type="button"
					aria-label="Refresh workspace"
					:disabled="refreshing"
					@click="refresh"
				>
					<RefreshCw
						:class="{ spin: refreshing }"
						:size="18"
					/>
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
					@recover-build="recoverBuild"
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
					@recover-interrupted="recoverProjectBuilds"
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

		<ScribesToast
			v-if="toastCurrent"
			:item="toastCurrent"
			@close="dismissToast"
		/>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import {
		BookOpenText,
		FolderCode,
		LayoutDashboard,
		LoaderCircle,
		Menu,
		Plus,
		RefreshCw,
		Search,
		Server,
		X,
	} from '@lucide/vue';

	import type { BootstrapResponse, IndexingJob, ProjectSummary, ProviderProfile } from '../shared/contracts';
	import IndexProjectModal from './features/index-project/IndexProjectModal.vue';
	import ProfileModal from './features/profile-form/ProfileModal.vue';
	import DashboardPage from './pages/dashboard/DashboardPage.vue';
	import ProfilesPage from './pages/profiles/ProfilesPage.vue';
	import ProjectPage from './pages/project/ProjectPage.vue';
	import SearchPage from './pages/search/SearchPage.vue';
	import ScribesToast from './shared/components/ScribesToast.vue';
	import { api, subscribeToJob } from './shared/api/client';
	import { useToast } from './shared/composables/useToast';

	type View = 'dashboard' | 'profiles' | 'search' | 'project';

	const data = ref<BootstrapResponse>({
		profiles: [],
		projects: [],
		jobs: [],
		environment: { mcpCommand: 'scribes-mcp' },
	});
	const activeView = ref<View>('dashboard');
	const selectedProjectId = ref('');
	const initialSearchProject = ref('');
	const loading = ref(true);
	const refreshing = ref(false);
	const loadError = ref('');
	const mobileMenu = ref(false);
	const indexModal = ref(false);
	const profileModal = ref(false);
	const editingProfile = ref<ProviderProfile>();
	const subscriptions = new Map<string, () => void>();
	const { current: toastCurrent, showToast, dismissToast } = useToast();

	const selectedProject = computed(() =>
		data.value.projects.find(({ projectIdentifier }) => projectIdentifier === selectedProjectId.value),
	);
	const activeJobCount = computed(
		() =>
			data.value.jobs.filter(({ status }) => status === 'running' || status === 'queued' || status === 'cancelling')
				.length,
	);

	onMounted(load);
	onUnmounted(() => {
		for (const unsubscribe of subscriptions.values()) {
			unsubscribe();
		}
	});

	async function load(): Promise<void> {
		loading.value = data.value.projects.length === 0 && data.value.profiles.length === 0;
		loadError.value = '';
		try {
			data.value = await api.bootstrap();
			for (const job of data.value.jobs) {
				if (job.status === 'running' || job.status === 'queued' || job.status === 'cancelling') {
					watchJob(job.id);
				}
			}
			if (activeView.value === 'project' && !selectedProject.value) {
				activeView.value = 'dashboard';
			}
		} catch (reason: unknown) {
			loadError.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			loading.value = false;
		}
	}

	async function refresh(): Promise<void> {
		if (refreshing.value) {
			return;
		}
		refreshing.value = true;
		try {
			if (activeJobCount.value > 0) {
				const result = await api.jobs();
				data.value = { ...data.value, jobs: result.jobs };
				for (const job of result.jobs) {
					if (job.status === 'running' || job.status === 'queued' || job.status === 'cancelling') {
						watchJob(job.id);
					}
				}
			} else {
				await load();
			}
		} catch (reason: unknown) {
			showFailure(reason);
		} finally {
			refreshing.value = false;
		}
	}

	function navigate(view: View): void {
		activeView.value = view;
		mobileMenu.value = false;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function openProject(project: ProjectSummary): void {
		selectedProjectId.value = project.projectIdentifier;
		navigate('project');
	}

	function openSearch(project?: ProjectSummary): void {
		initialSearchProject.value = project?.projectIdentifier ?? selectedProjectId.value;
		navigate('search');
	}

	function openProfile(profile?: ProviderProfile): void {
		editingProfile.value = profile;
		profileModal.value = true;
	}

	function watchJob(id: string): void {
		if (subscriptions.has(id)) {
			return;
		}
		let polling = false;
		const stopEvents = subscribeToJob(id, (event) => {
			const value = event as { job?: IndexingJob };
			if (value.job) {
				receiveJob(value.job);
			}
		});
		const poll = window.setInterval(() => {
			if (polling) {
				return;
			}
			polling = true;
			void api
				.job(id)
				.then(receiveJob)
				.catch(() => {
					// The event stream remains the primary transport. A later poll
					// can recover if this lightweight fallback request fails.
				})
				.finally(() => {
					polling = false;
				});
		}, 2_000);
		subscriptions.set(id, () => {
			stopEvents();
			window.clearInterval(poll);
		});
	}

	function jobStarted(job: IndexingJob): void {
		data.value = { ...data.value, jobs: [job, ...data.value.jobs] };
		indexModal.value = false;
		watchJob(job.id);
		showToast('success', 'Indexing started. You can keep using the UI while it runs.');
		navigate('dashboard');
	}

	async function cancelJob(id: string): Promise<void> {
		try {
			const cancelled = await api.cancelJob(id);
			updateJob(cancelled);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function recoverBuild(indexBuildId: string): Promise<void> {
		if (
			!window.confirm(
				'Clean up this unfinished build? This does not remove the project or start a new build. Continue only if no other Scribes process is indexing this project.',
			)
		) {
			return;
		}
		try {
			await api.deleteInterruptedBuild(indexBuildId);
			await load();
			showToast('success', 'The unfinished build was cleaned up. No new build was started.');
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function recoverProjectBuilds(): Promise<void> {
		const project = selectedProject.value;
		if (!project) {
			return;
		}
		if (
			!window.confirm(
				`Clean up ${project.buildsByStatus.building} unfinished build(s)? This does not remove the project or start indexing. Continue only if no other Scribes process is indexing it.`,
			)
		) {
			return;
		}
		try {
			const result = await api.deleteProjectInterruptedBuilds(project.projectIdentifier);
			await load();
			showToast(
				'success',
				result.count === 0
					? 'No unfinished builds remained.'
					: `${result.count} unfinished build(s) cleaned up. No new build was started.`,
			);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	function updateJob(job: IndexingJob): void {
		const index = data.value.jobs.findIndex(({ id }) => id === job.id);
		const jobs = [...data.value.jobs];
		if (index === -1) {
			jobs.unshift(job);
		} else {
			jobs[index] = job;
		}
		data.value = { ...data.value, jobs };
	}

	function receiveJob(job: IndexingJob): void {
		updateJob(job);
		if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
			return;
		}
		const stop = subscriptions.get(job.id);
		if (stop === undefined) {
			return;
		}
		stop();
		subscriptions.delete(job.id);
		showToast(
			job.status === 'completed' ? 'success' : 'danger',
			job.status === 'completed'
				? `${job.label} was indexed successfully.`
				: (job.error?.message ?? `Indexing ${job.status}.`),
		);
		void load();
	}

	async function profileSaved(profile: ProviderProfile): Promise<void> {
		profileModal.value = false;
		editingProfile.value = undefined;
		await load();
		showToast('success', `Profile ${profile.name} was saved.`);
	}

	async function testProfile(profile: ProviderProfile): Promise<void> {
		showToast('success', `Testing ${profile.name} against LM Studio…`);
		try {
			const result = await api.testProfile(profile.name);
			const reranking = result.reranking ? ` Reranker score: ${result.reranking.score.toFixed(3)}.` : '';
			showToast('success', `${result.embedding.model} returned ${result.embedding.dimensions} dimensions.${reranking}`);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function removeProfile(profile: ProviderProfile): Promise<void> {
		if (
			!window.confirm(
				`Delete provider profile "${profile.name}"? Existing recipes that refer to it will need another profile.`,
			)
		) {
			return;
		}
		try {
			await api.deleteProfile(profile.name);
			await load();
			showToast('success', `Profile ${profile.name} was deleted.`);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function reindexProject(): Promise<void> {
		if (!selectedProject.value) {
			return;
		}
		try {
			const job = await api.reindex(selectedProject.value.projectIdentifier);
			jobStarted(job);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function activateTarget(target: string): Promise<void> {
		if (!selectedProject.value) {
			return;
		}
		try {
			await api.activateTarget(selectedProject.value.projectIdentifier, target);
			await load();
			showToast('success', `Retrieval switched to ${target}.`);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function renameTarget(target: string, name: string): Promise<void> {
		if (!selectedProject.value) {
			return;
		}
		try {
			await api.renameTarget(selectedProject.value.projectIdentifier, target, name);
			await load();
			showToast('success', `Target ${target} was renamed to ${name}.`);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	async function removeProject(): Promise<void> {
		const project = selectedProject.value;
		if (!project) {
			return;
		}
		const label = project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier;
		if (!window.confirm(`Delete the managed index for "${label}"? The source project will not be changed.`)) {
			return;
		}
		try {
			await api.deleteProject(project.projectIdentifier);
			selectedProjectId.value = '';
			await load();
			navigate('dashboard');
			showToast('success', `The local index for ${label} was deleted.`);
		} catch (reason: unknown) {
			showFailure(reason);
		}
	}

	function showFailure(reason: unknown): void {
		showToast('danger', reason instanceof Error ? reason.message : String(reason));
	}
</script>

<style scoped>
	.app-shell {
		min-height: 100vh;
	}

	.sidebar {
		position: fixed;
		z-index: var(--z-sidebar);
		inset: 0 auto 0 0;
		display: flex;
		width: 264px;
		flex-direction: column;
		color: #c8d3e2;
		background: var(--navy);
		border-right: 1px solid #24344d;
	}

	.brand {
		display: flex;
		min-height: 78px;
		align-items: center;
		gap: 12px;
		padding: 0 22px;
		border-bottom: 1px solid #24344d;
	}

	.brand__mark {
		display: grid;
		width: 40px;
		height: 40px;
		place-items: center;
		color: white;
		background: var(--cobalt);
		border-radius: 9px 3px 9px 3px;
	}

	.brand div {
		display: flex;
		min-width: 0;
		flex-direction: column;
	}

	.brand strong {
		color: white;
		font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
		font-size: 1.13rem;
		letter-spacing: 0.01em;
	}

	.brand small {
		color: #8393a9;
		font-size: 0.69rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.sidebar__close {
		display: none !important;
		margin-left: auto;
		color: white !important;
	}

	.nav-list {
		display: grid;
		gap: 4px;
		padding: 20px 12px;
	}

	.nav-list button,
	.project-link {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 11px;
		padding: 10px 12px;
		color: #aebbd0;
		background: transparent;
		border: 0;
		border-radius: 6px;
		font-size: 0.84rem;
		text-align: left;
	}

	.nav-list button:hover,
	.project-link:hover {
		color: white;
		background: #172842;
	}

	.nav-list button.active,
	.project-link.active {
		color: white;
		background: #203654;
	}

	.nav-list button.active {
		box-shadow: inset 3px 0 var(--cobalt);
	}

	.sidebar__section {
		min-height: 0;
		padding: 8px 12px;
		overflow: auto;
		border-top: 1px solid #24344d;
	}

	.sidebar__section > p {
		margin: 10px 12px 8px;
		color: #71829a;
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.13em;
	}

	.project-link {
		gap: 9px;
		padding-block: 8px;
		font-size: 0.78rem;
	}

	.project-link span {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-link i {
		width: 6px;
		height: 6px;
		background: #54c9b9;
		border-radius: 50%;
	}

	.sidebar__empty {
		display: block;
		padding: 9px 12px;
		color: #61728a;
		font-size: 0.78rem;
	}

	.sidebar__bottom {
		display: grid;
		gap: 14px;
		margin-top: auto;
		padding: 18px;
		border-top: 1px solid #24344d;
	}

	.sidebar-index {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 14px;
		color: white;
		background: var(--cobalt);
		border: 0;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.local-status {
		display: flex;
		align-items: center;
		gap: 7px;
		color: #71829a;
		font-size: 0.68rem;
	}

	.local-status span,
	.topbar__status i {
		width: 7px;
		height: 7px;
		background: #42b9a9;
		border-radius: 50%;
	}

	.workspace {
		min-height: 100vh;
		margin-left: 264px;
		background: var(--canvas);
	}

	.topbar {
		position: sticky;
		z-index: var(--z-topbar);
		top: 0;
		display: flex;
		height: 56px;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 0 28px;
		background: rgba(245, 243, 237, 0.94);
		border-bottom: 1px solid var(--line);
		backdrop-filter: blur(12px);
	}

	.topbar__status span {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
	}

	.mobile-menu {
		display: none !important;
		margin-right: auto;
	}

	.app-loading,
	.app-error {
		display: grid;
		min-height: calc(100vh - 56px);
		place-items: center;
		align-content: center;
		gap: 10px;
		padding: 30px;
		color: var(--muted);
		text-align: center;
	}

	.app-loading p {
		font-size: 0.78rem;
	}

	.app-error h1 {
		font-size: 2rem;
	}

	.app-error p {
		max-width: 600px;
	}

	@media (max-width: 800px) {
		.sidebar {
			transform: translateX(-100%);
			transition: transform 180ms ease;
		}

		.sidebar--open {
			transform: translateX(0);
		}

		.sidebar__close,
		.mobile-menu {
			display: grid !important;
		}

		.sidebar-scrim {
			position: fixed;
			z-index: var(--z-overlay);
			inset: 0;
			background: rgba(8, 17, 31, 0.45);
		}

		.workspace {
			margin-left: 0;
		}

		.topbar {
			padding-inline: 16px;
		}
	}
</style>
