<script setup lang="ts">
	import { computed, reactive, ref, watch } from 'vue'
	import { Braces, ChevronDown, ChevronUp, FileCode2, LoaderCircle, Search, SlidersHorizontal } from '@lucide/vue'

	import type { ProjectSummary, ProviderProfile, SearchResponse } from '../../../shared/contracts'
	import { api } from '../../shared/api/client'
	const props = defineProps<{
		projects: readonly ProjectSummary[]
		profiles: readonly ProviderProfile[]
		initialProject?: string
	}>()

	const form = reactive({
		project: props.initialProject ?? props.projects[0]?.projectIdentifier ?? '',
		query: '',
		profile: '',
		limit: 10,
		language: '',
		reranking: false,
		rerankCandidates: 50,
		contextBefore: 1,
		contextAfter: 1,
		contextCharacters: 4000,
	})
	const advanced = ref(false)
	const searching = ref(false)
	const error = ref('')
	const response = ref<SearchResponse>()
	const expandedResults = ref(new Set<number>())

	watch(
		() => props.initialProject,
		(project) => {
			if (project) form.project = project
		},
	)

	const selectedProject = computed(() =>
		props.projects.find(({ projectIdentifier }) => projectIdentifier === form.project),
	)
	const effectiveProfile = computed(() => {
		const recipe = selectedProject.value?.recipe
		const name = form.profile || (recipe?.provider.type === 'profile' ? recipe.provider.profile : '')
		return props.profiles.find((profile) => profile.name === name)
	})
	const rerankingAvailable = computed(() => effectiveProfile.value?.reranking !== undefined)

	watch(
		() => [form.project, form.profile] as const,
		() => {
			form.reranking = rerankingAvailable.value
		},
		{ immediate: true },
	)

	function projectName(project: ProjectSummary): string {
		return project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier
	}

	async function submit(): Promise<void> {
		if (!form.project || !form.query.trim()) return
		searching.value = true
		error.value = ''
		response.value = undefined
		expandedResults.value = new Set()
		try {
			response.value = await api.search(form.project, {
				query: form.query.trim(),
				...(form.profile ? { profile: form.profile } : {}),
				limit: form.limit,
				...(form.language.trim() ? { language: form.language.trim() } : {}),
				reranking: form.reranking,
				...(form.reranking ? { rerankCandidates: form.rerankCandidates } : {}),
				contextBefore: form.contextBefore,
				contextAfter: form.contextAfter,
				contextCharacters: form.contextCharacters,
			})
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason)
		} finally {
			searching.value = false
		}
	}

	function toggleResult(index: number): void {
		const next = new Set(expandedResults.value)
		if (next.has(index)) next.delete(index)
		else next.add(index)
		expandedResults.value = next
	}

	function score(value: number | undefined): string {
		return value === undefined ? '—' : value.toFixed(3)
	}
</script>

<template>
	<main class="page">
		<header class="page-header">
			<p class="eyebrow">Retrieval workbench</p>
			<h1>Search an index</h1>
			<p class="page-lead">
				Ask a question, compare semantic and reranking scores, and inspect the exact source context.
			</p>
		</header>

		<section class="search-panel">
			<form @submit.prevent="submit">
				<div class="search-panel__selectors">
					<label class="field">
						<span>Project</span>
						<select
							v-model="form.project"
							required
						>
							<option
								disabled
								value=""
							>
								Choose an indexed project
							</option>
							<option
								v-for="project in projects"
								:key="project.projectIdentifier"
								:value="project.projectIdentifier"
							>
								{{ projectName(project) }}{{ project.active?.target ? ` · ${project.active.target}` : '' }}
							</option>
						</select>
					</label>
					<label class="field">
						<span>Profile override <em>optional</em></span>
						<select v-model="form.profile">
							<option value="">Use project's recipe</option>
							<option
								v-for="profile in profiles"
								:key="profile.name"
								:value="profile.name"
							>
								{{ profile.name }}
							</option>
						</select>
					</label>
				</div>

				<label class="search-box">
					<Search :size="21" />
					<textarea
						v-model="form.query"
						required
						rows="2"
						placeholder="Where is the frontend API configured?"
						@keydown.meta.enter="submit"
						@keydown.ctrl.enter="submit"
					/>
					<button
						class="button button--primary"
						type="submit"
						:disabled="searching || !form.project"
					>
						<LoaderCircle
							v-if="searching"
							class="spin"
							:size="17"
						/>
						<Search
							v-else
							:size="17"
						/>
						{{ searching ? 'Searching…' : 'Search' }}
					</button>
				</label>
				<div class="search-panel__footer">
					<span
						v-if="selectedProject?.active"
						class="muted"
					>
						Searching
						{{ selectedProject.active.target ?? selectedProject.active.type }}
					</span>
					<span v-else />
					<button
						class="disclosure"
						type="button"
						@click="advanced = !advanced"
					>
						<SlidersHorizontal :size="15" />
						{{ advanced ? 'Hide retrieval controls' : 'Retrieval controls' }}
					</button>
				</div>

				<div
					v-if="advanced"
					class="advanced-search"
				>
					<label class="field">
						<span>Results</span>
						<input
							v-model.number="form.limit"
							min="1"
							type="number"
						/>
					</label>
					<label class="field">
						<span>Language filter</span>
						<input
							v-model="form.language"
							placeholder="typescript"
						/>
					</label>
					<label class="field">
						<span>Candidate pool</span>
						<input
							v-model.number="form.rerankCandidates"
							:disabled="!form.reranking"
							min="1"
							type="number"
						/>
					</label>
					<label class="field">
						<span>Context before</span>
						<input
							v-model.number="form.contextBefore"
							min="0"
							type="number"
						/>
					</label>
					<label class="field">
						<span>Context after</span>
						<input
							v-model.number="form.contextAfter"
							min="0"
							type="number"
						/>
					</label>
					<label class="field">
						<span>Context characters</span>
						<input
							v-model.number="form.contextCharacters"
							min="1"
							type="number"
						/>
					</label>
					<label class="check-field check-field--compact">
						<input
							v-model="form.reranking"
							:disabled="!rerankingAvailable"
							type="checkbox"
						/>
						<span>
							<strong>Local reranking</strong>
							<small>{{
								rerankingAvailable ? `Use ${effectiveProfile?.reranking?.model}.` : 'Choose a profile with a reranker.'
							}}</small>
						</span>
					</label>
				</div>
			</form>
		</section>

		<p
			v-if="error"
			class="feedback feedback--danger"
		>
			{{ error }}
		</p>

		<section
			v-if="response"
			class="content-section results-section"
		>
			<div class="section-heading">
				<div>
					<p class="eyebrow">Result set</p>
					<h2>{{ response.resultCount }} source matches</h2>
				</div>
				<code class="build-chip">{{ response.indexBuildId }}</code>
			</div>

			<div
				v-if="response.results.length > 0"
				class="result-list"
			>
				<article
					v-for="(result, index) in response.results"
					:key="`${result.path}:${result.range.startOffset}`"
					class="search-result"
				>
					<header>
						<span class="result-rank">{{ index + 1 }}</span>
						<div class="search-result__identity">
							<h3><FileCode2 :size="17" /> {{ result.path }}</h3>
							<p>
								Lines {{ result.range.startLine }}–{{ result.range.endLine }} ·
								{{ result.language }}
							</p>
						</div>
						<div class="score-set">
							<span
								><small>Final</small><strong>{{ score(result.score) }}</strong></span
							>
							<span
								><small>Semantic</small><strong>{{ score(result.semanticScore) }}</strong></span
							>
							<span v-if="result.rerankScore !== undefined"
								><small>Rerank</small><strong>{{ score(result.rerankScore) }}</strong></span
							>
						</div>
					</header>
					<pre><code>{{ result.content }}</code></pre>
					<footer v-if="result.context && (result.context.before.length > 0 || result.context.after.length > 0)">
						<button
							class="button button--ghost button--small"
							type="button"
							@click="toggleResult(index)"
						>
							<ChevronUp
								v-if="expandedResults.has(index)"
								:size="15"
							/>
							<ChevronDown
								v-else
								:size="15"
							/>
							{{ expandedResults.has(index) ? 'Hide neighboring chunks' : 'Show neighboring chunks' }}
						</button>
						<div
							v-if="expandedResults.has(index)"
							class="context-chunks"
						>
							<article
								v-for="chunk in result.context.before"
								:key="chunk.chunkId"
							>
								<span>Before · lines {{ chunk.range.startLine }}–{{ chunk.range.endLine }}</span>
								<pre><code>{{ chunk.content }}</code></pre>
							</article>
							<article
								v-for="chunk in result.context.after"
								:key="chunk.chunkId"
							>
								<span>After · lines {{ chunk.range.startLine }}–{{ chunk.range.endLine }}</span>
								<pre><code>{{ chunk.content }}</code></pre>
							</article>
						</div>
					</footer>
				</article>
			</div>
			<div
				v-else
				class="empty-state"
			>
				<span class="empty-state__mark"><Braces :size="30" /></span>
				<h3>No matching chunks</h3>
				<p>Try broader wording or remove the language filter.</p>
			</div>
		</section>
	</main>
</template>
