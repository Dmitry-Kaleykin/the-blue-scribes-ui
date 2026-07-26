<template>
	<Teleport to="body">
		<div
			v-if="open"
			ref="dropdownRef"
			class="dropdown"
			:class="placementClass"
			:style="{ top: position?.top, left: position?.left }"
			role="listbox"
			:aria-labelledby="ariaLabelledBy"
			@mousedown.prevent.stop
		>
			<div class="dropdown__inner">
				<slot />
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref, watch } from 'vue';
	import { useDropdownPositioning } from '../composables/useDropdownPositioning';

	export interface DropdownContentProps {
		/** Whether the dropdown is currently open. */
		open: boolean;
		/** ID of the element that labels this dropdown (for accessibility). */
		ariaLabelledBy?: string;
		/** Offset between trigger and dropdown in pixels (default 6). */
		offset?: number;
		/** Padding for overflow detection (default 8). */
		padding?: number;
		/** Width of the trigger element in pixels (for matching dropdown width). */
		triggerWidth?: number;
	}

	defineOptions({ inheritAttrs: false });

	const props = withDefaults(defineProps<DropdownContentProps>(), {
		ariaLabelledBy: undefined,
		offset: 6,
		padding: 8,
		triggerWidth: 0,
	});

	const emit = defineEmits<{
		closed: [];
	}>();

	const dropdownRef = ref<HTMLElement | null>(null);

	const dropdownWidth = computed(() => {
		return props.triggerWidth > 0 ? `${props.triggerWidth}px` : 'auto';
	});

	const { triggerRef, floatingRef, position, placementClass, attachTrigger, startPositioning, stopPositioning } =
		useDropdownPositioning({
			offset: props.offset,
			padding: props.padding,
		});

	// Expose triggerRef and attachTrigger for parent components
	defineExpose({
		triggerRef,
		attachTrigger,
	});

	// Watch open prop to start/stop positioning
	watch(
		() => props.open,
		(val) => {
			if (val) {
				// Wait for Teleport to place element in DOM
				requestAnimationFrame(() => {
					floatingRef.value = dropdownRef.value;
					startPositioning();
				});
			} else {
				stopPositioning();
				// Wait for CSS transition to finish before emitting closed
				setTimeout(() => {
					emit('closed');
				}, 120);
			}
		},
	);

	// Update floatingRef when dropdownRef changes
	onMounted(() => {
		floatingRef.value = dropdownRef.value;
	});
</script>

<style scoped>
	.dropdown {
		position: fixed;
		z-index: var(--z-dropdown);
		width: v-bind('dropdownWidth');
		opacity: 1;
		transition: opacity 0.12s ease;
	}

	.dropdown__inner {
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 8px;
		box-shadow:
			0 8px 24px rgba(8, 17, 31, 0.12),
			0 2px 8px rgba(8, 17, 31, 0.06);
		padding: 4px;
	}
</style>
