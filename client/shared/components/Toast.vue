<template>
	<Transition
		name="toast"
		mode="out-in"
	>
		<div
			:key="item.id"
			class="toast"
			:class="`toast--${item.tone}`"
			role="status"
		>
			<span />
			{{ item.message }}
			<button
				type="button"
				aria-label="Dismiss notification"
				@click="emit('close')"
			>
				<X :size="16" />
			</button>
		</div>
	</Transition>
</template>

<script setup lang="ts">
	import { X } from '@lucide/vue';

	defineProps<{
		item: {
			id: number;
			tone: 'success' | 'danger';
			message: string;
		};
	}>();

	const emit = defineEmits<{
		close: [];
	}>();
</script>

<style scoped>
	.toast-enter-active,
	.toast-leave-active {
		transition:
			opacity 150ms ease,
			transform 150ms ease;
	}

	.toast-enter-from,
	.toast-leave-to {
		opacity: 0;
		transform: translateY(8px);
	}

	.toast-enter-to,
	.toast-leave-from {
		opacity: 1;
		transform: translateY(0);
	}

	.toast-move {
		transition: transform 300ms ease;
	}

	.toast {
		position: fixed;
		z-index: 150;
		right: 24px;
		bottom: 24px;
		display: flex;
		max-width: min(460px, calc(100vw - 48px));
		align-items: center;
		gap: 10px;
		padding: 13px 14px;
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--line);
		border-left-width: 4px;
		border-radius: 7px;
		box-shadow: var(--shadow);
		font-size: 0.73rem;
	}

	.toast--success {
		border-left-color: var(--teal);
	}

	.toast--danger {
		border-left-color: var(--danger);
	}

	.toast > span {
		width: 7px;
		height: 7px;
		background: var(--teal);
		border-radius: 50%;
	}

	.toast--danger > span {
		background: var(--danger);
	}

	.toast button {
		display: grid;
		margin-left: auto;
		padding: 3px;
		color: var(--muted);
		background: transparent;
		border: 0;
	}
</style>
