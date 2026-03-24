/**
 * header.tsx — Dense top bar displaying at-a-glance repository and GitHub state.
 *
 * Layout (left → right):
 *   gubbi │ repo │ branch ↑↓ │ +staged ~mod ?new !conflict │ PR#N ci  ···  notifs PRs issues │ @user ↺
 */

import { state, icons, useTheme } from "@gubbi/core"
import { useRenderer } from "@opentui/solid"
import { Show } from "solid-js"

// Width breakpoints for progressive disclosure
const BP_MED = 80 // below: hide GitHub metrics (right side)
const BP_NARROW = 50 // below: hide PR/CI, stash

export function Header() {
	const t = useTheme()
	const renderer = useRenderer()
	const w = () => renderer.terminalWidth

	// ── Git change counts ─────────────────────────────────────────────────
	const stagedCount = () => state.git.status?.filter((e) => e.staged).length ?? 0
	const modifiedCount = () =>
		state.git.status?.filter((e) => !e.staged && e.unstaged && e.type !== "untracked").length ?? 0
	const untrackedCount = () => state.git.status?.filter((e) => e.type === "untracked").length ?? 0
	const conflictCount = () => state.git.status?.filter((e) => e.type === "unmerged").length ?? 0
	const hasChanges = () => stagedCount() > 0 || modifiedCount() > 0 || untrackedCount() > 0

	// ── Current branch PR + CI ────────────────────────────────────────────
	const currentPR = () => state.github.prs?.find((pr) => pr.headRefName === state.git.currentBranch)
	const ciPassing = () => currentPR()?.checks?.filter((c) => c.conclusion === "success").length ?? 0
	const ciTotal = () => currentPR()?.checks?.length ?? 0
	const ciAllPass = () => ciTotal() > 0 && ciPassing() === ciTotal()
	const ciHasFail = () => currentPR()?.checks?.some((c) => c.conclusion === "failure") ?? false

	// ── Repo-level GitHub counts ──────────────────────────────────────────
	const openPRCount = () => state.github.prs?.filter((p) => p.state === "OPEN").length ?? 0
	const openIssueCount = () => state.github.issues?.filter((i) => i.state === "OPEN").length ?? 0
	const runningWorkflows = () =>
		state.github.workflowRuns?.filter((r) => r.status === "in_progress").length ?? 0
	const stashCount = () => state.git.stash?.length ?? 0

	// ── Sync status ───────────────────────────────────────────────────────
	const isSynced = () =>
		state.git.isRepo && state.git.ahead === 0 && state.git.behind === 0 && !!state.git.currentBranch

	// ── Truncate long strings ─────────────────────────────────────────────
	const truncBranch = () => {
		const name = state.git.currentBranch || "detached"
		const max = w() < BP_MED ? 16 : 30
		return name.length > max ? name.slice(0, max) + "…" : name
	}

	const SEP = () => <text fg={t.textMuted}> │ </text>

	return (
		<box flexDirection="row" border={["bottom"]} borderColor={t.border} backgroundColor={t.bg}>
			<box
				flexDirection="row"
				alignItems="center"
				height={1}
				paddingLeft={1}
				paddingRight={1}
				overflow="hidden"
			>
				{/* ── App brand ── */}
				<text>
					<span style={{ fg: t.accent, bold: true }}>gubbi</span>
				</text>

				{/* ── Repo name ── */}
				<Show when={state.git.repoName}>
					{SEP()}
					<text>
						<span style={{ fg: t.textSecondary }}>{icons.folder} </span>
						<span style={{ fg: t.text, bold: true }}>{state.git.repoName}</span>
					</text>
				</Show>

				{/* ── Branch + sync ── */}
				<Show when={state.git.isRepo}>
					{SEP()}
					<text>
						<span style={{ fg: t.accent }}>
							{icons.branch} {truncBranch()}
						</span>
					</text>
					<Show when={state.git.ahead > 0}>
						<text>
							<span style={{ fg: t.success }}> ↑{state.git.ahead}</span>
						</text>
					</Show>
					<Show when={state.git.behind > 0}>
						<text>
							<span style={{ fg: t.error }}> ↓{state.git.behind}</span>
						</text>
					</Show>
					<Show when={isSynced()}>
						<text>
							<span style={{ fg: t.success }}> ✓</span>
						</text>
					</Show>
				</Show>

				{/* ── Working tree ── */}
				<Show when={state.git.isRepo}>
					{SEP()}
					<Show
						when={hasChanges() || conflictCount() > 0}
						fallback={
							<text>
								<span style={{ fg: t.textMuted }}>clean</span>
							</text>
						}
					>
						<Show when={stagedCount() > 0}>
							<text>
								<span style={{ fg: t.gitAdded }}>+{stagedCount()} </span>
							</text>
						</Show>
						<Show when={modifiedCount() > 0}>
							<text>
								<span style={{ fg: t.gitModified }}>~{modifiedCount()} </span>
							</text>
						</Show>
						<Show when={untrackedCount() > 0}>
							<text>
								<span style={{ fg: t.gitUntracked }}>?{untrackedCount()} </span>
							</text>
						</Show>
						<Show when={conflictCount() > 0}>
							<text>
								<span style={{ fg: t.error }}>!{conflictCount()}</span>
							</text>
						</Show>
					</Show>
				</Show>

				{/* ── PR + CI for current branch (hidden at narrow) ── */}
				<Show when={w() >= BP_NARROW && currentPR()}>
					{SEP()}
					<text>
						<span style={{ fg: currentPR()?.isDraft ? t.prDraft : t.prOpen }}>
							{icons.pullRequest}#{currentPR()?.number}
						</span>
					</text>
					<Show when={ciTotal() > 0}>
						<text>
							<span style={{ fg: " " }}> </span>
							<span
								style={{
									fg: ciAllPass() ? t.success : ciHasFail() ? t.error : t.warning,
								}}
							>
								{ciAllPass() ? icons.check : ciHasFail() ? icons.circleFilled : icons.clock}
								{ciPassing()}/{ciTotal()}
							</span>
						</text>
					</Show>
				</Show>

				{/* ── Stash (hidden at narrow) ── */}
				<Show when={w() >= BP_NARROW && stashCount() > 0}>
					{SEP()}
					<text>
						<span style={{ fg: t.textSecondary }}>
							{icons.bookmark}
							{stashCount()}
						</span>
					</text>
				</Show>

				<box flexGrow={1} />

				{/* ── GitHub metrics (hidden below wide) ── */}
				<Show when={w() >= BP_MED && state.github.isAuthenticated}>
					{/* Notifications */}
					<Show when={state.github.unreadNotificationCount > 0}>
						<text>
							<span style={{ fg: t.warning, bold: true }}>
								{icons.bell} {state.github.unreadNotificationCount}
							</span>
						</text>
						<text fg={t.textMuted}> </text>
					</Show>

					{/* Open PRs */}
					<Show when={openPRCount() > 0}>
						<text>
							<span style={{ fg: t.prOpen }}>
								{icons.pullRequest}
								{openPRCount()}
							</span>
						</text>
						<text fg={t.textMuted}> </text>
					</Show>

					{/* Open issues */}
					<Show when={openIssueCount() > 0}>
						<text>
							<span style={{ fg: t.info }}>
								{icons.circle}
								{openIssueCount()}
							</span>
						</text>
						<text fg={t.textMuted}> </text>
					</Show>

					{/* Running workflows */}
					<Show when={runningWorkflows() > 0}>
						<text>
							<span style={{ fg: t.warning }}>
								{icons.play}
								{runningWorkflows()}
							</span>
						</text>
						<text fg={t.textMuted}> </text>
					</Show>

					{SEP()}

					{/* User */}
					<text>
						<span style={{ fg: t.textSecondary }}>@{state.github.user}</span>
					</text>
				</Show>

				{/* ── Sync indicator ── */}
				<Show when={state.ui.syncing}>
					<text>
						<span style={{ fg: t.info }}> {icons.sync}</span>
					</text>
				</Show>
			</box>
		</box>
	)
}
