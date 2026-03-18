/**
 * types/view.ts — View definition for plugin-contributed UI
 */

import type { JSX } from "solid-js"

/**
 * A view is a tab/screen in the Gubbi TUI
 */
export interface ViewDefinition {
	/** Unique view identifier */
	id: string

	/** Display label for the view tab */
	label: string

	/** Single character keyboard shortcut (e.g., "1", "d", "s") */
	shortcut: string

	/**
	 * The SolidJS component to render when this view is active
	 * Can be a synchronous component or an async import
	 */
	component: (() => JSX.Element) | (() => Promise<{ default: () => JSX.Element }>)

	/**
	 * Optional condition that determines if this view should be visible/enabled
	 * Called reactively — return false to hide the view
	 */
	condition?: () => boolean

	/**
	 * Optional badge count shown on the view tab
	 * Called periodically to update the badge
	 */
	badge?: () => number | string | undefined

	/**
	 * Optional help text for this view (shown in help overlay)
	 */
	help?: string
}

/**
 * View state within the registry
 */
export interface RegisteredView extends ViewDefinition {
	/** Plugin ID that registered this view */
	pluginId: string

	/** Whether the view is currently visible based on its condition */
	isVisible: boolean
}

/**
 * Panel focus state
 */
export type PanelFocus = "primary" | "detail"

/**
 * Fullscreen panel state
 */
export type FullscreenPanel = "primary" | "detail" | null
