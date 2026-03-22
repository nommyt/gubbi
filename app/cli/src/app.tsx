/**
 * app.tsx — Root application component
 */

import {
	state,
	setState,
	setView,
	setFocus,
	showToast,
	markLastUndone,
	loadConfig,
	VIEWS,
	icons,
} from "@gubbi/core"
import { createGitService, getHeadHash, resetHard } from "@gubbi/git"
import { createGitHubService } from "@gubbi/github"
import { Header, StatusBar, HelpOverlay, OperationsOverlay } from "@gubbi/tui"
import type { ParsedKey } from "@opentui/core"
import { useRenderer, useKeyboard } from "@opentui/solid"
import { Switch, Match, Show, onMount, createSignal, type JSX } from "solid-js"

// Import all views directly
import {
	SmartlogView,
	StatusView,
	LogView,
	BranchesView,
	StashView,
	RemotesView,
	WorktreesView,
	PullRequestsView,
	IssuesView,
	ActionsView,
	NotificationsView,
	StacksView,
	ExploreView,
} from "./views/index.ts"

// View definitions — id, component, shortcut, condition
const VIEWS_MAP: Record<
	string,
	{
		component: () => JSX.Element
		shortcut: string
		condition?: () => boolean
	}
> = {
	explore: { component: ExploreView, shortcut: "e" },
	smartlog: { component: SmartlogView, shortcut: "1", condition: () => state.git.isRepo },
	status: { component: StatusView, shortcut: "2", condition: () => state.git.isRepo },
	log: { component: LogView, shortcut: "3", condition: () => state.git.isRepo },
	branches: { component: BranchesView, shortcut: "4", condition: () => state.git.isRepo },
	stacks: { component: StacksView, shortcut: "5", condition: () => state.git.isRepo },
	stash: { component: StashView, shortcut: "6", condition: () => state.git.isRepo },
	worktrees: { component: WorktreesView, shortcut: "w", condition: () => state.git.isRepo },
	remotes: { component: RemotesView, shortcut: "0", condition: () => state.git.isRepo },
	prs: {
		component: PullRequestsView,
		shortcut: "7",
		condition: () => state.github.isAuthenticated,
	},
	issues: { component: IssuesView, shortcut: "8", condition: () => state.github.isAuthenticated },
	actions: { component: ActionsView, shortcut: "9", condition: () => state.github.isAuthenticated },
	notifications: {
		component: NotificationsView,
		shortcut: "n",
		condition: () => state.github.isAuthenticated,
	},
}

export function App() {
	const renderer = useRenderer()
	const [showOperations, setShowOperations] = createSignal(false)

	// Initialize services
	const gitService = createGitService()
	const githubService = createGitHubService()

	// Initialize git repo detection and GitHub auth at startup
	onMount(() => {
		const config = loadConfig()
		if (config.theme) {
			// Theme support can be added later
		}
		void gitService.initialize()
		void githubService.checkAuth()
	})

	// Get visible views based on conditions
	function getVisibleViews() {
		return VIEWS.filter((v) => {
			const viewDef = VIEWS_MAP[v.id]
			if (!viewDef) return false
			return !viewDef.condition || viewDef.condition()
		})
	}

	// Single keyboard handler for all global hotkeys
	useKeyboard((key: ParsedKey) => {
		// Ctrl+C — quit (always active, even in inputs)
		if (key.ctrl && key.name === "c") {
			renderer.destroy()
			return
		}

		// Skip all global hotkeys when an input/dialog is active
		if (state.ui.inputActive) return

		// Ctrl+Z — undo last operation
		if (key.ctrl && key.name === "z") {
			const op = markLastUndone()
			if (op) {
				void (async () => {
					try {
						await resetHard(op.beforeHash, state.git.repoRoot)
						await gitService.refreshStatus()
						showToast("success", `Undid: ${op.description}`)
					} catch (err) {
						showToast("error", `Undo failed: ${err}`)
					}
				})()
			} else {
				showToast("info", "Nothing to undo")
			}
			return
		}

		// Ctrl+O — toggle operations overlay
		if (key.ctrl && key.name === "o") {
			setShowOperations((v) => !v)
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

		// View switching — check shortcuts from VIEWS_MAP
		const viewEntry = Object.entries(VIEWS_MAP).find(([, v]) => v.shortcut === key.name)
		if (viewEntry) {
			const [id, viewDef] = viewEntry
			if (!viewDef.condition || viewDef.condition()) {
				setView(id)
				setFocus("primary")
			}
			return
		}

		// Ctrl+Tab / Ctrl+Shift+Tab — cycle views
		if (key.ctrl && key.name === "tab") {
			const visibleViews = getVisibleViews()
			const currentIdx = visibleViews.findIndex((v) => v.id === state.ui.currentView)
			const nextIdx = key.shift
				? (currentIdx - 1 + visibleViews.length) % visibleViews.length
				: (currentIdx + 1) % visibleViews.length
			const nextView = visibleViews[nextIdx]
			if (nextView) {
				setView(nextView.id)
				setFocus("primary")
				showToast("info", `${icons.branch} ${nextView.label}`)
			}
			return
		}

		// Ctrl+H / Ctrl+L — previous/next view
		if (key.ctrl && (key.name === "h" || key.name === "l")) {
			const visibleViews = getVisibleViews()
			const currentIdx = visibleViews.findIndex((v) => v.id === state.ui.currentView)
			const nextIdx =
				key.name === "h"
					? (currentIdx - 1 + visibleViews.length) % visibleViews.length
					: (currentIdx + 1) % visibleViews.length
			const nextView = visibleViews[nextIdx]
			if (nextView) {
				setView(nextView.id)
				setFocus("primary")
				showToast("info", `${icons.branch} ${nextView.label}`)
			}
			return
		}
	})

	return (
		<box flexDirection="column" height="100%">
			{/* Header with repo/branch info */}
			<Header />

			{/* Main content area */}
			<box flexGrow={1} flexDirection="row">
				{/* Active view */}
				<box flexGrow={1}>
					<Switch fallback={<text>Select a view...</text>}>
						<Match when={state.ui.currentView === "explore"}>
							<ExploreView />
						</Match>
						<Match when={state.ui.currentView === "smartlog" && state.git.isRepo}>
							<SmartlogView />
						</Match>
						<Match when={state.ui.currentView === "status" && state.git.isRepo}>
							<StatusView />
						</Match>
						<Match when={state.ui.currentView === "log" && state.git.isRepo}>
							<LogView />
						</Match>
						<Match when={state.ui.currentView === "branches" && state.git.isRepo}>
							<BranchesView />
						</Match>
						<Match when={state.ui.currentView === "stacks" && state.git.isRepo}>
							<StacksView />
						</Match>
						<Match when={state.ui.currentView === "stash" && state.git.isRepo}>
							<StashView />
						</Match>
						<Match when={state.ui.currentView === "worktrees" && state.git.isRepo}>
							<WorktreesView />
						</Match>
						<Match when={state.ui.currentView === "remotes" && state.git.isRepo}>
							<RemotesView />
						</Match>
						<Match when={state.ui.currentView === "prs" && state.github.isAuthenticated}>
							<PullRequestsView />
						</Match>
						<Match when={state.ui.currentView === "issues" && state.github.isAuthenticated}>
							<IssuesView />
						</Match>
						<Match when={state.ui.currentView === "actions" && state.github.isAuthenticated}>
							<ActionsView />
						</Match>
						<Match when={state.ui.currentView === "notifications" && state.github.isAuthenticated}>
							<NotificationsView />
						</Match>
					</Switch>
				</box>
			</box>

			{/* Status bar with keybindings */}
			<StatusBar />

			<Show when={state.ui.helpVisible}>
				<HelpOverlay onClose={() => setState("ui", "helpVisible", false)} />
			</Show>

			<Show when={showOperations()}>
				<OperationsOverlay onClose={() => setShowOperations(false)} />
			</Show>
		</box>
	)
}
