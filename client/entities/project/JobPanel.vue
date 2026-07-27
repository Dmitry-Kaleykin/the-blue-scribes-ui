<template>
	<article class="job-panel">
		<div
			class="job-panel__icon"
			:class="`job-panel__icon--${job.status}`"
		>
			<LoaderCircle
				v-if="job.status === 'running' || job.status === 'queued' || job.status === 'cancelling'"
				class="spin"
				:size="20"
			/>
			<CheckCircle2
				v-else-if="job.status === 'completed'"
				:size="20"
			/>
			<XCircle
				v-else-if="job.status === 'failed'"
				:size="20"
			/>
			<Ban
				v-else
				:size="20"
			/>
		</div>
		<div class="job-panel__body">
			<div class="job-panel__heading">
				<div>
					<strong>{{ job.label }}</strong>
					<p>{{ phase }}</p>
				</div>
				<StatusPill
					:label="job.status"
					:tone="statusTone"
				/>
			</div>
			<div
				v-if="job.status === 'running'"
				class="progress-track"
				:class="{ 'progress-track--indeterminate': percent === undefined }"
			>
				<span :style="percent === undefined ? undefined : { width: `${percent}%` }" />
			</div>
			<div
				v-if="job.progress"
				class="job-panel__details"
			>
				<span v-if="percent !== undefined">{{ percentLabel }}</span>
				<span v-if="job.progress.completed !== undefined && job.progress.total !== undefined">
					{{ job.progress.completed.toLocaleString() }} / {{ job.progress.total.toLocaleString() }} {{ progressUnit }}
				</span>
				<span v-else-if="job.progress.discoveredFiles !== undefined">
					{{ job.progress.discoveredFiles.toLocaleString() }} files discovered
				</span>
				<span v-if="job.progress.reusedEmbeddings !== undefined">
					{{ job.progress.reusedEmbeddings.toLocaleString() }} embeddings reused
				</span>
			</div>
			<p
				v-if="waitingForEmbeddingBatch"
				class="job-panel__waiting"
			>
				Waiting for the first embedding batch from LM Studio…
			</p>
			<p
				v-if="job.progress?.currentPath"
				class="job-panel__path"
			>
				<FileCode2 :size="14" />
				{{ job.progress.currentPath }}
			</p>
			<p
				v-if="job.error"
				class="feedback feedback--danger"
			>
				{{ job.error.message }}
			</p>
			<button
				v-if="interruptedBuildId"
				class="button button--secondary button--small job-panel__recovery"
				type="button"
				@click="emit('recover', interruptedBuildId)"
			>
				<Eraser :size="14" />
				Clean up unfinished build
			</button>
			<p
				v-if="job.result"
				class="job-panel__result"
			>
				Build <code>{{ job.result.indexBuildId }}</code>
			</p>
		</div>
		<button
			v-if="job.status === 'running' || job.status === 'queued'"
			class="button button--ghost button--small"
			type="button"
			@click="emit('cancel', job.id)"
		>
			Cancel
		</button>
	</article>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { Ban, CheckCircle2, Eraser, FileCode2, LoaderCircle, XCircle } from '@lucide/vue';

	import type { IndexingJob } from '../../../shared/contracts';
	import StatusPill from '../../shared/components/StatusPill.vue';

	const props = defineProps<{
		job: IndexingJob;
	}>();

	const emit = defineEmits<{
		cancel: [id: string];
		recover: [indexBuildId: string];
	}>();

	const percent = computed(() => {
		const completed = props.job.progress?.completed;
		const total = props.job.progress?.total;
		if (completed === undefined || total === undefined || total === 0) {
			return undefined;
		}
		return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
	});
	const percentLabel = computed(() => {
		if (percent.value === undefined) {
			return '';
		}
		if ((props.job.progress?.completed ?? 0) === 0) {
			return 'Starting…';
		}
		if (percent.value === 0 && (props.job.progress?.completed ?? 0) > 0) {
			return '<1%';
		}
		return `${percent.value}%`;
	});
	const progressUnit = computed(() => {
		switch (props.job.progress?.phase) {
			case 'discovery':
			case 'processing':
				return 'files';
			case 'embedding':
			case 'storage':
				return 'chunks';
			default:
				return 'items';
		}
	});
	const waitingForEmbeddingBatch = computed(
		() =>
			props.job.status === 'running' &&
			props.job.progress?.phase === 'embedding' &&
			props.job.progress.completed === 0 &&
			(props.job.progress.total ?? 0) > 0,
	);
	const interruptedBuildId = computed(() => {
		if (
			props.job.status !== 'failed' ||
			props.job.error?.code !== 'build-exists' ||
			props.job.error.details?.status !== 'building'
		) {
			return undefined;
		}
		const id = props.job.error.details.indexBuildId;
		return typeof id === 'string' ? id : undefined;
	});

	const statusTone = computed(
		() =>
			({
				queued: 'neutral',
				running: 'info',
				cancelling: 'warning',
				completed: 'success',
				failed: 'danger',
				cancelled: 'warning',
			})[props.job.status] as 'neutral' | 'info' | 'success' | 'danger' | 'warning',
	);

	const phase = computed(() => {
		if (props.job.status !== 'running') {
			return props.job.status;
		}
		return (
			{
				'source-inspection': 'Inspecting source',
				discovery: 'Discovering files',
				'preparing-build': 'Preparing index',
				processing: 'Processing files',
				embedding: 'Generating embeddings',
				storage: 'Storing embeddings',
				finalizing: 'Finalizing index',
				complete: 'Complete',
			}[props.job.progress?.phase ?? ''] ??
			props.job.progress?.phase?.replaceAll('-', ' ') ??
			props.job.status
		);
	});
</script>

<style scoped>
	.job-panel {
		display: flex;
		align-items: flex-start;
		gap: 13px;
		padding: 15px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 8px;
	}

	.job-panel__icon {
		display: grid;
		width: 38px;
		height: 38px;
		flex: 0 0 auto;
		place-items: center;
		color: var(--cobalt);
		background: var(--cobalt-pale);
		border-radius: 6px;
	}

	.job-panel__icon--completed {
		color: var(--teal);
		background: var(--teal-pale);
	}

	.job-panel__icon--failed {
		color: var(--danger);
		background: var(--danger-pale);
	}

	.job-panel__body {
		min-width: 0;
		flex: 1;
	}

	.job-panel__heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 15px;
	}

	.job-panel__heading strong {
		display: block;
		overflow: hidden;
		color: var(--ink);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.job-panel__heading p {
		margin: 1px 0 0;
		color: var(--muted);
		font-size: 0.66rem;
		text-transform: capitalize;
	}

	.progress-track {
		position: relative;
		height: 4px;
		margin: 11px 0 6px;
		overflow: hidden;
		background: #e9e8e2;
		border-radius: 4px;
	}

	.progress-track span {
		display: block;
		height: 100%;
		background: var(--cobalt);
		transition: width 180ms;
	}

	.progress-track--indeterminate span {
		width: 30%;
		animation: progress 1.4s ease-in-out infinite;
	}

	.job-panel__details {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		color: var(--faint);
		font-size: 0.62rem;
	}

	.job-panel__path {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 7px 0 0;
		overflow: hidden;
		color: var(--muted);
		font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
		font-size: 0.61rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.job-panel__waiting {
		margin: 7px 0 0;
		color: var(--muted);
		font-size: 0.64rem;
	}

	.job-panel__recovery {
		margin-top: 9px;
	}

	.job-panel__result {
		margin: 8px 0 0;
		color: var(--muted);
		font-size: 0.67rem;
	}

	@keyframes progress {
		0% {
			transform: translateX(-110%);
		}

		100% {
			transform: translateX(350%);
		}
	}
</style>
