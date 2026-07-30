<template>
	<BaseModal
		:title="preset ? `Edit ${preset.name}` : 'New indexing preset'"
		description="Combine a provider profile with reusable chunking, encoding, and file-selection settings."
		wide
		@close="emit('close')"
	>
		<form
			class="form-stack"
			@submit.prevent="save"
		>
			<div class="form-grid form-grid--two">
				<label class="field">
					<span>Preset name</span>
					<input
						v-model="form.name"
						required
						placeholder="legacy-web"
						:disabled="preset !== undefined"
					/>
					<small v-if="preset">Preset names are stable identifiers.</small>
				</label>
				<label class="field">
					<span>Provider profile</span>
					<select
						v-model="form.providerProfile"
						required
					>
						<option
							disabled
							value=""
						>
							Choose a provider
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
			</div>

			<div class="form-section">
				<p class="eyebrow">Chunking and encoding</p>
				<h3>Code processing</h3>
				<div class="form-grid form-grid--two">
					<label class="field">
						<span>Maximum chunk size</span>
						<input
							v-model.number="form.maximumChunkSize"
							min="1"
							required
							type="number"
						/>
						<small>Measured in UTF-16 code units.</small>
					</label>
					<label class="check-field">
						<input
							v-model="form.windows1251"
							type="checkbox"
						/>
						<span>
							<strong>Windows-1251 fallback</strong>
							<small>UTF-8 remains preferred when it is valid.</small>
						</span>
					</label>
				</div>
			</div>

			<div class="form-section">
				<p class="eyebrow">Discovery</p>
				<h3>File selection</h3>
				<div class="form-grid form-grid--two">
					<label class="field">
						<span>Include patterns <em>optional</em></span>
						<textarea
							v-model="form.include"
							rows="4"
							placeholder="src/**&#10;design/**"
						/>
						<small>One glob per line. Empty uses normal discovery.</small>
					</label>
					<label class="field">
						<span>Exclude patterns <em>optional</em></span>
						<textarea
							v-model="form.exclude"
							rows="4"
							placeholder="vendor/**&#10;dist/**"
						/>
						<small>Applied in addition to normal ignore rules.</small>
					</label>
				</div>
			</div>

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
					:disabled="saving"
				>
					<LoaderCircle
						v-if="saving"
						class="spin"
						:size="16"
					/>
					{{ saving ? 'Saving…' : 'Save preset' }}
				</button>
			</footer>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
	import { reactive, ref } from 'vue';
	import { LoaderCircle } from '@lucide/vue';

	import type { IndexingPreset, IndexingPresetInput, ProviderProfile } from '../../../shared/contracts';
	import { api } from '../../shared/api/client';
	import BaseModal from '../../shared/components/BaseModal.vue';

	const props = defineProps<{
		preset?: IndexingPreset;
		profiles: readonly ProviderProfile[];
	}>();

	const emit = defineEmits<{
		close: [];
		saved: [preset: IndexingPreset];
	}>();

	const form = reactive({
		name: props.preset?.name ?? '',
		providerProfile: props.preset?.providerProfile ?? props.profiles[0]?.name ?? '',
		maximumChunkSize: props.preset?.maximumChunkSize ?? 3000,
		windows1251: props.preset?.windows1251 ?? false,
		include: props.preset?.include?.join('\n') ?? '',
		exclude: props.preset?.exclude?.join('\n') ?? '',
	});
	const saving = ref(false);
	const error = ref('');

	function lines(value: string): string[] | undefined {
		const items = value
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
		return items.length === 0 ? undefined : items;
	}

	async function save(): Promise<void> {
		saving.value = true;
		error.value = '';
		try {
			const include = lines(form.include);
			const exclude = lines(form.exclude);
			const input: IndexingPresetInput = {
				name: form.name.trim(),
				providerProfile: form.providerProfile,
				maximumChunkSize: form.maximumChunkSize,
				...(form.windows1251 ? { windows1251: true } : {}),
				...(include === undefined ? {} : { include }),
				...(exclude === undefined ? {} : { exclude }),
			};
			emit('saved', await api.savePreset(input));
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			saving.value = false;
		}
	}
</script>
