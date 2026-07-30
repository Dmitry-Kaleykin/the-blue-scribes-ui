<template>
	<main class="page">
		<header class="page-header page-header--split">
			<div>
				<p class="eyebrow">Reusable indexing</p>
				<h1>Indexing presets</h1>
				<p class="page-lead">
					Reuse chunking, encoding, and file-selection settings without mixing them into model profiles.
				</p>
			</div>
			<button
				class="button button--primary"
				type="button"
				:disabled="profiles.length === 0"
				@click="emit('create')"
			>
				<Plus :size="17" />
				New preset
			</button>
		</header>

		<section
			v-if="presets.length > 0"
			class="preset-grid"
		>
			<article
				v-for="preset in presets"
				:key="preset.name"
				class="preset-card"
			>
				<header>
					<span class="preset-card__icon"><SlidersHorizontal :size="21" /></span>
					<div>
						<h2>{{ preset.name }}</h2>
						<StatusPill
							tone="info"
							:label="preset.providerProfile"
						/>
					</div>
				</header>
				<dl class="definition-list">
					<div>
						<dt>Chunk size</dt>
						<dd>{{ preset.maximumChunkSize?.toLocaleString() ?? 'core default' }}</dd>
					</div>
					<div>
						<dt>Windows-1251</dt>
						<dd>{{ preset.windows1251 ? 'fallback enabled' : 'disabled' }}</dd>
					</div>
					<div>
						<dt>Include rules</dt>
						<dd>{{ preset.include?.length ?? 0 }}</dd>
					</div>
					<div>
						<dt>Exclude rules</dt>
						<dd>{{ preset.exclude?.length ?? 0 }}</dd>
					</div>
				</dl>
				<footer>
					<button
						class="button button--secondary button--small"
						type="button"
						@click="emit('edit', preset)"
					>
						<Settings2 :size="15" /> Edit
					</button>
					<span />
					<button
						class="icon-button icon-button--danger"
						type="button"
						aria-label="Delete preset"
						@click="emit('remove', preset)"
					>
						<Trash2 :size="17" />
					</button>
				</footer>
			</article>
		</section>

		<section
			v-else
			class="empty-state empty-state--panel"
		>
			<span class="empty-state__mark"><SlidersHorizontal :size="30" /></span>
			<h3>No indexing presets</h3>
			<p v-if="profiles.length > 0">Create a preset before starting a new project index.</p>
			<p v-else>Create a provider profile first, then combine it with indexing settings.</p>
			<button
				class="button button--primary"
				type="button"
				:disabled="profiles.length === 0"
				@click="emit('create')"
			>
				<Plus :size="16" /> Create preset
			</button>
		</section>
	</main>
</template>

<script setup lang="ts">
	import { Plus, Settings2, SlidersHorizontal, Trash2 } from '@lucide/vue';

	import type { IndexingPreset, ProviderProfile } from '../../../shared/contracts';
	import StatusPill from '../../shared/components/StatusPill.vue';

	defineProps<{
		presets: readonly IndexingPreset[];
		profiles: readonly ProviderProfile[];
	}>();

	const emit = defineEmits<{
		create: [];
		edit: [preset: IndexingPreset];
		remove: [preset: IndexingPreset];
	}>();
</script>

<style scoped>
	.preset-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 15px;
	}

	.preset-card {
		padding: 20px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 9px;
	}

	.preset-card > header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 19px;
	}

	.preset-card__icon {
		display: grid;
		width: 42px;
		height: 42px;
		place-items: center;
		color: var(--cobalt);
		background: var(--cobalt-pale);
		border-radius: 7px;
	}

	.preset-card header h2 {
		margin-bottom: 4px;
		font-size: 1rem;
	}

	.preset-card > footer {
		display: flex;
		align-items: center;
		gap: 3px;
		padding-top: 14px;
		border-top: 1px solid #e9e8e2;
	}

	.preset-card > footer > span {
		flex: 1;
	}

	@media (max-width: 800px) {
		.preset-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
