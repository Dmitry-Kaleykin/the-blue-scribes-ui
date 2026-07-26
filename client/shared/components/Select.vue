<template>
	<div
		class="select"
		:class="{ 'select--open': isOpen, 'select--disabled': disabled }"
	>
		<!-- Trigger Button -->
		<button
			ref="triggerRef"
			class="select__trigger"
			type="button"
			:aria-expanded="isOpen"
			aria-haspopup="listbox"
			:aria-labelledby="ariaLabelledBy"
			:disabled="disabled"
			@click="toggle"
			@keydown.down.prevent="open"
			@keydown.up.prevent="open"
		>
			<span class="select__value">{{ displayValue }}</span>
			<ChevronDown
				class="select__chevron"
				:size="16"
			/>
		</button>

		<!-- Dropdown Content -->
		<DropdownContent
			ref="dropdownContentRef"
			:open="isOpen"
			:aria-labelledby="ariaLabelledBy"
			:offset="dropdownOffset"
			:trigger-width="triggerWidth"
			@closed="onDropdownClosed"
		>
			<DropdownList
				:modelValue="modelValue as string | null"
				:options="options"
				:aria-labelledby="ariaLabelledBy"
				@select="handleSelect"
			>
				<template #default="{ activeIndex: idx }">
					<DropdownOption
						v-for="(option, index) in options"
						:key="String(option.value)"
						:selected="option.value === modelValue"
						:active="index === idx"
						:disabled="option.disabled"
						@select="select(option.value)"
					>
						{{ option.label }}
					</DropdownOption>
				</template>
			</DropdownList>
		</DropdownContent>
	</div>
</template>

<script setup lang="ts">
	import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
	import { ChevronDown } from '@lucide/vue';
	import DropdownContent from './DropdownContent.vue';
	import DropdownList from './DropdownList.vue';
	import DropdownOption from './DropdownOption.vue';

	export interface SelectOption<T = string> {
		value: T;
		label: string;
		disabled?: boolean;
	}

	export interface SelectProps<T = string> {
		/** Currently selected value. */
		modelValue?: T;
		/** Available options. */
		options: SelectOption<T>[];
		/** Whether the select is disabled. */
		disabled?: boolean;
		/** Placeholder text when no value is selected. */
		placeholder?: string;
		/** ID of the element that labels this select (for accessibility). */
		ariaLabelledBy?: string;
		/** Gap between select trigger and dropdown in pixels (default 4). */
		dropdownOffset?: number;
	}

	const props = withDefaults(defineProps<SelectProps<string>>(), {
		modelValue: undefined,
		disabled: false,
		placeholder: 'Select an option',
		ariaLabelledBy: undefined,
		dropdownOffset: 4,
	});

	const emit = defineEmits<{
		'update:modelValue': [value: string];
		open: [];
		close: [value: string];
	}>();

	const triggerRef = ref<HTMLElement | null>(null);
	const dropdownContentRef = ref<InstanceType<typeof DropdownContent> | null>(null);

	const isOpen = ref(false);
	const triggerWidth = ref<number>(0);

	const displayValue = computed(() => {
		const selected = props.options.find((opt) => opt.value === props.modelValue);
		return selected?.label || props.placeholder;
	});

	function toggle() {
		if (props.disabled) {return;}
		isOpen.value ? close() : open();
	}

	function open() {
		if (props.disabled || isOpen.value) {return;}
		isOpen.value = true;

		// Capture trigger width for dropdown matching
		if (triggerRef.value) {
			triggerWidth.value = triggerRef.value.offsetWidth;
		}

		emit('open');

		// Register trigger with dropdown content
		nextTick(() => {
			dropdownContentRef.value?.attachTrigger(triggerRef.value!);
		});
	}

	function close() {
		if (!isOpen.value) {return;}
		isOpen.value = false;
		emit('close', props.modelValue as string);
	}

	function onDropdownClosed() {
		// Nothing to reset - DropdownList manages activeIndex
	}

	function select(value: string) {
		const option = props.options.find((opt) => opt.value === value);
		if (option?.disabled) {return;}
		emit('update:modelValue', value);
		close();
	}

	function handleSelect(value: string | null) {
		if (value !== null) {
			select(value);
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (!isOpen.value) {return;}
		const selectEl = triggerRef.value?.closest('.select');
		if (selectEl && selectEl.contains(event.target as Node)) {return;}
		close();
	}

	// Add click-outside listener on mount
	onMounted(() => {
		document.addEventListener('mousedown', handleClickOutside);
	});
	onBeforeUnmount(() => {
		document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<style scoped>
	.select {
		position: relative;
		display: inline-flex;
		width: 100%;
	}

	.select__trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 44px;
		padding: 10px 36px 10px 12px;
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: 5px;
		font-size: 0.8rem;
		font-weight: 400;
		line-height: 1.4;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		user-select: none;
	}

	.select__trigger:hover {
		border-color: #7797e5;
	}

	.select__trigger:focus {
		outline: none;
		border-color: #7797e5;
		box-shadow: 0 0 0 3px rgba(36, 94, 219, 0.1);
	}

	.select--disabled .select__trigger {
		background: #eae9e4;
		cursor: default;
		opacity: 0.6;
	}

	.select__value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select__chevron {
		flex: 0 0 auto;
		position: absolute;
		right: 10px;
		color: var(--muted);
		pointer-events: none;
		transition: transform 0.15s ease;
	}

	.select--open .select__chevron {
		transform: rotate(180deg);
	}
</style>
