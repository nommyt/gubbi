/**
 * sidebar.tsx — Left navigation panel with view list.
 *
 * Renders the vertical sidebar with view labels, key hints, icons,
 * badge counts (notifications, status changes, open PRs), and the
 * GitHub auth status at the bottom.
 */

import { state, setView, setFocus, VIEWS, icons, useTheme } from "@gubbi/core"
import { For, Show } from "solid-js"

interface SidebarProps {
	/** Whether this panel currently has keyboard focus. */
	focused: boolean
}

/** Maps each view ID to its sidebar icon. */
const VIEW_ICONS: Record<string, string> = {
	dashboard: icons.star,
	smartlog: icons.commit,
	status: icons.circleFilled,
	log: icons.commit,
	branches: icons.branch,
	stacks: icons.merge,
	stash: icons.bookmark,
	prs: icons.pullRequest,
	issues: icons.lightbulb,
	actions: icons.play,
	notifications: icons.bell,
	remotes: icons.sync,
}

/**
 * Sidebar navigation panel.
 *
 * Lists all available views with icons, key hints, and badge counts.
 * Clicking a view switches to it and moves focus to the primary panel.
 */
export function Sidebar(props: SidebarProps) {
	const t = useTheme()
	return (
		<box
			flexDirection="column"
			width={20}
			border={["right"]}
			borderColor={props.focused ? t.borderFocused : t.border}
			backgroundColor={t.bg}
			paddingTop={1}
		>
			<For each={VIEWS}>
				{(view) => {
					const isActive = () => state.ui.currentView === view.id
					const badge = () => {
						if (view.id === "notifications")
							return state.github.unreadNotificationCount > 0
								? state.github.unreadNotificationCount
								: 0
						if (view.id === "status") return state.git.status?.length ?? 0
						if (view.id === "prs") return state.github.prs?.filter((p) => p.state === "OPEN").length
						return 0
					}

					return (
						<box
							flexDirection="row"
							alignItems="center"
							paddingLeft={1}
							paddingRight={1}
							height={1}
							backgroundColor={isActive() ? t.bgSecondary : "transparent"}
							onMouseDown={() => {
								setView(view.id)
								setFocus("primary")
							}}
						>
							{/* Key hint */}
							<text fg={t.textMuted}>{view.key} </text>

							{/* Icon */}
							<text fg={isActive() ? t.accent : t.textSecondary}>{VIEW_ICONS[view.id]} </text>

							{/* Label */}
							<text fg={isActive() ? t.accent : t.textSecondary}>{view.label}</text>

							<box flexGrow={1} />

							{/* Badge */}
							<Show when={badge() > 0}>
								<text fg={t.warning}>{badge()}</text>
							</Show>
						</box>
					)
				}}
			</For>

			<box flexGrow={1} />

			{/* Bottom: auth status */}
			<box paddingLeft={1} paddingBottom={1}>
				<Show
					when={state.github.isAuthenticated}
					fallback={
						<Show
							when={state.github.isCheckingAuth}
							fallback={<text fg={t.textMuted}>⚠ gh: not logged in</text>}
						>
							<text fg={t.textMuted}>{icons.sync} gh: checking...</text>
						</Show>
					}
				>
					<text fg={t.textMuted}>
						{icons.check} {state.github.user || "authenticated"}
					</text>
				</Show>
			</box>
		</box>
	)
}
