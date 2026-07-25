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
		tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
		label: string
	}>()
</script>
