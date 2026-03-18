/**
 * context/index.ts — PluginContext provides the API for plugins to interact with Gubbi
 */

import { viewRegistry, hotkeyRegistry } from "../registry/index.ts"
import { state, setState, setView, setFocus, showToast, setLoading } from "../state/index.ts"
import type { GubbiPlugin, PluginManifest } from "../types/plugin.ts"
import type { AppState, GitState, GitHubState, UIState, ToastType } from "../types/state.ts"
import type { ViewDefinition } from "../types/view.ts"

/**
 * Service interfaces that plugins can use
 */
export interface GitService {
	// Will be implemented by @gubbi/git package
	refreshStatus: () => Promise<void>
	refreshLog: () => Promise<void>
	refreshBranches: () => Promise<void>
	refreshStash: () => Promise<void>
}

export interface GitHubService {
	// Will be implemented by @gubbi/github package
	refreshPRs: () => Promise<void>
	refreshIssues: () => Promise<void>
	refreshRuns: () => Promise<void>
	refreshNotifications: () => Promise<void>
}

/**
 * Event bus for cross-plugin communication
 */
export interface EventBus {
	emit: (event: string, data?: unknown) => void
	on: (event: string, handler: (data: unknown) => void) => () => void
}

/**
 * UI helpers exposed to plugins
 */
export interface UIHelpers {
	/** Show a toast notification */
	showToast: (type: ToastType, message: string, durationMs?: number) => void

	/** Register a global hotkey */
	registerHotkey: (hotkey: string, handler: () => void, description?: string) => void

	/** Register a view-specific hotkey */
	registerViewHotkey: (
		viewId: string,
		hotkey: string,
		handler: () => void,
		description?: string,
	) => void

	/** Set the current view programmatically */
	setView: (viewId: string) => void

	/** Set the focused panel */
	setFocus: (panel: "primary" | "detail") => void
}

/**
 * State access for plugins (read-only store slices with setters)
 */
export interface StateAccess {
	git: GitState
	github: GitHubState
	ui: UIState
}

export type StateSetter = typeof setState

/**
 * PluginContext is passed to each plugin's activate() function
 */
export interface PluginContext {
	/** The plugin's own manifest */
	manifest: PluginManifest

	/** Access to the global state (reactive SolidJS store) */
	state: StateAccess

	/** Set state function from SolidJS store */
	setState: StateSetter

	/** Services for git and GitHub operations */
	services: {
		git?: GitService
		github?: GitHubService
	}

	/** Event bus for pub/sub between plugins */
	events?: EventBus

	/** UI helpers for toasts, hotkeys, etc. */
	ui: UIHelpers

	/** Register a view that this plugin contributes */
	registerView: (view: ViewDefinition) => void
}

/**
 * Create a PluginContext for a specific plugin
 */
export function createPluginContext(
	plugin: GubbiPlugin,
	services: { git?: GitService; github?: GitHubService } = {},
	events?: EventBus,
): PluginContext {
	const manifest: PluginManifest = {
		id: plugin.id,
		name: plugin.name,
		version: plugin.version,
	}

	return {
		manifest,
		state: state as StateAccess,
		setState,
		services,
		events,
		ui: {
			showToast,
			registerHotkey: (hotkey, handler, description) => {
				hotkeyRegistry.registerGlobal(hotkey, handler, description)
			},
			registerViewHotkey: (viewId, hotkey, handler, description) => {
				hotkeyRegistry.registerForView(viewId, hotkey, handler, description)
			},
			setView,
			setFocus,
		},
		registerView: (view: ViewDefinition) => {
			viewRegistry.register(plugin.id, view)
		},
	}
}
