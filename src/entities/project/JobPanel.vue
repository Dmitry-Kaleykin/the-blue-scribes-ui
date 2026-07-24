<script setup lang="ts">
import { computed } from 'vue'
import { Ban, CheckCircle2, FileCode2, LoaderCircle, XCircle } from '@lucide/vue'

import type { IndexingJob } from '../../../shared/contracts'
import StatusPill from '../../shared/components/StatusPill.vue'

const props = defineProps<{
  job: IndexingJob
}>()

const emit = defineEmits<{
  cancel: [id: string]
}>()

const percent = computed(() => {
  const completed = props.job.progress?.completed
  const total = props.job.progress?.total
  if (completed === undefined || total === undefined || total === 0) return undefined
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
})

const statusTone = computed(() => ({
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
}[props.job.status] as 'neutral' | 'info' | 'success' | 'danger' | 'warning'))

const phase = computed(() => props.job.progress?.phase?.replaceAll('-', ' ') ?? props.job.status)
</script>

<template>
  <article class="job-panel">
    <div class="job-panel__icon" :class="`job-panel__icon--${job.status}`">
      <LoaderCircle v-if="job.status === 'running' || job.status === 'queued'" class="spin" :size="20" />
      <CheckCircle2 v-else-if="job.status === 'completed'" :size="20" />
      <XCircle v-else-if="job.status === 'failed'" :size="20" />
      <Ban v-else :size="20" />
    </div>
    <div class="job-panel__body">
      <div class="job-panel__heading">
        <div>
          <strong>{{ job.label }}</strong>
          <p>{{ phase }}</p>
        </div>
        <StatusPill :label="job.status" :tone="statusTone" />
      </div>
      <div v-if="job.status === 'running'" class="progress-track" :class="{ 'progress-track--indeterminate': percent === undefined }">
        <span :style="percent === undefined ? undefined : { width: `${percent}%` }" />
      </div>
      <div v-if="job.progress" class="job-panel__details">
        <span v-if="percent !== undefined">{{ percent }}%</span>
        <span v-if="job.progress.completed !== undefined && job.progress.total !== undefined">
          {{ job.progress.completed.toLocaleString() }} / {{ job.progress.total.toLocaleString() }}
        </span>
        <span v-if="job.progress.reusedEmbeddings !== undefined">
          {{ job.progress.reusedEmbeddings.toLocaleString() }} embeddings reused
        </span>
      </div>
      <p v-if="job.progress?.currentPath" class="job-panel__path">
        <FileCode2 :size="14" />
        {{ job.progress.currentPath }}
      </p>
      <p v-if="job.error" class="feedback feedback--danger">{{ job.error.message }}</p>
      <p v-if="job.result" class="job-panel__result">
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
