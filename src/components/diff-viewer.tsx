/**
 * diff-viewer.tsx — Diff display using OpenTUI's built-in <diff> component
 * Supports full-screen toggle and side-by-side mode.
 */

import { Show, createMemo } from "solid-js"
import { state } from "../lib/store.ts"

const C = {
  bg: "transparent",
  border: "#30363d",
  title: "#8b949e",
  noChange: "#484f58",
  empty: "#484f58",
}

interface DiffViewerProps {
  content: string
  title?: string
  staged?: boolean
  /** Whether this panel is currently full-screen */
  fullscreen?: boolean
  /** Called when user presses f/F to toggle full screen */
  onToggleFullscreen?: () => void
}

export function DiffViewer(props: DiffViewerProps) {
  const isEmpty = () => !props.content || props.content.trim() === ""

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderColor={C.border}
      title={props.title ?? "diff"}
    >
      <Show
        when={!isEmpty()}
        fallback={
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg={C.empty}>No changes</text>
          </box>
        }
      >
        <scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
          <diff
            diff={props.content}
            flexGrow={1}
          />
        </scrollbox>
      </Show>

      {/* Status bar for diff */}
      <box
        height={1}
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
        border={["top"]}
        borderColor={C.border}
      >
        <text fg={C.title}>
          {props.staged ? "staged" : "unstaged"} ·{" "}
          <span style={{ fg: "#58a6ff" }}>f</span> fullscreen ·{" "}
          <span style={{ fg: "#58a6ff" }}>S</span> side-by-side
        </text>
      </box>
    </box>
  )
}
