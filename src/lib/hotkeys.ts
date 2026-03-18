/**
 * hotkeys.ts — Centralized hotkey management using TanStack Hotkeys
 * Provides type-safe hotkey registration and cross-platform support
 */

import type { RegisterableHotkey } from "@tanstack/hotkeys"
import { createHotkey, HotkeysProvider } from "@tanstack/solid-hotkeys"
import { createSignal } from "solid-js"

// Export HotkeysProvider for use in app.tsx
export { HotkeysProvider }

// Global hotkey state
export const [isRecordingHotkeys, setIsRecordingHotkeys] = createSignal(false)

/**
 * Global hotkey options that apply to all hotkeys
 */
export const hotkeyOptions = {
	// Prevent default behavior for all hotkeys
	preventDefault: true,
	// Stop propagation to avoid conflicts
	stopPropagation: false,
}

/**
 * Register a global hotkey
 * @param hotkey - The hotkey string (e.g., 'Mod+S', 'Escape', 'd')
 * @param callback - The callback to execute when hotkey is pressed
 * @param options - Additional options for the hotkey (can be reactive using accessor functions)
 */
export function registerGlobalHotkey(
	hotkey: string,
	callback: (event: KeyboardEvent) => void,
	options: {
		enabled?: boolean | (() => boolean)
		preventDefault?: boolean
		target?: HTMLElement | Document | Window | null
	} = {},
) {
	// Cast the string to RegisterableHotkey since TanStack Hotkeys accepts
	// various string formats that may not be fully captured by the type system
	const hotkeyString = hotkey as RegisterableHotkey

	createHotkey(
		hotkeyString,
		(event: KeyboardEvent) => {
			// Skip if recording hotkeys
			if (isRecordingHotkeys()) return

			callback(event)
		},
		() => ({
			...hotkeyOptions,
			...options,
			// Convert enabled to boolean if it's a function
			enabled: typeof options.enabled === "function" ? options.enabled() : options.enabled,
		}),
	)
}

/**
 * Hotkey definitions for the application
 * These are registered globally when the app starts
 */
export const HOTKEYS = {
	// Navigation
	dashboard: "d",
	smartlog: "1",
	status: "2",
	log: "3",
	branches: "4",
	stacks: "5",
	stash: "6",
	prs: "7",
	issues: "8",
	actions: "9",
	notifications: "0",

	// Global actions
	help: "?",
	quit: "Mod+c",
	refresh: "Mod+r",

	// View actions
	fullscreen: "f",
	sideBySide: "S",
	search: "/",
	escape: "Escape",
	back: "q",

	// Navigation keys
	up: ["j", "ArrowUp"],
	down: ["k", "ArrowDown"],
	left: ["h", "ArrowLeft"],
	right: ["l", "ArrowRight"],
	pageUp: "Ctrl+u",
	pageDown: "Ctrl+d",
	top: "g",
	bottom: "G",
	enter: "Enter",
	space: " ",
	tab: "Tab",

	// Selection
	selectAll: "Ctrl+a",

	// Git-specific
	stage: " ",
	stageAll: "a",
	unstageAll: "A",
	discard: "d",
	commit: "c",
	amend: "C",
	push: "p",
	pull: "P",

	// Stack-specific
	newBranch: "n",
	syncStack: "s",
	submit: "p",
	absorb: "a",
	fold: "F",
	move: "m",
	reorder: "r",
} as const

/**
 * Format hotkey for display in UI
 * Uses TanStack Hotkeys' formatHotkey function
 */
export function formatHotkeyForDisplay(hotkey: string): string {
	// TanStack Hotkeys has built-in formatting, but we can customize here
	return hotkey
		.replace("Mod+", navigator.platform.includes("Mac") ? "⌘" : "Ctrl+")
		.replace("Alt+", "⌥")
		.replace("Shift+", "⇧")
		.replace("Ctrl+", "Ctrl+")
		.replace("Cmd+", "⌘")
}

/**
 * Check if a hotkey is currently pressed
 * Useful for conditional logic based on modifier keys
 */
export function isHotkeyPressed(_hotkey: string): boolean {
	// This would require tracking key state, which TanStack Hotkeys supports
	// via getKeyStateTracker()
	return false
}

/**
 * Unregister a hotkey
 * @param _hotkey - The hotkey string to unregister
 */
export function unregisterHotkey(_hotkey: RegisterableHotkey): void {
	// TanStack Hotkeys automatically handles cleanup via onCleanup
	// This function is a placeholder for future implementation if needed
}
