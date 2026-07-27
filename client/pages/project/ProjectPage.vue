<template>
	<main class="page">
		<button
			class="back-button"
			type="button"
			@click="emit('back')"
		>
			<ArrowLeft :size="17" /> All projects
		</button>
		<header class="project-hero">
			<span class="project-hero__mark"><FolderCode :size="27" /></span>
			<div>
				<p class="eyebrow">Indexed project</p>
				<h1>{{ name }}</h1>
				<p>{{ project.root ?? project.projectIdentifier }}</p>
			</div>
			<div class="project-hero__actions">
				<button
					class="button button--secondary"
					type="button"
					@click="emit('reindex')"
				>
					<RefreshCw :size="16" /> Reindex
				</button>
				<button
					class="button button--primary"
					type="button"
					@click="emit('search')"
				>
					<Search :size="16" /> Search
				</button>
			</div>
		</header>

		<section
			v-if="project.buildsByStatus.building > 0"
			class="interrupted-builds"
		>
			<AlertTriangle :size="20" />
			<div>
				<strong>Interrupted indexing build</strong>
				<p>
					{{ project.buildsByStatus.building }}
					{{ project.buildsByStatus.building === 1 ? 'build is' : 'builds are' }} still marked as running.
				</p>
			</div>
			<div class="interrupted-builds__actions">
				<button
					class="button button--secondary button--small"
					type="button"
					@click="emit('recoverInterrupted')"
				>
					<RotateCcw :size="15" />
					Remove interrupted build
				</button>
				<button
					class="button button--danger button--small"
					type="button"
					@click="emit('remove')"
				>
					<Trash2 :size="15" />
					Remove index
				</button>
			</div>
		</section>

		<section class="metric-grid metric-grid--three">
			<article class="metric-card">
				<span class="metric-card__icon"><Database :size="20" /></span>
				<div>
					<strong>{{ project.buildCount }}</strong
					><span>Total builds</span>
				</div>
			</article>
			<article class="metric-card">
				<span class="metric-card__icon metric-card__icon--teal"><GitBranch :size="20" /></span>
				<div>
					<strong>{{ project.targets.length }}</strong
					><span>Retrieval targets</span>
				</div>
			</article>
			<article class="metric-card">
				<span class="metric-card__icon metric-card__icon--sand"><TerminalSquare :size="20" /></span>
				<div>
					<strong>{{ recipeProfile ?? 'inline' }}</strong
					><span>Provider recipe</span>
				</div>
			</article>
		</section>

		<div class="detail-grid">
			<section class="surface">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Retrieval</p>
						<h2>Named targets</h2>
					</div>
					<StatusPill
						v-if="project.active"
						tone="success"
						:label="`Active: ${project.active.target ?? project.active.type}`"
					/>
				</div>
				<div
					v-if="project.targets.length > 0"
					class="target-list"
				>
					<article
						v-for="target in project.targets"
						:key="target.name"
						class="target-row"
					>
						<span class="target-row__branch"><GitBranch :size="17" /></span>
						<div
							v-if="editingTarget !== target.name"
							class="target-row__identity"
						>
							<strong>{{ target.name }}</strong>
							<code>{{ target.indexBuildId }}</code>
						</div>
						<form
							v-else
							class="target-rename"
							@submit.prevent="saveTarget"
						>
							<input
								class="input-control"
								v-model="targetName"
								autofocus
								aria-label="New target name"
							/>
							<button
								class="icon-button"
								type="submit"
								aria-label="Save target name"
							>
								<Check :size="16" />
							</button>
						</form>
						<StatusPill
							v-if="target.active"
							tone="success"
							label="active"
						/>
						<button
							v-else
							class="button button--ghost button--small"
							type="button"
							@click="emit('activate', target.name)"
						>
							Activate
						</button>
						<button
							class="icon-button"
							type="button"
							aria-label="Rename target"
							@click="editTarget(target.name)"
						>
							<Pencil :size="16" />
						</button>
					</article>
				</div>
				<p
					v-else
					class="muted"
				>
					This project has no named targets yet.
				</p>
			</section>

			<section class="surface">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Indexing recipe</p>
						<h2>Saved defaults</h2>
					</div>
				</div>
				<dl
					v-if="project.recipe"
					class="definition-list definition-list--wide"
				>
					<div>
						<dt>Profile</dt>
						<dd>{{ recipeProfile ?? 'Inline provider' }}</dd>
					</div>
					<div>
						<dt>Target</dt>
						<dd>{{ project.recipe.target ?? 'automatic' }}</dd>
					</div>
					<div>
						<dt>Chunk size</dt>
						<dd>{{ project.recipe.maximumChunkSize ?? 'default' }}</dd>
					</div>
					<div>
						<dt>Windows-1251</dt>
						<dd>{{ project.recipe.windows1251 ? 'enabled' : 'disabled' }}</dd>
					</div>
					<div>
						<dt>Retained old builds</dt>
						<dd>{{ project.recipe.keepReplacedBuilds }}</dd>
					</div>
					<div>
						<dt>Updated</dt>
						<dd>{{ formatDate(project.recipe.updatedAt) }}</dd>
					</div>
				</dl>
				<p
					v-else
					class="muted"
				>
					This index predates saved recipes. Reindex from the CLI once to create one.
				</p>
			</section>
		</div>

		<section class="surface mcp-section">
			<div class="section-heading">
				<div>
					<p class="eyebrow">IDE integration</p>
					<h2>Cline MCP configuration</h2>
					<p class="muted">
						A minimal read-only server that exposes only
						<code>search_project</code>.
					</p>
				</div>
				<button
					class="button button--secondary"
					type="button"
					@click="copyConfig"
				>
					<Check
						v-if="copied"
						:size="16"
					/>
					<Clipboard
						v-else
						:size="16"
					/>
					{{ copied ? 'Copied' : 'Copy JSON' }}
				</button>
			</div>
			<pre class="config-block code-block"><code>{{ mcpConfig }}</code></pre>
		</section>

		<section class="danger-zone">
			<div>
				<h2>Remove local index</h2>
				<p>Delete this project's managed database, builds, targets, and recipe. Source files are never touched.</p>
			</div>
			<button
				class="button button--danger"
				type="button"
				@click="emit('remove')"
			>
				<Trash2 :size="16" /> Delete index
			</button>
		</section>
	</main>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import {
		AlertTriangle,
		ArrowLeft,
		Check,
		Clipboard,
		Database,
		FolderCode,
		GitBranch,
		Pencil,
		RefreshCw,
		RotateCcw,
		Search,
		TerminalSquare,
		Trash2,
	} from '@lucide/vue';

	import type { ProjectSummary } from '../../../shared/contracts';
	import StatusPill from '../../shared/components/StatusPill.vue';

	const props = defineProps<{
		project: ProjectSummary;
		mcpCommand?: string;
	}>();

	const emit = defineEmits<{
		back: [];
		search: [];
		reindex: [];
		activate: [target: string];
		rename: [target: string, name: string];
		remove: [];
		recoverInterrupted: [];
	}>();

	const copied = ref(false);
	const editingTarget = ref('');
	const targetName = ref('');

	const name = computed(() => props.project.root?.split('/').filter(Boolean).at(-1) ?? props.project.projectIdentifier);
	const recipeProfile = computed(() => {
		const provider = props.project.recipe?.provider;
		return provider?.type === 'profile' ? provider.profile : undefined;
	});
	const mcpConfig = computed(() =>
		JSON.stringify(
			{
				'the-blue-scribes': {
					autoApprove: ['search_project'],
					disabled: false,
					timeout: 120,
					type: 'stdio',
					command: props.mcpCommand ?? 'scribes-mcp',
					args: [
						'--project',
						props.project.root ?? props.project.projectIdentifier,
						...(recipeProfile.value ? ['--profile', recipeProfile.value] : []),
						'--tools',
						'search_project',
					],
				},
			},
			null,
			2,
		),
	);

	function editTarget(target: string): void {
		editingTarget.value = target;
		targetName.value = target;
	}

	function saveTarget(): void {
		const next = targetName.value.trim();
		if (!editingTarget.value || !next || next === editingTarget.value) {
			editingTarget.value = '';
			return;
		}
		emit('rename', editingTarget.value, next);
		editingTarget.value = '';
	}

	async function copyConfig(): Promise<void> {
		await navigator.clipboard.writeText(mcpConfig.value);
		copied.value = true;
		setTimeout(() => {
			copied.value = false;
		}, 1800);
	}

	function formatDate(value?: string): string {
		if (!value) {
			return '—';
		}
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(value));
	}
</script>

<style scoped>
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 21px;
		padding: 0;
		color: var(--muted);
		background: transparent;
		border: 0;
		font-size: 0.74rem;
	}

	.project-hero {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 30px;
	}

	.project-hero__mark {
		display: grid;
		width: 54px;
		height: 54px;
		flex: 0 0 auto;
		place-items: center;
		color: white;
		background: var(--cobalt);
		border-radius: 9px;
	}

	.project-hero h1 {
		margin-bottom: 2px;
		font-size: 2.45rem;
	}

	.project-hero p:last-child {
		margin: 0;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.project-hero__actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.interrupted-builds {
		display: flex;
		align-items: center;
		gap: 13px;
		margin-bottom: 20px;
		padding: 14px 16px;
		color: #7a561c;
		background: var(--amber-pale);
		border: 1px solid #e8d5ac;
		border-radius: 8px;
	}

	.interrupted-builds div {
		flex: 1;
	}

	.interrupted-builds strong {
		display: block;
		font-size: 0.78rem;
	}

	.interrupted-builds p {
		margin: 2px 0 0;
		font-size: 0.68rem;
	}

	.interrupted-builds__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1.3fr 0.9fr;
		gap: 15px;
		margin-top: 26px;
	}

	.surface {
		padding: 20px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 9px;
	}

	.target-list {
		display: grid;
		gap: 1px;
	}

	.target-row {
		display: flex;
		min-height: 56px;
		align-items: center;
		gap: 10px;
		padding: 9px 0;
		border-top: 1px solid #e7e6e0;
	}

	.target-row__branch {
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		color: var(--cobalt);
		background: var(--cobalt-pale);
		border-radius: 5px;
	}

	.target-row__identity {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
	}

	.target-row__identity strong {
		color: var(--ink);
		font-size: 0.76rem;
	}

	.target-row__identity code {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.55rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.target-rename {
		display: flex;
		min-width: 0;
		flex: 1;
	}

	.mcp-section {
		margin-top: 15px;
	}

	.config-block {
		max-height: 390px;
		padding: 18px;
		border-radius: 6px;
	}

	.danger-zone {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 28px;
		padding: 18px 20px;
		background: var(--danger-pale);
		border: 1px solid #efcaca;
		border-radius: 8px;
	}

	.danger-zone h2 {
		margin-bottom: 3px;
		color: #8e3030;
	}

	.danger-zone p {
		margin: 0;
		color: #9a5959;
		font-size: 0.7rem;
	}

	@media (max-width: 800px) {
		.project-hero {
			align-items: flex-start;
			flex-wrap: wrap;
		}

		.project-hero__actions {
			width: 100%;
			margin-left: 0;
		}

		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 620px) {
		.project-hero h1 {
			font-size: 2rem;
		}

		.project-hero__actions .button {
			flex: 1;
		}

		.danger-zone {
			align-items: stretch;
			flex-direction: column;
		}

		.interrupted-builds {
			align-items: flex-start;
			flex-wrap: wrap;
		}
	}
</style>
