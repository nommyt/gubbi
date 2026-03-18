/**
 * app.tsx — Root application component
 *
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ Header (tabs navigation)                    │
 * ├─────────────────────────────────────────────┤
 * │ Active View                                  │
 * ├─────────────────────────────────────────────┤
 * │ Status Bar                                   │
 * └─────────────────────────────────────────────┘
 */

import { useRenderer } from "@opentui/solid"
import { Switch, Match, Show } from "solid-js"

import { HelpOverlay } from "./components/dialog.tsx"
import { Header } from "./components/header.tsx"
import { StatusBar } from "./components/status-bar.tsx"
import { useGhInit, useGhAutoRefresh } from "./hooks/use-gh.ts"
import { useGitInit, useGitAutoRefresh, refreshAll } from "./hooks/use-git.ts"
import { HotkeysProvider, registerGlobalHotkey } from "./lib/hotkeys.ts"
import { state, setState, setView, setFocus, VIEWS } from "./lib/store.ts"
import { ActionsView } from "./views/actions.tsx"
import { BranchesView } from "./views/branches.tsx"
import { DashboardView } from "./views/dashboard.tsx"
import { IssuesView } from "./views/issues.tsx"
import { LogView } from "./views/log.tsx"
import { NotificationsView } from "./views/notifications.tsx"
import { PullRequestsView } from "./views/pull-requests.tsx"
import { RemotesView } from "./views/remotes.tsx"
import { SmartlogView } from "./views/smartlog.tsx"
import { StacksView } from "./views/stacks.tsx"
import { StashView } from "./views/stash.tsx"
import { StatusView } from "./views/status.tsx"

export function App() {
	const renderer = useRenderer()

	// Initialize git + gh state
	useGitInit()
	useGhInit()

	// Set up auto-refresh
	useGitAutoRefresh()
	useGhAutoRefresh()

	// Register global hotkeys using TanStack Hotkeys
	// View switching by number key
	VIEWS.forEach((view) => {
		registerGlobalHotkey(view.key, () => {
			setView(view.id)
			setFocus("primary")
		})
	})

	// Help overlay
	registerGlobalHotkey("?", () => {
		setState("helpVisible", (v) => !v)
	})

	// Quit
	registerGlobalHotkey("Mod+c", () => {
		renderer.destroy()
	})

	// Global refresh
	registerGlobalHotkey("Mod+r", () => {
		void refreshAll()
	})

	// Tab to cycle panel focus (primary <-> detail)
	registerGlobalHotkey("Tab", () => {
		setState("focusedPanel", (p) => {
			if (p === "primary") return "detail"
			return "primary"
		})
	})

	// Close help overlay
	registerGlobalHotkey("Escape", () => {
		if (state.helpVisible) {
			setState("helpVisible", false)
		}
	})

	registerGlobalHotkey("q", () => {
		if (state.helpVisible) {
			setState("helpVisible", false)
		}
	})

	return (
		<HotkeysProvider
			defaultOptions={{
				hotkey: {
					preventDefault: true,
					stopPropagation: false,
				},
			}}
		>
			<box flexDirection="column" height="100%">
				<Header />

				<box flexGrow={1}>
					<Switch>
						<Match when={state.currentView === "dashboard"}>
							<DashboardView />
						</Match>
						<Match when={state.currentView === "smartlog" && state.isGitRepo}>
							<SmartlogView />
						</Match>
						<Match when={state.currentView === "status" && state.isGitRepo}>
							<StatusView />
						</Match>
						<Match when={state.currentView === "log" && state.isGitRepo}>
							<LogView />
						</Match>
						<Match when={state.currentView === "branches" && state.isGitRepo}>
							<BranchesView />
						</Match>
						<Match when={state.currentView === "stacks" && state.isGitRepo}>
							<StacksView />
						</Match>
						<Match when={state.currentView === "stash" && state.isGitRepo}>
							<StashView />
						</Match>
						<Match when={state.currentView === "prs"}>
							<PullRequestsView />
						</Match>
						<Match when={state.currentView === "issues"}>
							<IssuesView />
						</Match>
						<Match when={state.currentView === "actions"}>
							<ActionsView />
						</Match>
						<Match when={state.currentView === "notifications"}>
							<NotificationsView />
						</Match>
						<Match when={state.currentView === "remotes"}>
							<RemotesView />
						</Match>
					</Switch>
				</box>

				<StatusBar />

				<Show when={state.helpVisible}>
					<HelpOverlay onClose={() => setState("helpVisible", false)} />
				</Show>
			</box>
		</HotkeysProvider>
	)
}
