<template>
	<div
		ref="listRef"
		role="listbox"
		:tabindex="-1"
		:aria-labelledby="ariaLabelledBy"
		class="dropdown-list"
		@keydown.self="handleKeydown"
	>
		<slot
			:items="options"
			:activeIndex="activeIndex"
			:selectItem="selectItem"
			:setActiveIndex="setActiveIndex"
		/>
	</div>
</template>

<script setup lang="ts">
	import { nextTick, ref, watch } from 'vue';

	export interface DropdownListOption<T = string> {
		value: T;
		label: string;
		disabled?: boolean;
	}

	export interface DropdownListProps<T = string> {
		/** Currently selected value. */
		modelValue?: T | null;
		/** Available options. */
		options: DropdownListOption<T>[];
		/** ID of the element that labels this list (for accessibility). */
		ariaLabelledBy?: string;
	}

	const props = withDefaults(defineProps<DropdownListProps<string>>(), {
		modelValue: null,
		options: () => [],
		ariaLabelledBy: undefined,
	});

	const emit = defineEmits<{
		'update:modelValue': [value: string | null];
		select: [value: string | null];
	}>();

	const listRef = ref<HTMLElement | null>(null);

	/** Currently active (highlighted) index. */
	const activeIndex = ref(-1);

	/**
	 * Set the active index.
	 * Scrolls the active item into view.
	 */
	function setActiveIndex(index: number) {
		activeIndex.value = index;
		nextTick(() => {
			if (!listRef.value) {
				return;
			}
			const options = listRef.value.querySelectorAll('[role="option"]');
			const activeOption = options[activeIndex.value] as HTMLElement | null;
			activeOption?.scrollIntoView({ block: 'nearest' });
		});
	}

	/** Handle keyboard navigation. */
	function handleKeydown(event: KeyboardEvent) {
		const count = props.options.length;
		if (count === 0) {
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				// Skip disabled options
				{
					let nextIdx = activeIndex.value + 1;
					while (nextIdx < count && props.options[nextIdx]?.disabled) {
						nextIdx++;
					}
					activeIndex.value = nextIdx < count ? nextIdx : 0;
					setActiveIndex(activeIndex.value);
				}
				break;

			case 'ArrowUp':
				event.preventDefault();
				// Skip disabled options
				{
					let prevIdx = activeIndex.value - 1;
					while (prevIdx >= 0 && props.options[prevIdx]?.disabled) {
						prevIdx--;
					}
					activeIndex.value = prevIdx >= 0 ? prevIdx : count - 1;
					setActiveIndex(activeIndex.value);
				}
				break;

			case 'Home':
				event.preventDefault();
				{
					const first = props.options.findIndex((o) => !o.disabled);
					activeIndex.value = first >= 0 ? first : 0;
					setActiveIndex(activeIndex.value);
				}
				break;

			case 'End':
				event.preventDefault();
				{
					let last = -1;
					for (let i = count - 1; i >= 0; i--) {
						if (!props.options[i]?.disabled) {
							last = i;
							break;
						}
					}
					activeIndex.value = last >= 0 ? last : 0;
					setActiveIndex(activeIndex.value);
				}
				break;

			case 'Enter':
			case ' ':
				if (activeIndex.value >= 0) {
					event.preventDefault();
					selectItem(activeIndex.value);
				}
				break;

			case 'Escape':
				event.preventDefault();
				event.stopPropagation();
				break;

			default:
				// Type-ahead: jump to option starting with typed character
				if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
					const char = event.key.toLowerCase();
					const startIdx = activeIndex.value >= 0 ? activeIndex.value : 0;
					let found = -1;
					for (let i = startIdx; i < count; i++) {
						if (!props.options[i]?.disabled && props.options[i].label.toLowerCase().startsWith(char)) {
							found = i;
							break;
						}
					}
					if (found === -1) {
						// Wrap around
						for (let i = 0; i < startIdx; i++) {
							if (!props.options[i]?.disabled && props.options[i].label.toLowerCase().startsWith(char)) {
								found = i;
								break;
							}
						}
					}
					if (found !== -1) {
						activeIndex.value = found;
						setActiveIndex(activeIndex.value);
					}
				}
				break;
		}
	}

	/**
	 * Select the item at the given index.
	 */
	function selectItem(index: number) {
		if (index < 0 || index >= props.options.length) {
			return;
		}
		const option = props.options[index];
		if (option.disabled) {
			return;
		}
		emit('update:modelValue', option.value);
		emit('select', option.value);
	}

	// Reset active index when modelValue changes externally
	watch(
		() => props.modelValue,
		() => {
			activeIndex.value = -1;
		},
	);

	// Update activeIndex when modelValue changes
	watch(
		() => props.modelValue,
		(newVal) => {
			if (newVal !== null) {
				const idx = props.options.findIndex((o) => o.value === newVal);
				if (idx >= 0) {
					activeIndex.value = idx;
				}
			}
		},
	);

	defineExpose({
		listRef,
		activeIndex,
		setActiveIndex,
	});
</script>

<style scoped>
	.dropdown-list {
		outline: none;
		-webkit-tap-highlight-color: transparent;
		max-height: 320px;
		overflow-y: auto;
	}

	/* Scrollbar styling */
	.dropdown-list::-webkit-scrollbar {
		width: 6px;
	}

	.dropdown-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.dropdown-list::-webkit-scrollbar-thumb {
		background: var(--line);
		border-radius: 3px;
	}

	.dropdown-list::-webkit-scrollbar-thumb:hover {
		background: var(--muted);
	}
</style>
