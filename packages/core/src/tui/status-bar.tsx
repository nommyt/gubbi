/**
 * status-bar.tsx — Bottom status bar with context-sensitive hints and view navigation.
 *
 * Single-row layout (left → right):
 *   [toast OR view hints]  ···  [view keys: e 1 2 [3] 4 5 6 w │ 7 8 9 0 n]  │  ? ^z ^r ^c  │  3m ↺
 */

import { state, useTheme, VIEWS } from "@gubbi/core"
import { icons } from "@gubbi/core"
import { useRenderer } from "@opentui/solid"
import { For, Show } from "solid-js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyHint {
	key: string
	label: string
}

// ---------------------------------------------------------------------------
// Hint definitions
// ---------------------------------------------------------------------------

const GLOBAL_HINTS: KeyHint[] = [
	{ key: "?", label: "help" },
	{ key: "^z", label: "undo" },
	{ key: "^r", label: "refresh" },
	{ key: "^c", label: "quit" },
]

const BASE_VIEW_HINTS: Record<string, KeyHint[]> = {
	dashboard: [
		{ key: "h/l", label: "col" },
		{ key: "j/k", label: "nav" },
		{ key: "r", label: "review" },
		{ key: "m", label: "merge" },
		{ key: "c", label: "checkout" },
		{ key: "o", label: "open" },
	],
	smartlog: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "view" },
		{ key: "b", label: "branch" },
		{ key: "c", label: "checkout" },
	],
	status: [
		{ key: "j/k", label: "nav" },
		{ key: "Space", label: "stage" },
		{ key: "a", label: "stage all" },
		{ key: "d", label: "discard" },
		{ key: "c", label: "commit" },
		{ key: "s", label: "stash" },
		{ key: "f", label: "fullscreen" },
	],
	log: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "diff" },
		{ key: "b", label: "branch here" },
		{ key: "y", label: "cherry-pick" },
		{ key: "/", label: "search" },
	],
	branches: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "checkout" },
		{ key: "n", label: "new" },
		{ key: "D", label: "delete" },
		{ key: "m", label: "merge" },
		{ key: "r", label: "rebase" },
		{ key: "p", label: "push" },
	],
	stacks: [
		{ key: "j/k", label: "nav" },
		{ key: "n", label: "new" },
		{ key: "u/d", label: "up/down" },
		{ key: "s", label: "sync" },
		{ key: "p", label: "submit" },
		{ key: "a", label: "absorb" },
	],
	stash: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "apply" },
		{ key: "p", label: "pop" },
		{ key: "D", label: "drop" },
		{ key: "n", label: "new stash" },
	],
	prs: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "view" },
		{ key: "n", label: "new PR" },
		{ key: "m", label: "merge" },
		{ key: "a", label: "approve" },
		{ key: "r", label: "diff" },
		{ key: "o", label: "open" },
	],
	issues: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "view" },
		{ key: "n", label: "new" },
		{ key: "c", label: "comment" },
		{ key: "x", label: "close" },
	],
	actions: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "logs" },
		{ key: "r", label: "re-run" },
		{ key: "t", label: "trigger" },
		{ key: "w", label: "watch" },
	],
	notifications: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "open" },
		{ key: "m", label: "mark read" },
		{ key: "M", label: "all read" },
	],
	explore: [
		{ key: "j/k", label: "nav" },
		{ key: "m/t", label: "my/trending" },
		{ key: "c", label: "clone" },
		{ key: "o", label: "open" },
		{ key: "/", label: "search" },
	],
	remotes: [
		{ key: "j/k", label: "nav" },
		{ key: "f", label: "fetch" },
		{ key: "n", label: "add" },
		{ key: "D", label: "remove" },
	],
	worktrees: [
		{ key: "j/k", label: "nav" },
		{ key: "n", label: "new" },
		{ key: "d", label: "remove" },
		{ key: "p", label: "prune" },
		{ key: "r", label: "repair" },
	],
}

// Views that require a git repo
const GIT_VIEW_IDS = new Set([
	"smartlog",
	"status",
	"log",
	"branches",
	"stacks",
	"stash",
	"worktrees",
	"remotes",
])
// Views that require GitHub auth
const GH_VIEW_IDS = new Set(["prs", "issues", "actions", "notifications"])

function currentBranchPR() {
	return (
		state.github.prs.find(
			(pr) => pr.headRefName === state.git.currentBranch && pr.state === "OPEN",
		) ?? null
	)
}

function getContextHints(): KeyHint[] {
	const view = state.ui.currentView
	const base = BASE_VIEW_HINTS[view] ?? []
	const pr = currentBranchPR()

	if (view === "status" && pr) {
		return [...base, { key: "P", label: "push·PR" }, { key: "V", label: `PR#${pr.number}` }]
	}
	if (view === "status") {
		return [...base, { key: "P", label: "push·PR" }]
	}
	if (view === "branches" && pr) {
		return [...base, { key: "P", label: "push·PR" }, { key: "V", label: "view PR" }]
	}
	return base
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Width breakpoints for progressive disclosure
const BP_MED = 80 // below: hints keys-only (no labels)
const BP_NARROW = 50 // below: no context hints, no global hints

export function StatusBar() {
	const t = useTheme()
	const renderer = useRenderer()
	const w = () => renderer.terminalWidth
	const hints = () => getContextHints()
	const latestToast = () => state.ui.toasts.at(-1)

	// Filter views by availability
	const visibleViews = () =>
		VIEWS.filter((v) => {
			if (GIT_VIEW_IDS.has(v.id) && !state.git.isRepo) return false
			if (GH_VIEW_IDS.has(v.id) && !state.github.isAuthenticated) return false
			return true
		})

	return (
		<box
			flexDirection="row"
			alignItems="center"
			height={1}
			border={["top"]}
			borderColor={t.border}
			backgroundColor={t.bg}
			paddingLeft={1}
			paddingRight={1}
			overflow="hidden"
		>
			{/* ── Left: toast or context hints ── */}
			<Show when={latestToast()}>
				<text truncate>
					<span
						style={{
							fg:
								latestToast()?.type === "error"
									? t.error
									: latestToast()?.type === "success"
										? t.success
										: latestToast()?.type === "warning"
											? t.warning
											: t.info,
						}}
					>
						{latestToast()?.message}
					</span>
				</text>
			</Show>

			<Show when={!latestToast() && w() >= BP_NARROW}>
				<For each={hints()}>
					{(hint, i) => (
						<>
							<Show when={i() > 0}>
								<text fg={t.textMuted}> · </text>
							</Show>
							<text>
								<span style={{ fg: t.accent }}>{hint.key}</span>
								<Show when={w() >= BP_MED}>
									<span style={{ fg: t.textSecondary }}> {hint.label}</span>
								</Show>
							</text>
						</>
					)}
				</For>
			</Show>

			<box flexGrow={1} />

			{/* ── Center-right: view navigation strip ── */}
			<For each={visibleViews()}>
				{(view) => {
					const isActive = () => state.ui.currentView === view.id
					return (
						<text>
							<Show when={isActive()}>
								<span style={{ fg: t.accent, bold: true }}>[{view.key}]</span>
							</Show>
							<Show when={!isActive()}>
								<span style={{ fg: t.textMuted }}> {view.key} </span>
							</Show>
						</text>
					)
				}}
			</For>

			{/* ── Right: global hints (hidden at very narrow) ── */}
			<Show when={w() >= BP_NARROW}>
				<text fg={t.textMuted}> │ </text>

				<For each={GLOBAL_HINTS}>
					{(hint, i) => (
						<>
							<Show when={i() > 0}>
								<text fg={t.textMuted}> </text>
							</Show>
							<text>
								<span style={{ fg: t.textMuted }}>{hint.key}</span>
							</text>
						</>
					)}
				</For>
			</Show>

			{/* Sync spinner */}
			<Show when={state.ui.syncing}>
				<text fg={t.info}> {icons.sync}</text>
			</Show>
		</box>
	)
}
