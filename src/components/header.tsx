/**
 * header.tsx — Top bar: repo name, branch, sync status, file counts, PR/CI info
 */

import { Show, For } from "solid-js"
import type { PullRequest } from "../lib/gh.ts"
import { state } from "../lib/store.ts"

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
}

function ciIcon(status: string): string {
  switch (status) {
    case "passing": return "✓"
    case "failing": return "✗"
    case "pending": return "●"
    default: return "○"
  }
}

function ciColor(status: string): string {
  switch (status) {
    case "passing": return C.ciPass
    case "failing": return C.ciFail
    case "pending": return C.ciPending
    default: return C.dim
  }
}

export function Header() {
  const stagedCount = () => state.statusEntries.filter(e => e.staged).length
  const modifiedCount = () => state.statusEntries.filter(e => !e.staged && e.unstaged && e.type !== "untracked").length
  const untrackedCount = () => state.statusEntries.filter(e => e.type === "untracked").length

  const currentPR = () => state.prs.find(pr => pr.headRefName === state.currentBranch)

  return (
    <box
      flexDirection="row"
      alignItems="center"
      height={3}
      border={["bottom"]}
      borderColor={C.border}
      backgroundColor={C.bg}
      paddingLeft={1}
      paddingRight={1}
      gap={1}
    >
      {/* Repo name */}
      <text fg={C.text}>
        <span style={{ fg: C.branding }}>⬡</span>
        {" "}
        <span style={{ fg: C.text }}>{state.repoName || "gub"}</span>
      </text>

      <text fg={C.dim}>│</text>

      {/* Branch */}
      <text>
        <span style={{ fg: C.dim }}>⎇ </span>
        <span style={{ fg: C.branch }}>{state.currentBranch || "—"}</span>
      </text>

      {/* Ahead/behind */}
      <Show when={state.ahead > 0 || state.behind > 0}>
        <text>
          <Show when={state.ahead > 0}>
            <span style={{ fg: C.ahead }}>↑{state.ahead}</span>
          </Show>
          <Show when={state.behind > 0}>
            <span style={{ fg: C.behind }}> ↓{state.behind}</span>
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
          <Show when={currentPR()?.isDraft}>
            <span style={{ fg: C.prDraft }}> draft</span>
          </Show>
        </text>
      </Show>

      {/* Spacer */}
      <box flexGrow={1} />

      {/* GitHub auth indicator */}
      <Show when={!state.isGhAuthenticated && state.isGitRepo}>
        <text fg={C.dim}>gh: not authenticated</text>
        <text fg={C.dim}>│</text>
      </Show>

      {/* Unread notifications badge */}
      <Show when={state.unreadNotifications > 0}>
        <text>
          <span style={{ fg: C.modified }}>🔔 {state.unreadNotifications}</span>
        </text>
        <text fg={C.dim}>│</text>
      </Show>

      {/* Branding */}
      <text>
        <span style={{ fg: C.branding }}>gub</span>
        <span style={{ fg: C.dim }}> v0.1</span>
      </text>
    </box>
  )
}
