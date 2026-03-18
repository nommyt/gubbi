/**
 * header.tsx — Top bar: repo name, branch, sync status, file counts, and tab navigation
 */

import { state, setView, VIEWS } from "@gubbi/core"
import { Show, For } from "solid-js"

// Colors
const C = {
	bg: "#0d1117",
	border: "#30363d",
	branch: "#58a6ff",
	ahead: "#3fb950",
	behind: "#f78166",
	staged: "#3fb950",
	modified: "#d29922",
	deleted: "#f78166",
	untracked: "#8b949e",
	prOpen: "#3fb950",
	prDraft: "#8b949e",
	prMerged: "#a371f7",
	ciPass: "#3fb950",
	ciFail: "#f78166",
	ciPending: "#d29922",
	branding: "#58a6ff",
	dim: "#8b949e",
	text: "#e6edf3",
	tabActive: "#161b22",
	tabInactive: "#0d1117",
}

const VIEW_ICONS: Record<string, string> = {
	smartlog: "◈",
	status: "◉",
	log: "≡",
	branches: "⎇",
	stacks: "⬡",
	stash: "⚑",
	prs: "⤲",
	issues: "◎",
	actions: "▶",
	notifications: "◆",
	remotes: "⊙",
}

function ciIcon(status: string): string {
	switch (status) {
		case "passing":
			return "✓"
		case "failing":
			return "✗"
		case "pending":
			return "●"
		default:
			return "○"
	}
}

function ciColor(status: string): string {
	switch (status) {
		case "passing":
			return C.ciPass
		case "failing":
			return C.ciFail
		case "pending":
			return C.ciPending
		default:
			return C.dim
	}
}

export function Header() {
	const stagedCount = () => state.git.status?.filter((e) => e.staged).length ?? 0
	const modifiedCount = () =>
		state.git.status?.filter((e) => !e.staged && e.unstaged && e.type !== "untracked").length ?? 0
	const untrackedCount = () => state.git.status?.filter((e) => e.type === "untracked").length ?? 0

	const currentPR = () => state.github.prs?.find((pr) => pr.headRefName === state.git.currentBranch)

	return (
		<box flexDirection="column" border={["bottom"]} borderColor={C.border} backgroundColor={C.bg}>
			{/* Top row: repo info, branch, counts, branding */}
			<box
				flexDirection="row"
				alignItems="center"
				height={2}
				paddingLeft={1}
				paddingRight={1}
				gap={1}
			>
				{/* Repo name */}
				<text fg={C.text}>
					<span style={{ fg: C.branding }}>⬡</span>{" "}
					<span style={{ fg: C.text }}>{state.git.repoName || "gubbi"}</span>
				</text>

				<text fg={C.dim}>│</text>

				{/* Branch */}
				<text>
					<span style={{ fg: C.dim }}>⎇ </span>
					<span style={{ fg: C.branch }}>{state.git.currentBranch || "—"}</span>
				</text>

				{/* Ahead/behind */}
				<Show when={state.git.ahead > 0 || state.git.behind > 0}>
					<text>
						<Show when={state.git.ahead > 0}>
							<span style={{ fg: C.ahead }}>↑{state.git.ahead}</span>
						</Show>
						<Show when={state.git.behind > 0}>
							<span style={{ fg: C.behind }}> ↓{state.git.behind}</span>
						</Show>
					</text>
				</Show>

				{/* File change counts */}
				<Show when={stagedCount() > 0 || modifiedCount() > 0 || untrackedCount() > 0}>
					<text fg={C.dim}>│</text>
					<text>
						<Show when={stagedCount() > 0}>
							<span style={{ fg: C.staged }}>●{stagedCount()}</span>
						</Show>
						<Show when={modifiedCount() > 0}>
							<span style={{ fg: C.modified }}> ~{modifiedCount()}</span>
						</Show>
						<Show when={untrackedCount() > 0}>
							<span style={{ fg: C.untracked }}> ?{untrackedCount()}</span>
						</Show>
					</text>
				</Show>

				{/* PR info */}
				<Show when={currentPR()}>
					<text fg={C.dim}>│</text>
					<text>
						<span style={{ fg: C.dim }}>PR </span>
						<span style={{ fg: currentPR()?.isDraft ? C.prDraft : C.prOpen }}>
							#{currentPR()?.number}
						</span>
					</text>
				</Show>

				{/* Spacer */}
				<box flexGrow={1} />

				{/* GitHub auth indicator */}
				<Show when={!state.github.isAuthenticated && state.git.isRepo}>
					<text fg={C.dim}>gh: not authenticated</text>
					<text fg={C.dim}>│</text>
				</Show>

				{/* Unread notifications badge */}
				<Show when={state.github.unreadNotificationCount > 0}>
					<text>
						<span style={{ fg: C.modified }}>🔔 {state.github.unreadNotificationCount}</span>
					</text>
					<text fg={C.dim}>│</text>
				</Show>

				{/* Branding */}
				<text>
					<span style={{ fg: C.branding }}>gubbi</span>
					<span style={{ fg: C.dim }}> v0.1</span>
				</text>
			</box>

			{/* Tab row: navigation tabs */}
			<box flexDirection="row" height={1} paddingLeft={1} gap={0}>
				<For each={VIEWS}>
					{(view) => {
						const isActive = () => state.ui.currentView === view.id
						const badge = () => {
							if (view.id === "notifications")
								return state.github.unreadNotificationCount > 0
									? state.github.unreadNotificationCount
									: 0
							if (view.id === "status") return state.git.status.length
							if (view.id === "prs")
								return state.github.prs.filter((p) => p.state === "OPEN").length
							return 0
						}

						// Short labels for tabs
						const shortLabel: Record<string, string> = {
							smartlog: "smartlog",
							status: "status",
							log: "log",
							branches: "branches",
							stacks: "stacks",
							stash: "stash",
							prs: "PRs",
							issues: "issues",
							actions: "actions",
							notifications: "notifs",
							remotes: "remotes",
						}

						return (
							<box
								flexDirection="row"
								alignItems="center"
								paddingLeft={1}
								paddingRight={1}
								gap={1}
								onMouseDown={() => setView(view.id)}
								backgroundColor={isActive() ? C.tabActive : C.tabInactive}
								border={isActive() ? ["bottom"] : []}
								borderColor={C.branding}
							>
								<text fg={isActive() ? C.branding : C.dim}>
									{VIEW_ICONS[view.id]} {shortLabel[view.id]}
								</text>
								<Show when={badge() > 0}>
									<text fg={C.modified}>{badge()}</text>
								</Show>
							</box>
						)
					}}
				</For>
			</box>
		</box>
	)
}
