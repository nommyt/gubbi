/**
 * registry/hotkeys.ts — Hotkey registry for plugin-contributed keyboard shortcuts
 */

import type { RegisterableHotkey } from "@tanstack/hotkeys"

export type HotkeyHandler = () => void

export interface HotkeyRegistration {
	scope: "global" | "view"
	viewId?: string
	hotkey: string
	handler: HotkeyHandler
	description?: string
}

/**
 * HotkeyRegistry manages keyboard shortcuts from plugins
 */
export class HotkeyRegistry {
	private registrations: HotkeyRegistration[] = []
	private handlers = new Map<string, HotkeyHandler>()

	/**
	 * Register a global hotkey
	 */
	registerGlobal(hotkey: string, handler: HotkeyHandler, description?: string): void {
		this.registrations.push({
			scope: "global",
			hotkey,
			handler,
			description,
		})
		this.handlers.set(`global:${hotkey}`, handler)
	}

	/**
	 * Register a view-scoped hotkey
	 */
	registerForView(
		viewId: string,
		hotkey: string,
		handler: HotkeyHandler,
		description?: string,
	): void {
		this.registrations.push({
			scope: "view",
			viewId,
			hotkey,
			handler,
			description,
		})
		this.handlers.set(`view:${viewId}:${hotkey}`, handler)
	}

	/**
	 * Get handler for a hotkey in current context
	 */
	getHandler(hotkey: string, currentView?: string): HotkeyHandler | undefined {
		// Try view-scoped first if we have a current view
		if (currentView) {
			const viewHandler = this.handlers.get(`view:${currentView}:${hotkey}`)
			if (viewHandler) return viewHandler
		}
		// Fall back to global
		return this.handlers.get(`global:${hotkey}`)
	}

	/**
	 * Get all registrations for a view
	 */
	getForView(viewId: string): HotkeyRegistration[] {
		return this.registrations.filter((r) => r.viewId === viewId)
	}

	/**
	 * Get all global registrations
	 */
	getGlobal(): HotkeyRegistration[] {
		return this.registrations.filter((r) => r.scope === "global")
	}

	/**
	 * Unregister all hotkeys from a plugin
	 */
	unregisterByPlugin(_pluginId: string): void {
		// TODO: Track plugin ownership for cleanup
	}

	/**
	 * Format hotkey for display
	 */
	formatForDisplay(hotkey: string): string {
		return hotkey
			.replace("Mod+", process.platform === "darwin" ? "⌘" : "Ctrl+")
			.replace("Alt+", "⌥")
			.replace("Shift+", "⇧")
	}
}

// Global hotkey registry instance
export const hotkeyRegistry = new HotkeyRegistry()
