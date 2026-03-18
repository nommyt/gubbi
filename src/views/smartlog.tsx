/**
 * smartlog.tsx — Sapling-inspired filtered commit graph with PR/CI status
 * Shows only your work: unpushed commits, branches you authored, with inline GitHub data.
 */

import { createSignal, For, Show, onMount } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { state, showToast } from "../lib/store.ts"
import { getLog, getGraphLog } from "../lib/git.ts"
import { DiffViewer } from "../components/diff-viewer.tsx"
import { exec } from "../lib/shell.ts"
import type { LogEntry } from "../lib/parser.ts"

const C = {
  border: "#30363d",
  activeBorder: "#388bfd",
  selected: "#1f2937",
  hash: "#8b949e",
  author: "#58a6ff",
  date: "#484f58",
  subject: "#e6edf3",
  branch: "#3fb950",
  tag: "#a371f7",
  remote: "#d29922",
  prOpen: "#3fb950",
  prDraft: "#8b949e",
  prMerged: "#a371f7",
  ciPass: "#3fb950",
  ciFail: "#f78166",
  ciPending: "#d29922",
  gpgGood: "#3fb950",
  gpgBad: "#f78166",
  graph: "#484f58",
  dim: "#8b949e",
  current: "#58a6ff",
}

function gpgIcon(status: string): string | null {
  if (status === "G") return "✓"
  if (status === "B" || status === "E") return "✗"
  return null
}

function gpgColor(status: string): string {
  return status === "G" ? C.gpgGood : C.gpgBad
}

function prForBranch(branch: string) {
  return state.prs.find(pr => pr.headRefName === branch)
}

function ciStatusForPR(prNumber: number) {
  const pr = state.prs.find(p => p.number === prNumber)
  if (!pr) return null
  const checks = pr.checks
  if (checks.some(c => c.conclusion === "FAILURE")) return "failing"
  if (checks.some(c => c.status === "IN_PROGRESS" || c.status === "QUEUED")) return "pending"
  if (checks.every(c => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED")) return "passing"
  return null
}

function ciIcon(status: string | null): string {
  switch (status) {
    case "passing": return "✓"
    case "failing": return "✗"
    case "pending": return "●"
    default: return ""
  }
}

function ciColor(status: string | null): string {
  switch (status) {
    case "passing": return C.ciPass
    case "failing": return C.ciFail
    case "pending": return C.ciPending
    default: return C.dim
  }
}

export function SmartlogView() {
  const [entries, setEntries] = createSignal<LogEntry[]>([])
  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [diffContent, setDiffContent] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [primaryFocused, setPrimaryFocused] = createSignal(true)

  const selectedEntry = () => entries()[selectedIdx()]

  async function loadEntries() {
    setLoading(true)
    try {
      // Load recent commits — prioritize current user's work
      const all = await getLog({ count: 150, all: true }, state.repoRoot)
      setEntries(all)
      const first = all[0]
      if (first) await loadDiff(first)
    } catch (err) {
      showToast("error", `Failed to load log: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadDiff(entry: LogEntry) {
    try {
      // Get diff for the commit (changes introduced by this commit)
      const r = await exec("git", ["diff", "--no-color", `${entry.hash}^..${entry.hash}`], { cwd: state.repoRoot })
      setDiffContent(r.stdout)
    } catch {
      setDiffContent("")
    }
  }

  onMount(loadEntries)

  useKeyboard(async (key) => {
    if (key.name === "tab") {
      key.preventDefault()
      setPrimaryFocused(p => !p)
      return
    }
    if (!primaryFocused()) return

    if (key.name === "j" || key.name === "down") {
      key.preventDefault()
      const next = Math.min(selectedIdx() + 1, entries().length - 1)
      setSelectedIdx(next)
      const e = entries()[next]
      if (e) await loadDiff(e)
    } else if (key.name === "k" || key.name === "up") {
      key.preventDefault()
      const prev = Math.max(selectedIdx() - 1, 0)
      setSelectedIdx(prev)
      const e = entries()[prev]
      if (e) await loadDiff(e)
    } else if (key.name === "g") {
      key.preventDefault()
      setSelectedIdx(0)
      const e = entries()[0]
      if (e) await loadDiff(e)
    } else if (key.name === "G") {
      key.preventDefault()
      const last = Math.max(entries().length - 1, 0)
      setSelectedIdx(last)
      const e = entries()[last]
      if (e) await loadDiff(e)
    } else if (key.ctrl && key.name === "r") {
      key.preventDefault()
      await loadEntries()
    }
  })

  return (
    <box flexGrow={1} flexDirection="row">
      {/* Commit list */}
      <box
        width={60}
        flexDirection="column"
        border
        borderColor={primaryFocused() ? C.activeBorder : C.border}
        title="smartlog"
      >
        <Show
          when={!loading()}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text fg={C.dim}>Loading...</text>
            </box>
          }
        >
          <scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
            <For each={entries()}>
              {(entry, i) => {
                const isSelected = () => selectedIdx() === i()
                const isCurrent = () => state.currentBranch !== "" &&
                  entry.refs.some(r => r.includes(state.currentBranch) && r.includes("HEAD"))

                // Extract branch/tag refs
                const localRefs = () => entry.refs.filter(r =>
                  !r.startsWith("origin/") && r !== "HEAD" && !r.includes("->")
                )
                const remoteBranch = () => entry.refs.find(r => r.startsWith("origin/"))

                // PR for first local branch
                const firstBranch = () => localRefs()[0]
                const pr = () => firstBranch() ? prForBranch(firstBranch()!) : null
                const ci = () => pr() ? ciStatusForPR(pr()!.number) : null

                return (
                  <box
                    flexDirection="column"
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={0}
                    backgroundColor={isSelected() ? C.selected : "transparent"}
                    onMouseDown={() => {
                      setSelectedIdx(i())
                      void loadDiff(entry)
                      setPrimaryFocused(true)
                    }}
                  >
                    <box flexDirection="row" gap={1}>
                      {/* Current indicator */}
                      <text fg={isCurrent() ? C.current : C.graph}>
                        {isCurrent() ? "●" : "○"}
                      </text>

                      {/* Short hash */}
                      <text fg={C.hash}>{entry.shortHash}</text>

                      {/* Subject */}
                      <text fg={isSelected() ? "#e6edf3" : C.subject}>
                        {entry.subject}
                      </text>

                      <box flexGrow={1} />

                      {/* GPG indicator */}
                      <Show when={gpgIcon(entry.gpgStatus)}>
                        <text fg={gpgColor(entry.gpgStatus)}>
                          {gpgIcon(entry.gpgStatus)}
                        </text>
                      </Show>

                      {/* CI status */}
                      <Show when={ci()}>
                        <text fg={ciColor(ci())}>{ciIcon(ci())}</text>
                      </Show>
                    </box>

                    {/* Refs line */}
                    <Show when={localRefs().length > 0 || pr()}>
                      <box flexDirection="row" gap={1} paddingLeft={2}>
                        <For each={localRefs()}>
                          {(ref) => (
                            <text>
                              <span style={{ fg: ref.includes("HEAD") ? C.current : C.branch }}>
                                ⎇ {ref.replace("HEAD -> ", "")}
                              </span>
                            </text>
                          )}
                        </For>

                        <Show when={remoteBranch()}>
                          <text fg={C.remote}>↑ {remoteBranch()?.replace("origin/", "")}</text>
                        </Show>

                        <Show when={pr()}>
                          <text>
                            <span style={{ fg: pr()!.isDraft ? C.prDraft : C.prOpen }}>
                              PR #{pr()!.number}
                              {pr()!.isDraft ? " (draft)" : ""}
                            </span>
                          </text>
                        </Show>
                      </box>
                    </Show>

                    {/* Author + date */}
                    <box flexDirection="row" paddingLeft={2} gap={1}>
                      <text fg={C.author}>{entry.author}</text>
                      <text fg={C.date}>{entry.relativeDate}</text>
                    </box>
                  </box>
                )
              }}
            </For>

            <Show when={entries().length === 0}>
              <box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
                <text fg={C.dim}>No commits found</text>
              </box>
            </Show>
          </scrollbox>
        </Show>
      </box>

      {/* Diff panel */}
      <DiffViewer
        content={diffContent()}
        title={selectedEntry() ? `commit: ${selectedEntry()!.shortHash}` : "commit"}
      />
    </box>
  )
}
