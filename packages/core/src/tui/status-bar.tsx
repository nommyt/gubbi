/**
 * status-bar.tsx — Bottom status bar with context-sensitive keybinding hints.
 *
 * Displays view-specific keybinding hints on the left, global hints on
 * the right, toast messages when active, the current view label, a
 * relative "last refreshed" timestamp, and a sync indicator.
 */

import { state, useTheme } from "@gubbi/core"
import { icons } from "@gubbi/core"
import { For, Show, createSignal, onMount, onCleanup } from "solid-js"

/** A single keybinding hint shown in the status bar. */
interface KeyHint {
	/** Key or key combo label (e.g. `"j/k"`, `"^r"`). */
	key: string
	/** Short description of the action. */
	label: string
}

const GLOBAL_HINTS: KeyHint[] = [
	{ key: "?", label: "help" },
	{ key: "Tab", label: "focus" },
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
		{ key: "F", label: "fold" },
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
		{ key: "o", label: "open in browser" },
	],
	issues: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "view" },
		{ key: "n", label: "new issue" },
		{ key: "c", label: "comment" },
		{ key: "x", label: "close" },
		{ key: "o", label: "open in browser" },
	],
	actions: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "view logs" },
		{ key: "r", label: "re-run" },
		{ key: "o", label: "open in browser" },
	],
	notifications: [
		{ key: "j/k", label: "nav" },
		{ key: "Enter", label: "open" },
		{ key: "m", label: "mark read" },
		{ key: "M", label: "mark all read" },
	],
	remotes: [
		{ key: "j/k", label: "nav" },
		{ key: "f", label: "fetch" },
		{ key: "n", label: "add remote" },
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
		return [...base, { key: "P", label: `push·PR` }, { key: "V", label: `PR #${pr.number}` }]
	}
	if (view === "status") {
		return [...base, { key: "P", label: "push·PR" }]
	}
	if (view === "branches" && pr) {
		return [...base, { key: "P", label: "push·PR" }, { key: "V", label: "view PR" }]
	}
	return base
}

/**
 * Bottom status bar component.
 *
 * Renders context-sensitive key hints for the active view, global hints,
 * toast notifications, and the last-refresh timestamp.
 */
export function StatusBar() {
	const t = useTheme()
	const hints = () => getContextHints()
	const latestToast = () => state.ui.toasts.at(-1)

	// Tick every 10s to update relative time display
	const [now, setNow] = createSignal(Date.now())
	onMount(() => {
		const id = setInterval(() => setNow(Date.now()), 10_000)
		onCleanup(() => clearInterval(id))
	})

	const refreshedAgo = () => {
		const ts = state.github.lastRefreshTime
		if (!ts) return ""
		const s = Math.floor((now() - ts) / 1000)
		if (s < 60) return `${s}s ago`
		const m = Math.floor(s / 60)
		if (m < 60) return `${m}m ago`
		return `${Math.floor(m / 60)}h ago`
	}

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
			gap={1}
		>
			{/* Toast messages (highest priority) */}
			<Show when={latestToast()}>
				<text>
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

			{/* Normal key hints */}
			<Show when={!latestToast()}>
				<For each={hints()}>
					{(hint, i) => (
						<>
							<Show when={i() > 0}>
								<text fg={t.textMuted}>·</text>
							</Show>
							<text>
								<span style={{ fg: t.accent }}>{hint.key}</span>
								<span style={{ fg: t.textSecondary }}> {hint.label}</span>
							</text>
						</>
					)}
				</For>
			</Show>

			<box flexGrow={1} />

			{/* Global hints */}
			<For each={GLOBAL_HINTS}>
				{(hint, i) => (
					<>
						<Show when={i() > 0}>
							<text fg={t.textMuted}>·</text>
						</Show>
						<text>
							<span style={{ fg: t.textMuted }}>{hint.key}</span>
							<span style={{ fg: t.textMuted }}> {hint.label}</span>
						</text>
					</>
				)}
			</For>

			<text fg={t.textMuted}>│</text>

			{/* Current view name */}
			<text fg={t.text}>{VIEWS_DISPLAY[state.ui.currentView]}</text>
			<Show when={refreshedAgo()}>
				<text fg={t.textMuted}> {refreshedAgo()}</text>
			</Show>
			<Show when={state.ui.syncing}>
				<text fg={t.info}> {icons.sync} syncing</text>
			</Show>
		</box>
	)
}

import { VIEWS } from "@gubbi/core"

const VIEWS_DISPLAY: Record<string, string> = Object.fromEntries(VIEWS.map((v) => [v.id, v.label]))
