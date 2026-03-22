/**
 * header.tsx — Top bar: repo/branch info and tab navigation
 */

import { state, icons } from "@gubbi/core"
import { Show } from "solid-js"

const C = {
	bg: "#0d1117",
	border: "#30363d",
	branch: "#58a6ff",
	ahead: "#3fb950",
	behind: "#f78166",
	staged: "#3fb950",
	modified: "#d29922",
	untracked: "#8b949e",
	prOpen: "#3fb950",
	prDraft: "#8b949e",
	branding: "#58a6ff",
	dim: "#8b949e",
	text: "#e6edf3",
}

export function Header() {
	const stagedCount = () => state.git.status?.filter((e) => e.staged).length ?? 0
	const modifiedCount = () =>
		state.git.status?.filter((e) => !e.staged && e.unstaged && e.type !== "untracked").length ?? 0
	const untrackedCount = () => state.git.status?.filter((e) => e.type === "untracked").length ?? 0

	const currentPR = () => state.github.prs?.find((pr) => pr.headRefName === state.git.currentBranch)

	return (
		<box flexDirection="row" border={["bottom"]} borderColor={C.border} backgroundColor={C.bg}>
			<box
				flexDirection="row"
				alignItems="center"
				height={1}
				paddingLeft={1}
				paddingRight={1}
				gap={1}
			>
				{/* Branch */}
				<text>
					<span style={{ fg: C.branch }}>{state.git.currentBranch || "—"}</span>
				</text>

				{/* PR badge */}
				<Show when={currentPR()}>
					<text>
						<span style={{ fg: currentPR()?.isDraft ? C.prDraft : C.prOpen }}>
							PR #{currentPR()?.number}
						</span>
						<span style={{ fg: currentPR()?.isDraft ? C.prDraft : C.prOpen }}>
							{" "}
							{currentPR()?.isDraft ? icons.circle : icons.check}
						</span>
					</text>
				</Show>

				{/* Ahead/behind */}
				<Show when={state.git.ahead > 0 || state.git.behind > 0}>
					<text fg={C.dim}>·</text>
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
					<text fg={C.dim}>·</text>
					<text>
						<Show when={stagedCount() > 0}>
							<span style={{ fg: C.staged }}>+{stagedCount()}</span>
						</Show>
						<Show when={modifiedCount() > 0}>
							<span style={{ fg: C.modified }}> ~{modifiedCount()}</span>
						</Show>
						<Show when={untrackedCount() > 0}>
							<span style={{ fg: C.untracked }}> ?{untrackedCount()}</span>
						</Show>
					</text>
				</Show>

				<box flexGrow={1} />

				{/* Notification badge */}
				<Show when={state.github.unreadNotificationCount > 0}>
					<text>
						<span style={{ fg: C.modified }}>
							{icons.bell}
							{state.github.unreadNotificationCount}
						</span>
					</text>
				</Show>
			</box>
		</box>
	)
}
