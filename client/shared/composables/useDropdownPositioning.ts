import { computed, onBeforeUnmount, ref } from 'vue';
import { autoUpdate, computePosition, flip, offset } from '@floating-ui/vue';
import type { FloatingPlacement } from '../utils/dropdown-positioner';

/**
 * Vue composable for dropdown positioning.
 *
 * Uses @floating-ui/vue's autoUpdate to keep the dropdown
 * positioned relative to the trigger element.
 *
 * @param options - Positioning options
 * @returns Reactive state and methods for positioning
 */
export function useDropdownPositioning(options: { offset?: number; padding?: number } = {}) {
	const { offset: offsetValue = 6, padding = 8 } = options;

	const triggerRef = ref<HTMLElement | null>(null);
	const floatingRef = ref<HTMLElement | null>(null);

	const position = ref<{ top: string; left: string } | null>(null);
	const placement = ref<FloatingPlacement>('bottom-start');

	let cleanupAutoUpdate: (() => void) | null = null;

	const placementClass = computed(() => {
		const main = placement.value.split('-')[0];
		return `dropdown--${main}`;
	});

	function computePositionFn() {
		if (!triggerRef.value || !floatingRef.value) {return;}

		computePosition(triggerRef.value, floatingRef.value, {
			placement: 'bottom-start',
			strategy: 'fixed',
			middleware: [flip({ padding }), offset(offsetValue)],
		}).then(({ x, y, placement: newPlacement }) => {
			Object.assign(floatingRef.value!.style, {
				left: `${x}px`,
				top: `${y}px`,
			});
			position.value = { top: `${y}px`, left: `${x}px` };
			placement.value = newPlacement as FloatingPlacement;
		});
	}

	function startPositioning() {
		if (cleanupAutoUpdate || !triggerRef.value || !floatingRef.value) {return;}

		cleanupAutoUpdate = autoUpdate(triggerRef.value, floatingRef.value, computePositionFn);
		computePositionFn();
	}

	function stopPositioning() {
		if (cleanupAutoUpdate) {
			cleanupAutoUpdate();
			cleanupAutoUpdate = null;
		}
	}

	function attachTrigger(el: HTMLElement) {
		triggerRef.value = el;
	}

	function updatePosition() {
		if (cleanupAutoUpdate) {
			computePositionFn();
		}
	}

	onBeforeUnmount(() => {
		stopPositioning();
	});

	return {
		/** Ref to the trigger element. */
		triggerRef,
		/** Ref to the floating/dropdown element. */
		floatingRef,
		/** Reactive position (top, left). */
		position,
		/** Reactive placement (e.g. "bottom-start"). */
		placement,
		/** Computed CSS class for placement. */
		placementClass,
		/** Attach the trigger element. */
		attachTrigger,
		/** Start positioning (call when dropdown opens). */
		startPositioning,
		/** Stop positioning (call when dropdown closes). */
		stopPositioning,
		/** Manually update position. */
		updatePosition,
	};
}
