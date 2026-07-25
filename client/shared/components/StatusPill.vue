<template>
	<span
		class="status-pill"
		:class="`status-pill--${tone ?? 'neutral'}`"
	>
		<span class="status-pill__dot" />
		{{ label }}
	</span>
</template>

<script setup lang="ts">
	defineProps<{
		tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
		label: string;
	}>();
</script>

<style scoped>
	.status-pill {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		color: #5b6676;
		background: #f0f0ec;
		border-radius: 999px;
		font-size: 0.63rem;
		font-weight: 700;
	}

	.status-pill__dot {
		width: 6px;
		height: 6px;
		background: #87909d;
		border-radius: 50%;
	}

	.status-pill--success {
		color: #176e66;
		background: var(--teal-pale);
	}

	.status-pill--success .status-pill__dot {
		background: var(--teal);
	}

	.status-pill--danger {
		color: var(--danger);
		background: var(--danger-pale);
	}

	.status-pill--danger .status-pill__dot {
		background: var(--danger);
	}

	.status-pill--warning {
		color: var(--amber);
		background: var(--amber-pale);
	}

	.status-pill--warning .status-pill__dot {
		background: var(--amber);
	}

	.status-pill--info {
		color: var(--cobalt);
		background: var(--cobalt-pale);
	}

	.status-pill--info .status-pill__dot {
		background: var(--cobalt);
	}
</style>
