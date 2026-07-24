<script setup lang="ts">
import { Plus, Server, Settings2, Trash2, Zap } from '@lucide/vue'

import type { ProviderProfile } from '../../../shared/contracts'
import StatusPill from '../../shared/components/StatusPill.vue'

defineProps<{
  profiles: readonly ProviderProfile[]
}>()

const emit = defineEmits<{
  create: []
  edit: [profile: ProviderProfile]
  test: [profile: ProviderProfile]
  remove: [profile: ProviderProfile]
}>()
</script>

<template>
  <main class="page">
    <header class="page-header page-header--split">
      <div>
        <p class="eyebrow">Reusable configuration</p>
        <h1>Provider profiles</h1>
        <p class="page-lead">Configure embedding and reranking once, then reuse the profile for every project.</p>
      </div>
      <button class="button button--primary" type="button" @click="emit('create')">
        <Plus :size="17" />
        New profile
      </button>
    </header>

    <section v-if="profiles.length > 0" class="profile-grid">
      <article v-for="profile in profiles" :key="profile.name" class="profile-card">
        <header>
          <span class="profile-card__icon"><Server :size="21" /></span>
          <div>
            <h2>{{ profile.name }}</h2>
            <StatusPill tone="success" label="LM Studio" />
          </div>
        </header>
        <dl class="definition-list">
          <div>
            <dt>Embedding model</dt>
            <dd>{{ profile.embedding.model }}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{{ profile.embedding.dimensions.toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Request batch</dt>
            <dd>{{ profile.embedding.maximumInputs ?? 'default' }}</dd>
          </div>
          <div>
            <dt>Reranker</dt>
            <dd>{{ profile.reranking?.model ?? 'disabled' }}</dd>
          </div>
        </dl>
        <p class="profile-card__url">{{ profile.embedding.baseUrl ?? 'http://127.0.0.1:1234/v1' }}</p>
        <footer>
          <button class="button button--secondary button--small" type="button" @click="emit('test', profile)">
            <Zap :size="15" /> Diagnose
          </button>
          <span />
          <button class="icon-button" type="button" aria-label="Edit profile" @click="emit('edit', profile)">
            <Settings2 :size="17" />
          </button>
          <button class="icon-button icon-button--danger" type="button" aria-label="Delete profile" @click="emit('remove', profile)">
            <Trash2 :size="17" />
          </button>
        </footer>
      </article>
    </section>

    <section v-else class="empty-state empty-state--panel">
      <span class="empty-state__mark"><Server :size="30" /></span>
      <h3>No provider profiles</h3>
      <p>Connect an LM Studio embedding model to begin indexing.</p>
      <button class="button button--primary" type="button" @click="emit('create')">
        <Plus :size="16" /> Create profile
      </button>
    </section>
  </main>
</template>
