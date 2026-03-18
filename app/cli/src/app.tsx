/**
 * app.tsx — Root application component with plugin loader
 */

import { createPluginContext } from "@gubbi/core"
import { state, setState, setView, setFocus, viewRegistry } from "@gubbi/core"
import { createGitService } from "@gubbi/git"
import { createGitHubService } from "@gubbi/github"
import { Header, StatusBar, Sidebar, HelpOverlay } from "@gubbi/ui"
import type { ParsedKey } from "@opentui/core"
import { useRenderer, useKeyboard } from "@opentui/solid"
import { Switch, Match, Show, onMount } from "solid-js"

// Import all plugins
import plugins from "./plugins/index.ts"

export function App() {
	const renderer = useRenderer()

	// Initialize services
	const gitService = createGitService()
	const githubService = createGitHubService()

	// Check gh auth at startup; trigger web login if not logged in
	onMount(() => {
		void githubService.checkAuth()
	})

	// Activate plugins — must happen before useKeyboard so viewRegistry is populated
	for (const plugin of plugins) {
		try {
			const ctx = createPluginContext(plugin, { git: gitService, github: githubService })
			plugin.activate(ctx)
		} catch (err) {
			console.error(`Failed to activate plugin ${plugin.id}:`, err)
		}
	}

	// Single keyboard handler for all global hotkeys
	// useKeyboard hooks into @opentui/core's stdin parser — works in terminal
	useKeyboard((key: ParsedKey) => {
		// Ctrl+C — quit
		if (key.ctrl && key.name === "c") {
			renderer.destroy()
			return
		}

		// q or Escape — close help overlay if open
		if (key.name === "escape" || key.name === "q") {
			if (state.ui.helpVisible) {
				setState("ui", "helpVisible", false)
			}
			return
		}

		// ? — toggle help overlay
		if (key.name === "?" || (key.shift && key.name === "/")) {
			setState("ui", "helpVisible", (v) => !v)
			return
		}

		// Tab — cycle panel focus
		if (key.name === "tab") {
			setState("ui", "focusedPanel", (p) => (p === "primary" ? "detail" : "primary"))
			return
		}

		// View switching — search ALL registered views (not just visible ones)
		// so keys work even if condition-gated views haven't been revealed yet
		const match = viewRegistry.getAll().find((v) => v.shortcut === key.name)
		if (match) {
			setView(match.id)
			setFocus("primary")
			return
		}
	})

	return (
		<box flexDirection="column" height="100%">
			{/* Header with repo/branch info */}
			<Header />

			{/* Main content area with sidebar and view */}
			<box flexGrow={1} flexDirection="row">
				{/* Sidebar with view tabs */}
				<Sidebar focused={state.ui.focusedPanel === "primary"} />

				{/* Active view */}
				<box flexGrow={1}>
					<Switch fallback={<text>Loading views...</text>}>
						{viewRegistry.getVisible().map((view) => (
							<Match when={state.ui.currentView === view.id}>
								<view.component />
							</Match>
						))}
					</Switch>
				</box>
			</box>

			{/* Status bar with keybindings */}
			<StatusBar />

			<Show when={state.ui.helpVisible}>
				<HelpOverlay onClose={() => setState("ui", "helpVisible", false)} />
			</Show>
		</box>
	)
}
