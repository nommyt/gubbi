/**
 * app.tsx — Root application component
 * Integrates theme, command palette, which-key leader keys, and all views.
 */

import {
	state,
	setState,
	setView,
	setFocus,
	showToast,
	setThemeName,
	markLastUndone,
	loadConfig,
	VIEWS,
	icons,
	ThemeContext,
	getThemeByName,
	listThemes,
} from "@gubbi/core"
import {
	Header,
	StatusBar,
	HelpOverlay,
	OperationsOverlay,
	SelectDialog,
	CommandPalette,
	WhichKey,
} from "@gubbi/core/tui"
import type { PaletteAction, WhichKeyBinding } from "@gubbi/core/tui"
import { createGitService, resetHard } from "@gubbi/git"
import { createGitHubService } from "@gubbi/github"
import type { ParsedKey } from "@opentui/core"
import { useRenderer, useKeyboard } from "@opentui/solid"
import { Switch, Match, Show, onMount, createSignal, createMemo, type JSX } from "solid-js"

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

// ---------------------------------------------------------------------------
// Leader key bindings — g prefix (git views), h prefix (github views)
// ---------------------------------------------------------------------------

const LEADER_BINDINGS: Record<string, Record<string, { view: string; label: string }>> = {
	g: {
		s: { view: "smartlog", label: "Smartlog" },
		t: { view: "stacks", label: "Stacks" },
		h: { view: "stash", label: "Stash" },
		w: { view: "worktrees", label: "Worktrees" },
		r: { view: "remotes", label: "Remotes" },
	},
	h: {
		i: { view: "issues", label: "Issues" },
		a: { view: "actions", label: "Actions" },
		n: { view: "notifications", label: "Notifications" },
	},
}

function getLeaderBindings(prefix: string): WhichKeyBinding[] {
	const bindings = LEADER_BINDINGS[prefix]
	if (!bindings) return []
	return Object.entries(bindings).map(([key, { label }]) => ({ key, label }))
}

export function App() {
	const renderer = useRenderer()
	const [showOperations, setShowOperations] = createSignal(false)
	const [showThemePicker, setShowThemePicker] = createSignal(false)
	const [showPalette, setShowPalette] = createSignal(false)
	const [leaderKey, setLeaderKey] = createSignal<string | null>(null)
	let leaderTimeout: ReturnType<typeof setTimeout> | null = null

	// Reactive theme config derived from state
	const currentTheme = createMemo(() => getThemeByName(state.ui.themeName))

	// Initialize services
	const gitService = createGitService()
	const githubService = createGitHubService()

	// Initialize git repo detection and GitHub auth at startup
	onMount(() => {
		const config = loadConfig()
		if (config.theme) {
			setThemeName(config.theme)
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

	// Build palette actions
	function getPaletteActions(): PaletteAction[] {
		const actions: PaletteAction[] = []

		// View navigation
		for (const [id, def] of Object.entries(VIEWS_MAP)) {
			if (def.condition && !def.condition()) continue
			const viewLabel = VIEWS.find((v) => v.id === id)?.label ?? id
			actions.push({
				id: `view:${id}`,
				label: `Go to ${viewLabel}`,
				shortcut: def.shortcut,
				category: "Navigation",
				callback: () => {
					setView(id)
					setFocus("primary")
				},
			})
		}

		// Theme switching
		for (const theme of listThemes()) {
			actions.push({
				id: `theme:${theme.name}`,
				label: `Theme: ${theme.displayName}`,
				category: "Appearance",
				callback: () => {
					setThemeName(theme.name)
					showToast("success", `Theme: ${theme.displayName}`)
				},
			})
		}

		// Utility actions
		actions.push({
			id: "help",
			label: "Show help",
			shortcut: "?",
			category: "General",
			callback: () => setState("ui", "helpVisible", true),
		})
		actions.push({
			id: "operations",
			label: "Show operations log",
			shortcut: "^o",
			category: "General",
			callback: () => setShowOperations(true),
		})
		actions.push({
			id: "refresh",
			label: "Refresh all data",
			shortcut: "^r",
			category: "General",
			callback: () => {
				void gitService.refreshStatus()
				void githubService.refreshPRs()
				void githubService.refreshIssues()
				void githubService.refreshRuns()
				void githubService.refreshNotifications()
				showToast("info", "Refreshing...")
			},
		})

		return actions
	}

	function clearLeader() {
		if (leaderTimeout) clearTimeout(leaderTimeout)
		leaderTimeout = null
		setLeaderKey(null)
	}

	// Single keyboard handler for all global hotkeys
	useKeyboard((key: ParsedKey) => {
		// Ctrl+C — quit (always active, even in inputs)
		if (key.ctrl && key.name === "c") {
			renderer.destroy()
			process.exit(0)
		}

		// Skip all global hotkeys when an input/dialog is active
		if (state.ui.inputActive) return

		// Close palette on escape
		if (showPalette()) return

		// --- Leader key second press ---
		const leader = leaderKey()
		if (leader) {
			clearLeader()
			const binding = LEADER_BINDINGS[leader]?.[key.name]
			if (binding) {
				const viewDef = VIEWS_MAP[binding.view]
				if (viewDef && (!viewDef.condition || viewDef.condition())) {
					setView(binding.view)
					setFocus("primary")
					showToast("info", `${icons.branch} ${binding.label}`)
				}
			}
			return
		}

		// --- Leader key first press ---
		if ((key.name === "g" || key.name === "h") && !key.ctrl && !key.shift) {
			// "g" alone can also mean "go to top" in views — only trigger leader if
			// view-level handlers don't consume it. We use a timeout approach:
			// set leader, show which-key, auto-clear after 1.5s.
			setLeaderKey(key.name)
			leaderTimeout = setTimeout(clearLeader, 1500)
			return
		}

		// Ctrl+P or : — command palette
		if ((key.ctrl && key.name === "p") || key.name === ":") {
			setShowPalette(true)
			return
		}

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
						showToast("error", `Undo failed: ${String(err)}`)
					}
				})()
			} else {
				showToast("info", "Nothing to undo")
			}
			return
		}

		// Ctrl+R — refresh all data
		if (key.ctrl && key.name === "r") {
			void gitService.refreshStatus()
			void githubService.refreshPRs()
			void githubService.refreshIssues()
			void githubService.refreshRuns()
			void githubService.refreshNotifications()
			showToast("info", "Refreshing...")
			return
		}

		// Ctrl+O — toggle operations overlay
		if (key.ctrl && key.name === "o") {
			setShowOperations((v) => !v)
			return
		}

		// Ctrl+T — theme picker
		if (key.ctrl && key.name === "t") {
			setShowThemePicker((v) => !v)
			return
		}

		// q or Escape — close overlays or go back
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

		// f — fullscreen toggle (promoted to global)
		if (key.name === "f" && !key.ctrl) {
			setState("ui", "fullscreenPanel", (prev) => (prev === "detail" ? null : "detail"))
			return
		}

		// S — toggle side-by-side diff (global)
		if (key.name === "s" && key.shift) {
			setState("git", "sideBySideDiff", (v) => !v)
			showToast("info", state.git.sideBySideDiff ? "Split diff" : "Unified diff")
			return
		}

		// Tab — cycle panel focus
		if (key.name === "tab") {
			setState("ui", "focusedPanel", (p) => (p === "primary" ? "detail" : "primary"))
			return
		}

		// View switching — direct shortcuts (1-9, 0, e, n, w)
		const viewEntry = Object.entries(VIEWS_MAP).find(([, v]) => v.shortcut === key.name)
		if (viewEntry) {
			const [id, viewDef] = viewEntry
			if (!viewDef.condition || viewDef.condition()) {
				setView(id)
				setFocus("primary")
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
		<ThemeContext.Provider value={currentTheme()}>
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
							<Match
								when={state.ui.currentView === "notifications" && state.github.isAuthenticated}
							>
								<NotificationsView />
							</Match>
						</Switch>
					</box>
				</box>

				{/* Status bar with keybindings */}
				<StatusBar />

				{/* Overlays — layered on top */}
				<Show when={state.ui.helpVisible}>
					<HelpOverlay onClose={() => setState("ui", "helpVisible", false)} />
				</Show>

				<Show when={showOperations()}>
					<OperationsOverlay onClose={() => setShowOperations(false)} />
				</Show>

				<Show when={showThemePicker()}>
					<SelectDialog
						title="Select theme"
						options={listThemes().map((th) => ({
							label: th.displayName,
							description: th.name === state.ui.themeName ? "(active)" : "",
							value: th.name,
						}))}
						onSelect={(value) => {
							setShowThemePicker(false)
							setThemeName(value)
							showToast("success", `Theme: ${getThemeByName(value).displayName}`)
						}}
						onCancel={() => setShowThemePicker(false)}
					/>
				</Show>

				<Show when={showPalette()}>
					<CommandPalette actions={getPaletteActions()} onClose={() => setShowPalette(false)} />
				</Show>

				{/* Which-key hint for leader keys */}
				<Show when={leaderKey()}>
					{(lk) => <WhichKey prefix={lk()} bindings={getLeaderBindings(lk())} />}
				</Show>
			</box>
		</ThemeContext.Provider>
	)
}
