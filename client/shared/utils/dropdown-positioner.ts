import { autoUpdate, computePosition, flip, offset } from '@floating-ui/vue';

/**
 * Strategy for positioning the dropdown.
 *
 * - 'flip': use floating-ui's flip middleware to avoid overflow.
 * - 'inline': place the dropdown inline below the trigger without flipping.
 */
export type PositionStrategy = 'flip' | 'inline';

/** Placement positions computed by floating-ui. */
export type FloatingPlacement =
	| 'top'
	| 'top-start'
	| 'top-end'
	| 'bottom'
	| 'bottom-start'
	| 'bottom-end'
	| 'left'
	| 'left-start'
	| 'left-end'
	| 'right'
	| 'right-start'
	| 'right-end';

export interface PositionResult {
	/** Top offset in pixels. */
	top: string;
	/** Left offset in pixels. */
	left: string;
	/** Computed placement (e.g. "bottom-start"). */
	placement: FloatingPlacement;
}

export interface PositionOptions {
	/** Offset between trigger and dropdown in pixels (default 6). */
	offset?: number;
	/** Positioning strategy (default 'flip'). */
	strategy?: PositionStrategy;
}

/**
 * Framework-agnostic positioning class for dropdowns / popovers.
 *
 * Uses @floating-ui/dom (via @floating-ui/vue's underlying package)
 * to compute placement, handle overflow flipping, and keep the
 * dropdown pinned to the trigger element.
 *
 * This class owns the DOM element and the scroll/resize listeners.
 * Call destroy() when the element is removed from the DOM.
 */
export class DropdownPositioner {
	private dropdownEl: HTMLElement | null = null;
	private triggerEl: HTMLElement | null = null;
	private offsetFn: ReturnType<typeof offset> | null = null;
	private flipMiddleware: ReturnType<typeof flip> | null = null;
	private inlineMiddleware: ReturnType<typeof autoUpdate> | null = null;
	private cleanupAutoUpdate: (() => void) | null = null;
	private options: Required<PositionOptions>;
	private lastResult: PositionResult | null = null;

	constructor(options?: PositionOptions) {
		this.options = {
			offset: 6,
			strategy: 'flip',
			...options,
		};
	}

	/**
	 * Attach the positioner to trigger and dropdown elements.
	 * Must be called after both elements are in the DOM.
	 */
	attach(trigger: HTMLElement, dropdown: HTMLElement): void {
		this.triggerEl = trigger;
		this.dropdownEl = dropdown;

		if (this.options.strategy === 'inline') {
			this.inlineMiddleware = autoUpdate(trigger, dropdown, () => this.computePosition());
		} else {
			this.flipMiddleware = flip({ padding: 8 });
			this.offsetFn = offset(this.options.offset);
		}

		this.computePosition();
	}

	/**
	 * Update position (call after the dropdown content changes size).
	 */
	update(): void {
		if (this.triggerEl && this.dropdownEl) {
			this.computePosition();
		}
	}

	/**
	 * Detach and clean up all listeners.
	 */
	destroy(): void {
		if (this.cleanupAutoUpdate) {
			this.cleanupAutoUpdate();
			this.cleanupAutoUpdate = null;
		}
		if (this.inlineMiddleware) {
			// autoUpdate cleanup is handled by the returned function
			this.inlineMiddleware = null;
		}
		this.dropdownEl = null;
		this.triggerEl = null;
		this.offsetFn = null;
		this.flipMiddleware = null;
		this.lastResult = null;
	}

	/**
	 * Get the last computed position result.
	 */
	getResult(): PositionResult | null {
		return this.lastResult;
	}

	private async computePosition(): Promise<void> {
		if (!this.triggerEl || !this.dropdownEl) {
			return;
		}

		const {
			x,
			y,
			placement: placementRaw,
		} = await computePosition(this.triggerEl, this.dropdownEl, {
			placement: 'bottom-start',
			strategy: 'fixed',
			middleware: this.options.strategy === 'inline' ? [] : [this.flipMiddleware, this.offsetFn],
		});

		// Apply computed styles
		this.dropdownEl.style.top = `${y}px`;
		this.dropdownEl.style.left = `${x}px`;

		// Handle flip middleware data for placement class
		const newPlacement = (placementRaw as FloatingPlacement) || 'bottom-start';

		// Update placement class
		this.dropdownEl.classList.remove(
			'dropdown--top',
			'dropdown--bottom',
			'dropdown--left',
			'dropdown--right',
			'dropdown--top-start',
			'dropdown--top-end',
			'dropdown--bottom-start',
			'dropdown--bottom-end',
			'dropdown--left-start',
			'dropdown--left-end',
			'dropdown--right-start',
			'dropdown--right-end',
		);
		this.dropdownEl.classList.add('dropdown');
		this.dropdownEl.classList.add(`dropdown--${newPlacement}`);

		this.lastResult = {
			top: `${y}px`,
			left: `${x}px`,
			placement: newPlacement,
		};
	}
}
