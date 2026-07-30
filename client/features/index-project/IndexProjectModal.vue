<template>
	<BaseModal
		title="Index a project"
		description="Create a reusable indexing recipe and start the build in the background."
		wide
		@close="emit('close')"
	>
		<form
			class="form-stack"
			@submit.prevent="submit"
		>
			<label
				v-if="projects.length > 0"
				class="field"
			>
				<span>Known project <em>optional</em></span>
				<select v-model="form.projectIdentifier">
					<option value="">New or unregistered project</option>
					<option
						v-for="project in projects"
						:key="project.projectIdentifier"
						:value="project.projectIdentifier"
					>
						{{ projectName(project) }}
					</option>
				</select>
				<small>Selecting a project limits the target list to that project.</small>
			</label>

			<label class="field">
				<span>Project directory</span>
				<div class="input-with-icon">
					<FolderSearch :size="18" />
					<input
						v-model="form.root"
						required
						placeholder="/Users/you/Projects/application"
						:disabled="selectedProject !== undefined"
					/>
				</div>
				<small>Use an absolute path. The UI never uploads project files.</small>
			</label>

			<div class="form-grid form-grid--two">
				<label class="field">
					<span>Indexing preset</span>
					<select
						v-model="form.preset"
						required
					>
						<option
							disabled
							value=""
						>
							Choose a preset
						</option>
						<option
							v-for="preset in presets"
							:key="preset.name"
							:value="preset.name"
						>
							{{ preset.name }} · {{ preset.providerProfile }}
						</option>
					</select>
				</label>
				<label class="field">
					<span>Retrieval target <em>optional</em></span>
					<select
						v-if="selectedProject && selectedProject.targets.length > 0"
						v-model="form.targetChoice"
					>
						<option value="">No named target</option>
						<option
							v-for="target in selectedProject.targets"
							:key="target.name"
							:value="target.name"
						>
							{{ target.name }}{{ target.active ? ' · active' : '' }}
						</option>
						<option value="__new__">Create a new target…</option>
					</select>
					<input
						v-else
						v-model="form.newTarget"
						placeholder="release128"
					/>
					<small v-if="selectedProject">Only targets owned by {{ projectName(selectedProject) }} are listed.</small>
					<small v-else>A friendly name for this branch or snapshot.</small>
				</label>
			</div>

			<label
				v-if="selectedProject && form.targetChoice === '__new__'"
				class="field"
			>
				<span>New retrieval target</span>
				<input
					v-model="form.newTarget"
					required
					placeholder="feature-branch"
				/>
			</label>

			<div class="form-grid">
				<label class="field">
					<span>Older builds to keep</span>
					<input
						v-model.number="form.keepReplacedBuilds"
						min="0"
						required
						type="number"
					/>
				</label>
			</div>

			<button
				class="disclosure"
				type="button"
				@click="advanced = !advanced"
			>
				{{ advanced ? 'Hide advanced options' : 'Advanced options' }}
			</button>

			<div
				v-if="advanced"
				class="form-section"
			>
				<label class="check-field">
					<input
						v-model="form.allowDirty"
						type="checkbox"
					/>
					<span>
						<strong>Allow a dirty Git working tree</strong>
						<small>Useful for local experiments; the recipe remembers this choice.</small>
					</span>
				</label>
			</div>

			<p
				v-if="presets.length === 0"
				class="feedback feedback--warning"
			>
				Create an indexing preset before starting an index.
			</p>
			<p
				v-if="error"
				class="feedback feedback--danger"
			>
				{{ error }}
			</p>

			<footer class="form-actions">
				<span class="form-actions__spacer" />
				<button
					class="button button--ghost"
					type="button"
					@click="emit('close')"
				>
					Cancel
				</button>
				<button
					class="button button--primary"
					type="submit"
					:disabled="!canSubmit"
				>
					<LoaderCircle
						v-if="submitting"
						class="spin"
						:size="16"
					/>
					{{ submitting ? 'Starting…' : 'Start indexing' }}
				</button>
			</footer>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
	import { computed, reactive, ref, watch } from 'vue';
	import { FolderSearch, LoaderCircle } from '@lucide/vue';

	import type { IndexingJob, IndexingPreset, IndexProjectInput, ProjectSummary } from '../../../shared/contracts';
	import { api } from '../../shared/api/client';
	import BaseModal from '../../shared/components/BaseModal.vue';

	const props = defineProps<{
		presets: readonly IndexingPreset[];
		projects: readonly ProjectSummary[];
	}>();

	const emit = defineEmits<{
		close: [];
		started: [job: IndexingJob];
	}>();

	const form = reactive({
		projectIdentifier: '',
		root: '',
		preset: props.presets[0]?.name ?? '',
		targetChoice: '__new__',
		newTarget: '',
		keepReplacedBuilds: 1,
		allowDirty: false,
	});
	const advanced = ref(false);
	const submitting = ref(false);
	const error = ref('');

	const selectedProject = computed(() =>
		props.projects.find(({ projectIdentifier }) => projectIdentifier === form.projectIdentifier),
	);
	const target = computed(() => (form.targetChoice === '__new__' ? form.newTarget.trim() : form.targetChoice));
	const canSubmit = computed(() => form.root.trim().length > 0 && form.preset.length > 0 && !submitting.value);

	watch(selectedProject, (project) => {
		if (project === undefined) {
			form.root = '';
			form.targetChoice = '__new__';
			form.newTarget = '';
			return;
		}
		form.root = project.root ?? '';
		const preferredTarget = project.active?.target ?? project.recipe?.target ?? project.targets[0]?.name;
		form.targetChoice = preferredTarget ?? '__new__';
		form.newTarget = '';
	});

	async function submit(): Promise<void> {
		submitting.value = true;
		error.value = '';
		try {
			const input: IndexProjectInput = {
				root: form.root.trim(),
				preset: form.preset,
				keepReplacedBuilds: form.keepReplacedBuilds,
				...(target.value ? { target: target.value } : {}),
				...(form.allowDirty ? { allowDirty: true } : {}),
			};
			emit('started', await api.startIndex(input));
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			submitting.value = false;
		}
	}

	function projectName(project: ProjectSummary): string {
		return project.root?.split('/').filter(Boolean).at(-1) ?? project.projectIdentifier;
	}
</script>
