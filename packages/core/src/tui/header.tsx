/**
 * header.tsx — Dense top bar displaying at-a-glance repository state.
 *
 * Shows (left to right): app branding, current branch, associated PR
 * with CI badge, ahead/behind counts, staged/modified/untracked counts,
 * current view name, GitHub user, notification count, and sync indicator.
 */

import { state, icons, useTheme, VIEWS } from "@gubbi/core"
import { Show } from "solid-js"

const VIEWS_LABEL: Record<string, string> = Object.fromEntries(VIEWS.map((v) => [v.id, v.label]))
const VIEWS_KEY: Record<string, string> = Object.fromEntries(VIEWS.map((v) => [v.id, v.key]))

/**
 * Top header bar rendered above all views.
 *
 * Displays branch, PR status, CI checks, file counts, current view,
 * authenticated user, notification badge, and sync indicator.
 */
export function Header() {
	const t = useTheme()
	const stagedCount = () => state.git.status?.filter((e) => e.staged).length ?? 0
	const modifiedCount = () =>
		state.git.status?.filter((e) => !e.staged && e.unstaged && e.type !== "untracked").length ?? 0
	const untrackedCount = () => state.git.status?.filter((e) => e.type === "untracked").length ?? 0

	const currentPR = () => state.github.prs?.find((pr) => pr.headRefName === state.git.currentBranch)

	const ciPassing = () => currentPR()?.checks?.filter((c) => c.conclusion === "success").length ?? 0
	const ciTotal = () => currentPR()?.checks?.length ?? 0
	const ciAllPass = () => ciTotal() > 0 && ciPassing() === ciTotal()
	const ciHasFail = () => currentPR()?.checks?.some((c) => c.conclusion === "failure") ?? false

	const viewLabel = () => VIEWS_LABEL[state.ui.currentView] ?? state.ui.currentView
	const viewKey = () => VIEWS_KEY[state.ui.currentView] ?? ""

	return (
		<box flexDirection="row" border={["bottom"]} borderColor={t.border} backgroundColor={t.bg}>
			<box
				flexDirection="row"
				alignItems="center"
				height={1}
				paddingLeft={1}
				paddingRight={1}
				gap={1}
			>
				{/* App branding */}
				<text>
					<span style={{ fg: t.accent, bold: true }}>gubbi</span>
				</text>

				<text fg={t.textMuted}>│</text>

				{/* Branch */}
				<text>
					<span style={{ fg: t.accent }}>
						{icons.branch} {state.git.currentBranch || "—"}
					</span>
				</text>

				{/* PR badge with CI status */}
				<Show when={currentPR()}>
					<text>
						<span style={{ fg: currentPR()?.isDraft ? t.prDraft : t.prOpen }}>
							{icons.pullRequest}#{currentPR()?.number}
						</span>
					</text>
					<Show when={ciTotal() > 0}>
						<text>
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

				{/* Ahead/behind */}
				<Show when={state.git.ahead > 0 || state.git.behind > 0}>
					<text>
						<Show when={state.git.ahead > 0}>
							<span style={{ fg: t.success }}>↑{state.git.ahead}</span>
						</Show>
						<Show when={state.git.behind > 0}>
							<span style={{ fg: t.error }}>↓{state.git.behind}</span>
						</Show>
					</text>
				</Show>

				{/* File change counts */}
				<Show when={stagedCount() > 0 || modifiedCount() > 0 || untrackedCount() > 0}>
					<text>
						<Show when={stagedCount() > 0}>
							<span style={{ fg: t.gitAdded }}>+{stagedCount()}</span>
						</Show>
						<Show when={modifiedCount() > 0}>
							<span style={{ fg: t.gitModified }}>~{modifiedCount()}</span>
						</Show>
						<Show when={untrackedCount() > 0}>
							<span style={{ fg: t.gitUntracked }}>?{untrackedCount()}</span>
						</Show>
					</text>
				</Show>

				<box flexGrow={1} />

				{/* Current view indicator */}
				<text>
					<Show when={viewKey()}>
						<span style={{ fg: t.textMuted }}>[{viewKey()}]</span>{" "}
					</Show>
					<span style={{ fg: t.text }}>{viewLabel()}</span>
				</text>

				<text fg={t.textMuted}>│</text>

				{/* GitHub user */}
				<Show when={state.github.isAuthenticated && state.github.user}>
					<text fg={t.textSecondary}>@{state.github.user}</text>
				</Show>

				{/* Notification badge */}
				<Show when={state.github.unreadNotificationCount > 0}>
					<text>
						<span style={{ fg: t.warning }}>
							{icons.bell}
							{state.github.unreadNotificationCount}
						</span>
					</text>
				</Show>

				{/* Sync indicator */}
				<Show when={state.ui.syncing}>
					<text fg={t.info}>{icons.sync}</text>
				</Show>
			</box>
		</box>
	)
}
