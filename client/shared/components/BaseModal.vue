<template>
	<div
		class="modal-backdrop"
		@mousedown.self="emit('close')"
	>
		<section
			class="modal"
			:class="{ 'modal--wide': wide }"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
		>
			<header class="modal__header">
				<div>
					<p class="eyebrow">Local operation</p>
					<h2>{{ title }}</h2>
					<p
						v-if="description"
						class="muted"
					>
						{{ description }}
					</p>
				</div>
				<button
					class="icon-button"
					type="button"
					aria-label="Close"
					@click="emit('close')"
				>
					<X :size="19" />
				</button>
			</header>
			<div class="modal__body">
				<slot />
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
	import { X } from '@lucide/vue';

	defineProps<{
		title: string;
		description?: string;
		wide?: boolean;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();
</script>

<style scoped>
	.modal-backdrop {
		position: fixed;
		z-index: var(--z-modal-backdrop);
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgba(8, 17, 31, 0.62);
	}

	.modal {
		width: min(590px, 100%);
		max-height: calc(100vh - 48px);
		overflow: auto;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 10px;
		box-shadow: 0 30px 80px rgba(8, 17, 31, 0.25);
	}

	.modal--wide {
		width: min(820px, 100%);
	}

	.modal__header {
		position: sticky;
		z-index: var(--z-modal);
		top: 0;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20px;
		padding: 22px 24px 17px;
		background: var(--paper);
		border-bottom: 1px solid var(--line);
	}

	.modal__header h2 {
		font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
		font-size: 1.55rem;
	}

	.modal__header p:last-child {
		margin: 4px 0 0;
	}

	.modal__body {
		padding: 22px 24px;
	}

	@media (max-width: 620px) {
		.modal-backdrop {
			padding: 0;
		}

		.modal {
			width: 100%;
			max-height: 100vh;
			min-height: 100vh;
			border: 0;
			border-radius: 0;
		}

		.modal__header,
		.modal__body {
			padding-inline: 18px;
		}
	}
</style>
