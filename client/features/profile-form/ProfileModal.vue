<template>
	<BaseModal
		:title="profile ? `Edit ${profile.name}` : 'New provider profile'"
		description="Configure reusable embedding and reranking inference."
		wide
		@close="emit('close')"
	>
		<form
			class="form-stack"
			@submit.prevent="save"
		>
			<div class="form-grid form-grid--two">
				<label class="field">
					<span>Profile name</span>
					<input
						v-model="form.name"
						required
						placeholder="local-qwen"
						:disabled="profile !== undefined"
					/>
					<small v-if="profile">Profile names are stable identifiers.</small>
				</label>
				<label class="field">
					<span>LM Studio base URL</span>
					<input
						v-model="form.baseUrl"
						placeholder="http://127.0.0.1:1234/v1"
					/>
				</label>
			</div>

			<div class="form-section">
				<div class="section-heading section-heading--compact">
					<div>
						<p class="eyebrow">Embedding</p>
						<h3>Retrieval model</h3>
					</div>
					<button
						class="button button--secondary button--small"
						type="button"
						:disabled="loadingModels"
						@click="discoverModels"
					>
						<LoaderCircle
							v-if="loadingModels"
							class="spin"
							:size="15"
						/>
						<RefreshCw
							v-else
							:size="15"
						/>
						Discover models
					</button>
				</div>
				<div class="form-grid form-grid--two">
					<label class="field">
						<span>Model identifier</span>
						<input
							v-model="form.model"
							required
							list="lm-models"
							placeholder="text-embedding-qwen3-embedding-0.6b"
						/>
						<datalist id="lm-models">
							<option
								v-for="model in models"
								:key="model.id"
								:value="model.id"
							/>
						</datalist>
					</label>
					<label class="field">
						<span>Maximum inputs per request</span>
						<input
							v-model.number="form.maximumInputs"
							required
							min="1"
							type="number"
						/>
					</label>
				</div>
				<div class="form-grid form-grid--two">
					<label class="check-field">
						<input
							v-model="form.detectDimensions"
							type="checkbox"
						/>
						<span>
							<strong>Detect dimensions automatically</strong>
							<small>Tests the embedding endpoint when this profile is saved.</small>
						</span>
					</label>
					<label class="field">
						<span>Dimensions</span>
						<input
							v-model.number="form.dimensions"
							:disabled="form.detectDimensions"
							min="1"
							type="number"
						/>
					</label>
				</div>
				<label class="field">
					<span>Embedding suffix <em>optional</em></span>
					<input
						v-model="form.embeddingSuffix"
						placeholder="<|endoftext|>"
					/>
					<small>Leave empty unless the model's tokenizer explicitly needs a suffix.</small>
				</label>
			</div>

			<div class="form-section">
				<p class="eyebrow">Reranking</p>
				<h3>Local reranker <span class="muted-inline">optional</span></h3>
				<div class="form-grid form-grid--two">
					<label class="field">
						<span>Reranking model</span>
						<input
							v-model="form.rerankingModel"
							list="lm-models"
							placeholder="qwen3-reranker-0.6b"
						/>
					</label>
					<label class="field">
						<span>Instruction</span>
						<input
							v-model="form.rerankingInstruction"
							placeholder="Retrieve relevant source code"
						/>
					</label>
				</div>
			</div>

			<p
				v-if="message"
				class="feedback feedback--success"
			>
				<CheckCircle2 :size="17" />
				{{ message }}
			</p>
			<p
				v-if="error"
				class="feedback feedback--danger"
			>
				{{ error }}
			</p>

			<footer class="form-actions">
				<button
					v-if="canTest"
					class="button button--secondary"
					type="button"
					:disabled="testing"
					@click="testSavedProfile"
				>
					<LoaderCircle
						v-if="testing"
						class="spin"
						:size="16"
					/>
					<Server
						v-else
						:size="16"
					/>
					Test saved profile
				</button>
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
					{{ saving ? 'Saving…' : 'Save profile' }}
				</button>
			</footer>
		</form>
	</BaseModal>
</template>

<script setup lang="ts">
	import { computed, reactive, ref } from 'vue';
	import { CheckCircle2, LoaderCircle, RefreshCw, Server } from '@lucide/vue';

	import type { ModelSummary, ProfileInput, ProviderProfile } from '../../../shared/contracts';
	import { api } from '../../shared/api/client';
	import BaseModal from '../../shared/components/BaseModal.vue';

	const props = defineProps<{
		profile?: ProviderProfile;
	}>();

	const emit = defineEmits<{
		close: [];
		saved: [profile: ProviderProfile];
	}>();

	const form = reactive({
		name: props.profile?.name ?? '',
		model: props.profile?.embedding.model ?? '',
		dimensions: props.profile?.embedding.dimensions ?? 1024,
		detectDimensions: props.profile === undefined,
		baseUrl: props.profile?.embedding.baseUrl ?? 'http://127.0.0.1:1234/v1',
		maximumInputs: props.profile?.embedding.maximumInputs ?? 16,
		embeddingSuffix: props.profile?.embedding.embeddingSuffix ?? '',
		rerankingModel: props.profile?.reranking?.model ?? '',
		rerankingInstruction: props.profile?.reranking?.instruction ?? '',
	});
	const models = ref<readonly ModelSummary[]>([]);
	const loadingModels = ref(false);
	const saving = ref(false);
	const testing = ref(false);
	const message = ref('');
	const error = ref('');

	const canTest = computed(() => props.profile !== undefined && !saving.value);

	async function discoverModels(): Promise<void> {
		loadingModels.value = true;
		error.value = '';
		try {
			const response = await api.models(form.baseUrl.trim() || undefined);
			models.value = response.models;
			message.value = `${response.count} model${response.count === 1 ? '' : 's'} found in LM Studio.`;
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			loadingModels.value = false;
		}
	}

	async function save(): Promise<void> {
		saving.value = true;
		message.value = '';
		error.value = '';
		try {
			const input: ProfileInput = {
				name: form.name.trim(),
				model: form.model.trim(),
				detectDimensions: form.detectDimensions,
				...(form.detectDimensions ? {} : { dimensions: form.dimensions }),
				...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
				maximumInputs: form.maximumInputs,
				...(form.embeddingSuffix ? { embeddingSuffix: form.embeddingSuffix } : {}),
				...(form.rerankingModel.trim() ? { rerankingModel: form.rerankingModel.trim() } : {}),
				...(form.rerankingInstruction.trim() ? { rerankingInstruction: form.rerankingInstruction.trim() } : {}),
			};
			const saved = await api.saveProfile(input);
			emit('saved', saved);
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			saving.value = false;
		}
	}

	async function testSavedProfile(): Promise<void> {
		if (!props.profile) {
			return;
		}
		testing.value = true;
		message.value = '';
		error.value = '';
		try {
			const result = await api.testProfile(props.profile.name);
			message.value = result.reranking
				? `Embedding returned ${result.embedding.dimensions} dimensions; reranking score ${result.reranking.score.toFixed(3)}.`
				: `Embedding returned ${result.embedding.dimensions} dimensions.`;
		} catch (reason: unknown) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			testing.value = false;
		}
	}
</script>
