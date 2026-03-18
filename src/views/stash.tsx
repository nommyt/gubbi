/**
 * stash.tsx — Stash management: list, preview, apply/pop/drop
 */

import { createSignal, For, Show, onMount } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { state, showToast } from "../lib/store.ts"
import { getStashList, stash, stashApply, stashPop, stashDrop, getStashDiff } from "../lib/git.ts"
import { refreshStatus, refreshStash } from "../hooks/use-git.ts"
import { ConfirmDialog, InputDialog, SelectDialog } from "../components/dialog.tsx"
import { DiffViewer } from "../components/diff-viewer.tsx"
import type { StashEntry } from "../lib/parser.ts"

const C = {
  border: "#30363d",
  activeBorder: "#388bfd",
  selected: "#1f2937",
  selectedText: "#e6edf3",
  text: "#e6edf3",
  branch: "#58a6ff",
  dim: "#8b949e",
  danger: "#f78166",
}

export function StashView() {
  const [entries, setEntries] = createSignal<StashEntry[]>([])
  const [selectedIdx, setSelectedIdx] = createSignal(0)
  const [diffContent, setDiffContent] = createSignal("")
  const [showApply, setShowApply] = createSignal(false)
  const [showDrop, setShowDrop] = createSignal(false)
  const [showCreate, setShowCreate] = createSignal(false)
  const [primaryFocused, setPrimaryFocused] = createSignal(true)

  const selectedEntry = () => entries()[selectedIdx()]

  async function loadEntries() {
    const stashes = await getStashList(state.repoRoot)
    setEntries(stashes)
    const first = stashes[0]
    if (first) await loadDiff(first.index)
  }

  async function loadDiff(index: number) {
    const diff = await getStashDiff(index, state.repoRoot)
    setDiffContent(diff)
  }

  onMount(() => void loadEntries())

  useKeyboard(async (key) => {
    if (showApply() || showDrop() || showCreate()) return

    if (key.name === "tab") {
      key.preventDefault()
      setPrimaryFocused(p => !p)
      return
    }
    if (!primaryFocused()) return

    const entry = selectedEntry()

    if (key.name === "j" || key.name === "down") {
      key.preventDefault()
      const next = Math.min(selectedIdx() + 1, entries().length - 1)
      setSelectedIdx(next)
      const e = entries()[next]
      if (e) await loadDiff(e.index)
    } else if (key.name === "k" || key.name === "up") {
      key.preventDefault()
      const prev = Math.max(selectedIdx() - 1, 0)
      setSelectedIdx(prev)
      const e = entries()[prev]
      if (e) await loadDiff(e.index)
    } else if (key.name === "enter" && entry) {
      key.preventDefault()
      setShowApply(true)
    } else if (key.name === "p" && entry) {
      key.preventDefault()
      try {
        await stashPop(entry.index, state.repoRoot)
        await Promise.all([loadEntries(), refreshStatus()])
        showToast("success", "Stash popped")
      } catch (err) {
        showToast("error", String(err))
      }
    } else if ((key.name === "D" && key.shift) || key.name === "d" && entry) {
      key.preventDefault()
      setShowDrop(true)
    } else if (key.name === "n") {
      key.preventDefault()
      setShowCreate(true)
    } else if (key.ctrl && key.name === "r") {
      key.preventDefault()
      await loadEntries()
    }
  })

  return (
    <box flexGrow={1} flexDirection="row">
      {/* Stash list */}
      <box
        width={45}
        flexDirection="column"
        border
        borderColor={primaryFocused() ? C.activeBorder : C.border}
        title="stash"
      >
        <Show
          when={entries().length > 0}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center">
              <text fg={C.dim}>No stashes</text>
              <text fg={C.dim}>Press n to create one</text>
            </box>
          }
        >
          <scrollbox flexGrow={1}>
            <For each={entries()}>
              {(entry, i) => {
                const isSelected = () => selectedIdx() === i()
                return (
                  <box
                    flexDirection="column"
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={1}
                    backgroundColor={isSelected() ? C.selected : "transparent"}
                    onMouseDown={() => {
                      setSelectedIdx(i())
                      void loadDiff(entry.index)
                      setPrimaryFocused(true)
                    }}
                  >
                    <box flexDirection="row" gap={1}>
                      <text fg={C.dim}>stash@{"{" + entry.index + "}"}</text>
                      <text fg={isSelected() ? C.selectedText : C.text}>
                        {entry.message}
                      </text>
                    </box>
                    <text fg={C.branch} paddingLeft={2}>on {entry.branch}</text>
                  </box>
                )
              }}
            </For>
          </scrollbox>
        </Show>

        {/* Footer */}
        <box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
          <text fg={C.dim}>
            <span style={{ fg: "#58a6ff" }}>Enter</span> apply ·{" "}
            <span style={{ fg: "#58a6ff" }}>p</span> pop ·{" "}
            <span style={{ fg: "#58a6ff" }}>D</span> drop ·{" "}
            <span style={{ fg: "#58a6ff" }}>n</span> new
          </text>
        </box>
      </box>

      {/* Diff preview */}
      <DiffViewer
        content={diffContent()}
        title={selectedEntry() ? `stash@{${selectedEntry()!.index}}` : "stash preview"}
      />

      {/* Apply confirm */}
      <Show when={showApply() && selectedEntry()}>
        <SelectDialog
          title={`Apply stash@{${selectedEntry()?.index}}`}
          options={[
            { label: "Apply (keep stash)", description: "Apply and keep the stash entry", value: "apply" },
            { label: "Pop (remove stash)", description: "Apply and remove the stash entry", value: "pop" },
          ]}
          onSelect={async (action: string) => {
            setShowApply(false)
            const entry = selectedEntry()
            if (!entry) return
            try {
              if (action === "pop") await stashPop(entry.index, state.repoRoot)
              else await stashApply(entry.index, state.repoRoot)
              await Promise.all([loadEntries(), refreshStatus()])
              showToast("success", `Stash ${action === "pop" ? "popped" : "applied"}`)
            } catch (err) {
              showToast("error", String(err))
            }
          }}
          onCancel={() => setShowApply(false)}
        />
      </Show>

      {/* Drop confirm */}
      <Show when={showDrop() && selectedEntry()}>
        <ConfirmDialog
          title="Drop stash"
          message={`Drop stash@{${selectedEntry()?.index}}: "${selectedEntry()?.message}"?`}
          dangerous
          onConfirm={async () => {
            setShowDrop(false)
            const entry = selectedEntry()
            if (!entry) return
            try {
              await stashDrop(entry.index, state.repoRoot)
              await loadEntries()
              showToast("success", "Stash dropped")
            } catch (err) {
              showToast("error", String(err))
            }
          }}
          onCancel={() => setShowDrop(false)}
        />
      </Show>

      {/* Create stash */}
      <Show when={showCreate()}>
        <InputDialog
          title="Create stash"
          placeholder="WIP: in-progress work"
          onSubmit={async (message) => {
            setShowCreate(false)
            try {
              await stash(message || undefined, { includeUntracked: true }, state.repoRoot)
              await Promise.all([loadEntries(), refreshStatus()])
              showToast("success", "Stash created")
            } catch (err) {
              showToast("error", String(err))
            }
          }}
          onCancel={() => setShowCreate(false)}
        />
      </Show>
    </box>
  )
}
