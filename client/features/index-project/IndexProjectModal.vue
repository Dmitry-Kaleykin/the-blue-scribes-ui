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
			<label class="field">
				<span>Project directory</span>
				<div class="input-with-icon">
					<FolderSearch :size="18" />
					<input
						v-model="form.root"
						required
						placeholder="/Users/you/Projects/application"
					/>
				</div>
				<small>Use an absolute path. The UI never uploads project files.</small>
			</label>

			<div class="form-grid form-grid--two">
				<label class="field">
					<span>Provider profile</span>
					<select
						v-model="form.profile"
						required
					>
						<option
							disabled
							value=""
						>
							Choose a profile
						</option>
						<option
							v-for="profile in profiles"
							:key="profile.name"
							:value="profile.name"
						>
							{{ profile.name }} · {{ profile.embedding.model }}
						</option>
					</select>
				</label>
				<label class="field">
					<span>Retrieval target <em>optional</em></span>
					<input
						v-model="form.target"
						placeholder="release128"
					/>
					<small>A friendly name for this branch or snapshot.</small>
				</label>
			</div>

			<div class="form-grid form-grid--three">
				<label class="field">
					<span>Chunk size</span>
					<input
						v-model.number="form.maximumChunkSize"
						min="1"
						required
						type="number"
					/>
				</label>
				<label class="field">
					<span>Older builds to keep</span>
					<input
						v-model.number="form.keepReplacedBuilds"
						min="0"
						required
						type="number"
					/>
				</label>
				<label class="check-field check-field--compact">
					<input
						v-model="form.windows1251"
						type="checkbox"
					/>
					<span>
						<strong>Windows-1251 fallback</strong>
						<small>UTF-8 remains preferred.</small>
					</span>
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
				<div class="form-grid form-grid--two">
					<label class="field">
						<span>Include patterns</span>
						<textarea
							v-model="form.include"
							rows="4"
							placeholder="src/**&#10;design/**"
						/>
						<small>One glob per line.</small>
					</label>
					<label class="field">
						<span>Exclude patterns</span>
						<textarea
							v-model="form.exclude"
							rows="4"
							placeholder="vendor/**&#10;dist/**"
						/>
						<small>Applied in addition to normal ignore policy.</small>
					</label>
				</div>
			</div>

			<p
				v-if="profiles.length === 0"
				class="feedback feedback--warning"
			>
				Create a provider profile before starting an index.
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
	import { computed, reactive, ref } from 'vue';
	import { FolderSearch, LoaderCircle } from '@lucide/vue';

	import type { IndexProjectInput, IndexingJob, ProviderProfile } from '../../../shared/contracts';
	import { api } from '../../shared/api/client';
	import BaseModal from '../../shared/components/BaseModal.vue';

	const props = defineProps<{
		profiles: readonly ProviderProfile[];
	}>();

	const emit = defineEmits<{
		close: [];
		started: [job: IndexingJob];
	}>();

	const form = reactive({
		root: '',
		profile: props.profiles[0]?.name ?? '',
		target: '',
		keepReplacedBuilds: 1,
		maximumChunkSize: 3000,
		windows1251: false,
		allowDirty: false,
		include: '',
		exclude: '',
	});
	const advanced = ref(false);
	const submitting = ref(false);
	const error = ref('');

	const canSubmit = computed(() => form.root.trim().length > 0 && form.profile.length > 0 && !submitting.value);

	function lines(value: string): string[] | undefined {
		const items = value
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
		return items.length === 0 ? undefined : items;
	}

	async function submit(): Promise<void> {
		submitting.value = true;
		error.value = '';
		try {
			const input: IndexProjectInput = {
				root: form.root.trim(),
				profile: form.profile,
				keepReplacedBuilds: form.keepReplacedBuilds,
				maximumChunkSize: form.maximumChunkSize,
				...(form.target.trim() ? { target: form.target.trim() } : {}),
				...(form.windows1251 ? { windows1251: true } : {}),
				...(form.allowDirty ? { allowDirty: true } : {}),
				...(lines(form.include) === undefined ? {} : { include: lines(form.include) }),
				...(lines(form.exclude) === undefined ? {} : { exclude: lines(form.exclude) }),
			};
			emit('started', await api.startIndex(input));
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			submitting.value = false;
		}
	}
</script>
