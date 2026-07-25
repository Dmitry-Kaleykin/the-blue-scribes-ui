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
	import { X } from '@lucide/vue'

	defineProps<{
		title: string
		description?: string
		wide?: boolean
	}>()

	const emit = defineEmits<{
		close: []
	}>()
</script>
