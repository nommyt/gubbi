/**
 * status-bar.tsx — Bottom bar with context-sensitive keybinding hints + notifications
 */

import { state } from "@gubbi/core"
import { For, Show, Switch, Match } from "solid-js"

const C = {
	bg: "#0d1117",
	border: "#30363d",
	key: "#58a6ff",
	sep: "#484f58",
	text: "#8b949e",
	activeView: "#e6edf3",
	error: "#f78166",
	success: "#3fb950",
	warning: "#d29922",
	info: "#58a6ff",
}

interface KeyHint {
	key: string
	label: string
}

const GLOBAL_HINTS: KeyHint[] = [
	{ key: "?", label: "help" },
	{ key: "Tab", label: "focus" },
	{ key: "^r", label: "refresh" },
	{ key: "^c", label: "quit" },
]

const VIEW_HINTS: Record<string, KeyHint[]> = {
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
		{ key: "S", label: "side-by-side" },
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
}

export function StatusBar() {
	const hints = () => VIEW_HINTS[state.ui.currentView] ?? []
	const latestToast = () => state.ui.toasts.at(-1)

	return (
		<box
			flexDirection="row"
			alignItems="center"
			height={1}
			border={["top"]}
			borderColor={C.border}
			backgroundColor={C.bg}
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
									? C.error
									: latestToast()?.type === "success"
										? C.success
										: latestToast()?.type === "warning"
											? C.warning
											: C.info,
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
								<text fg={C.sep}>·</text>
							</Show>
							<text>
								<span style={{ fg: C.key }}>{hint.key}</span>
								<span style={{ fg: C.text }}> {hint.label}</span>
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
							<text fg={C.sep}>·</text>
						</Show>
						<text>
							<span style={{ fg: C.sep }}>{hint.key}</span>
							<span style={{ fg: C.sep }}> {hint.label}</span>
						</text>
					</>
				)}
			</For>

			<text fg={C.sep}>│</text>

			{/* Current view name */}
			<text fg={C.activeView}>{VIEWS_DISPLAY[state.ui.currentView]}</text>
		</box>
	)
}

import { VIEWS } from "@gubbi/core"

const VIEWS_DISPLAY: Record<string, string> = Object.fromEntries(VIEWS.map((v) => [v.id, v.label]))
