<template>
	<div
		class="toast"
		:class="`toast--${tone}`"
		role="status"
	>
		<span />
		{{ message }}
		<button
			type="button"
			aria-label="Dismiss notification"
			@click="emit('close')"
		>
			<X :size="16" />
		</button>
	</div>
</template>

<script setup lang="ts">
	import { X } from '@lucide/vue';

	defineProps<{
		tone: 'success' | 'danger';
		message: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();
</script>

<style scoped>
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