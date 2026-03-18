/**
 * sidebar.tsx — Left navigation panel with view list
 */

import { For, Show } from "solid-js"
import { state, setView, setFocus, VIEWS, type ViewName } from "../lib/store.ts"

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

const VIEW_ICONS: Record<ViewName, string> = {
  smartlog:      "◈",
  status:        "◉",
  log:           "≡",
  branches:      "⎇",
  stacks:        "⬡",
  stash:         "⚑",
  prs:           "⤲",
  issues:        "◎",
  actions:       "▶",
  notifications: "◆",
  remotes:       "⊙",
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
          const isActive = () => state.currentView === view.id
          const badge = () => {
            if (view.id === "notifications") return state.unreadNotifications > 0 ? state.unreadNotifications : 0
            if (view.id === "status") return state.statusEntries.length
            if (view.id === "prs") return state.prs.filter(p => p.state === "OPEN").length
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
              <text fg={isActive() ? C.activeText : C.inactiveText}>
                {VIEW_ICONS[view.id]}{" "}
              </text>

              {/* Label */}
              <text fg={isActive() ? C.activeText : C.inactiveText}>
                {view.label}
              </text>

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
          when={state.isGhAuthenticated}
          fallback={<text fg={C.keyHint}>⚠ gh: login needed</text>}
        >
          <text fg={C.keyHint}>⬡ {state.ghUser || "authenticated"}</text>
        </Show>
      </box>
    </box>
  )
}
