/**
 * sidebar.tsx — Left navigation panel with view list
 */

import { state, setView, setFocus, VIEWS, icons } from "@gubbi/core"
import { For, Show } from "solid-js"

const C = {
	bg: "#0d1117",
	activeBg: "#161b22",
	activeText: "#58a6ff",
	inactiveText: "#8b949e",
	keyHint: "#484f58",
	border: "#30363d",
	badge: "#d29922",
	focused: "#388bfd",
}

interface SidebarProps {
	focused: boolean
}

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

export function Sidebar(props: SidebarProps) {
	return (
		<box
			flexDirection="column"
			width={20}
			border={["right"]}
			borderColor={props.focused ? C.focused : C.border}
			backgroundColor={C.bg}
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
							backgroundColor={isActive() ? C.activeBg : "transparent"}
							onMouseDown={() => {
								setView(view.id)
								setFocus("primary")
							}}
						>
							{/* Key hint */}
							<text fg={C.keyHint}>{view.key} </text>

							{/* Icon */}
							<text fg={isActive() ? C.activeText : C.inactiveText}>{VIEW_ICONS[view.id]} </text>

							{/* Label */}
							<text fg={isActive() ? C.activeText : C.inactiveText}>{view.label}</text>

							<box flexGrow={1} />

							{/* Badge */}
							<Show when={badge() > 0}>
								<text fg={C.badge}>{badge()}</text>
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
							fallback={<text fg={C.keyHint}>⚠ gh: not logged in</text>}
						>
							<text fg={C.keyHint}>{icons.sync} gh: checking...</text>
						</Show>
					}
				>
					<text fg={C.keyHint}>
						{icons.check} {state.github.user || "authenticated"}
					</text>
				</Show>
			</box>
		</box>
	)
}
