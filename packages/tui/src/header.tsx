/**
 * header.tsx — Top bar: repo/branch info and tab navigation
 */

import { state, setView, VIEWS, icons } from "@gubbi/core"
import { Show, For } from "solid-js"

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
	tabActive: "#1c2128",
	tabInactive: "#0d1117",
	sep: "#484f58",
}

// Tab groups separated by dividers
const TAB_GROUPS = [
	{ views: ["dashboard"], label: "" },
	{ views: ["smartlog", "status", "log", "branches", "stacks", "stash"], label: "git" },
	{ views: ["prs", "issues", "actions", "notifications", "explore"], label: "github" },
]

export function Header() {
	const stagedCount = () => state.git.status?.filter((e) => e.staged).length ?? 0
	const modifiedCount = () =>
		state.git.status?.filter((e) => !e.staged && e.unstaged && e.type !== "untracked").length ?? 0
	const untrackedCount = () => state.git.status?.filter((e) => e.type === "untracked").length ?? 0

	const currentPR = () => state.github.prs?.find((pr) => pr.headRefName === state.git.currentBranch)

	return (
		<box flexDirection="column" border={["bottom"]} borderColor={C.border} backgroundColor={C.bg}>
			{/* Slim info row */}
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

			{/* Tab row with group separators */}
			<box flexDirection="row" height={1} paddingLeft={0} gap={0}>
				<For each={TAB_GROUPS}>
					{(group, gi) => (
						<>
							<Show when={gi() > 0}>
								<text fg={C.sep}> │ </text>
							</Show>
							<For each={VIEWS.filter((v) => group.views.includes(v.id))}>
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

									return (
										<box
											flexDirection="row"
											alignItems="center"
											paddingLeft={1}
											paddingRight={1}
											gap={0}
											onMouseDown={() => setView(view.id)}
											backgroundColor={isActive() ? C.tabActive : C.tabInactive}
										>
											<text fg={isActive() ? C.text : C.dim}>{view.key}</text>
											<text fg={isActive() ? C.branding : C.dim}> {view.label}</text>
											<Show when={badge() > 0}>
												<text fg={C.modified}> {badge()}</text>
											</Show>
										</box>
									)
								}}
							</For>
						</>
					)}
				</For>
			</box>
		</box>
	)
}
