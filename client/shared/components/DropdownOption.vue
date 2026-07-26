<template>
	<div
		:id="id"
		role="option"
		:aria-selected="selected"
		:tabindex="active ? '0' : undefined"
		:class="[
			'dropdown-option',
			{
				'dropdown-option--active': active,
				'dropdown-option--selected': selected,
				'dropdown-option--disabled': disabled,
			},
		]"
		@click.stop="handleClick"
	>
		<span
			class="dropdown-option__check"
			v-if="selected"
		>
			<Check :size="14" />
		</span>
		<span class="dropdown-option__content">
			<slot />
		</span>
	</div>
</template>

<script setup lang="ts">
	import { Check } from '@lucide/vue';

	export interface DropdownOptionProps {
		/** Unique ID for this option (for aria-labelledby). */
		id?: string;
		/** Whether this option is currently selected. */
		selected?: boolean;
		/** Whether this option is currently active/focused. */
		active?: boolean;
		/** Whether this option is disabled. */
		disabled?: boolean;
	}

	const props = withDefaults(defineProps<DropdownOptionProps>(), {
		id: undefined,
		selected: false,
		active: false,
		disabled: false,
	});

	const emit = defineEmits<{
		select: [];
	}>();

	function handleClick() {
		if (!props.disabled) {
			emit('select');
		}
	}
</script>

<style scoped>
	.dropdown-option {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 6px 12px;
		color: var(--ink);
		background: transparent;
		border: 0;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 400;
		line-height: 1.4;
		cursor: pointer;
		transition:
			background 0.1s ease,
			color 0.1s ease;
		user-select: none;
	}

	.dropdown-option:hover,
	.dropdown-option--active {
		background: var(--cobalt-pale);
		color: var(--cobalt);
	}

	.dropdown-option--selected {
		font-weight: 500;
	}

	.dropdown-option--active.dropdown-option--selected {
		color: var(--cobalt);
	}

	.dropdown-option--disabled {
		color: var(--faint);
		cursor: default;
		pointer-events: none;
	}

	.dropdown-option__check {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		width: 16px;
		color: var(--cobalt);
	}

	.dropdown-option__content {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
