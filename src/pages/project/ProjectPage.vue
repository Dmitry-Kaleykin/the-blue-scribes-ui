<script setup lang="ts">
	import { computed, ref } from 'vue'
	import {
		ArrowLeft,
		Check,
		Clipboard,
		Database,
		FolderCode,
		GitBranch,
		Pencil,
		RefreshCw,
		Search,
		TerminalSquare,
		Trash2,
	} from '@lucide/vue'

	import type { ProjectSummary } from '../../../shared/contracts'
	import StatusPill from '../../shared/components/StatusPill.vue'

	const props = defineProps<{
		project: ProjectSummary
		mcpCommand?: string
	}>()

	const emit = defineEmits<{
		back: []
		search: []
		reindex: []
		activate: [target: string]
		rename: [target: string, name: string]
		remove: []
	}>()

	const copied = ref(false)
	const editingTarget = ref('')
	const targetName = ref('')

	const name = computed(() => props.project.root?.split('/').filter(Boolean).at(-1) ?? props.project.projectIdentifier)
	const recipeProfile = computed(() => {
		const provider = props.project.recipe?.provider
		return provider?.type === 'profile' ? provider.profile : undefined
	})
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
	)

	function editTarget(target: string): void {
		editingTarget.value = target
		targetName.value = target
	}

	function saveTarget(): void {
		const next = targetName.value.trim()
		if (!editingTarget.value || !next || next === editingTarget.value) {
			editingTarget.value = ''
			return
		}
		emit('rename', editingTarget.value, next)
		editingTarget.value = ''
	}

	async function copyConfig(): Promise<void> {
		await navigator.clipboard.writeText(mcpConfig.value)
		copied.value = true
		setTimeout(() => {
			copied.value = false
		}, 1800)
	}

	function formatDate(value?: string): string {
		if (!value) return '—'
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(value))
	}
</script>

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
			<pre class="config-block"><code>{{ mcpConfig }}</code></pre>
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
