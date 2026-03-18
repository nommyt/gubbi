/**
 * dialog.tsx — Modal dialogs (confirm, input, select)
 */

import { createSignal, Show, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"

const C = {
  overlay: "#0d1117",
  bg: "#161b22",
  border: "#388bfd",
  title: "#e6edf3",
  text: "#8b949e",
  danger: "#f78166",
  success: "#3fb950",
  key: "#58a6ff",
  selectedBg: "#1f2937",
  selectedText: "#e6edf3",
}

// ---------------------------------------------------------------------------
// Confirm Dialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  title: string
  message: string
  dangerous?: boolean
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  useKeyboard((key) => {
    if (key.name === "y" || key.name === "enter") {
      key.preventDefault()
      props.onConfirm()
    } else if (key.name === "n" || key.name === "escape" || key.name === "q") {
      key.preventDefault()
      props.onCancel()
    }
  })

  return (
    <box
      position="absolute"
      top="30%"
      left="25%"
      right="25%"
      border
      borderColor={props.dangerous ? C.danger : C.border}
      backgroundColor={C.bg}
      flexDirection="column"
      padding={1}
      gap={1}
    >
      <text fg={props.dangerous ? C.danger : C.title}>{props.title}</text>
      <text fg={C.text}>{props.message}</text>
      <box flexDirection="row" gap={2} marginTop={1}>
        <text>
          <span style={{ fg: props.dangerous ? C.danger : C.success }}>
            [{props.confirmLabel ?? "y"} confirm]
          </span>
        </text>
        <text>
          <span style={{ fg: C.text }}>
            [{props.cancelLabel ?? "n"} cancel]
          </span>
        </text>
      </box>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Input Dialog
// ---------------------------------------------------------------------------

interface InputDialogProps {
  title: string
  placeholder?: string
  initialValue?: string
  multiline?: boolean
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InputDialog(props: InputDialogProps) {
  useKeyboard((key) => {
    if (key.name === "escape") {
      key.preventDefault()
      props.onCancel()
    }
  })

  return (
    <box
      position="absolute"
      top="30%"
      left="20%"
      right="20%"
      border
      borderColor={C.border}
      backgroundColor={C.bg}
      flexDirection="column"
      padding={1}
      gap={1}
    >
      <text fg={C.title}>{props.title}</text>
      <Show
        when={props.multiline}
        fallback={
          <box border borderColor={C.border} height={3}>
            <input
              focused
              placeholder={props.placeholder ?? ""}
              onSubmit={((v: string) => {
                if (v.trim()) props.onSubmit(v.trim())
                else props.onCancel()
              }) as unknown as () => void}
            />
          </box>
        }
      >
        <box border borderColor={C.border} height={8}>
          <textarea
            focused
            onSubmit={() => props.onCancel()}
          />
        </box>
      </Show>
      <text fg={C.text}>
        <span style={{ fg: C.key }}>Enter</span> confirm ·{" "}
        <span style={{ fg: C.key }}>Esc</span> cancel
      </text>
    </box>
  )
}

// ---------------------------------------------------------------------------
// Select Dialog
// ---------------------------------------------------------------------------

interface SelectOption {
  label: string
  description?: string
  value: string
}

interface SelectDialogProps {
  title: string
  options: SelectOption[]
  onSelect: (value: string) => void
  onCancel: () => void
}

export function SelectDialog(props: SelectDialogProps) {
  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q") {
      key.preventDefault()
      props.onCancel()
    }
  })

  const maxHeight = Math.min(props.options.length + 4, 20)

  return (
    <box
      position="absolute"
      top="20%"
      left="25%"
      right="25%"
      border
      borderColor={C.border}
      backgroundColor={C.bg}
      flexDirection="column"
      padding={1}
      height={maxHeight}
    >
      <text fg={C.title} paddingBottom={1}>{props.title}</text>
      <select
        focused
        options={props.options.map(o => ({
          name: o.label,
          description: o.description ?? "",
          value: o.value,
        }))}
        onSelect={(idx) => {
          const opt = props.options[idx]
          if (opt) props.onSelect(opt.value)
        }}
        style={{
          height: "100%",
          backgroundColor: "transparent",
          focusedBackgroundColor: "transparent",
          selectedBackgroundColor: C.selectedBg,
          selectedTextColor: C.selectedText,
          descriptionColor: C.text,
        }}
        showScrollIndicator
        wrapSelection
      />
    </box>
  )
}

// ---------------------------------------------------------------------------
// Help Overlay
// ---------------------------------------------------------------------------

interface HelpSection {
  title: string
  bindings: Array<{ key: string; description: string }>
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Global",
    bindings: [
      { key: "1-0", description: "Switch to view by number" },
      { key: "Tab", description: "Cycle panel focus" },
      { key: "f", description: "Toggle full-screen diff" },
      { key: "S", description: "Toggle side-by-side diff" },
      { key: "/", description: "Search / filter" },
      { key: "?", description: "This help" },
      { key: "Ctrl+z", description: "Undo last operation" },
      { key: "Ctrl+r", description: "Refresh all data" },
      { key: "q / Esc", description: "Go back / cancel" },
      { key: "Ctrl+c", description: "Quit" },
    ],
  },
  {
    title: "Navigation",
    bindings: [
      { key: "j / ↓", description: "Move down" },
      { key: "k / ↑", description: "Move up" },
      { key: "g", description: "Go to top" },
      { key: "G", description: "Go to bottom" },
      { key: "Ctrl+d", description: "Half page down" },
      { key: "Ctrl+u", description: "Half page up" },
      { key: "Enter", description: "Select / expand" },
    ],
  },
  {
    title: "Status",
    bindings: [
      { key: "Space", description: "Stage / unstage file" },
      { key: "a", description: "Stage all" },
      { key: "A", description: "Unstage all" },
      { key: "d", description: "Discard changes" },
      { key: "c", description: "Commit" },
      { key: "C", description: "Amend last commit" },
      { key: "s", description: "Stash" },
      { key: "p", description: "Push" },
    ],
  },
  {
    title: "Stacks",
    bindings: [
      { key: "n", description: "New branch in stack" },
      { key: "u / d", description: "Navigate up / down stack" },
      { key: "s", description: "Sync (pull trunk + restack)" },
      { key: "p", description: "Submit (push + create PRs)" },
      { key: "a", description: "Absorb staged changes" },
      { key: "F", description: "Fold into parent" },
      { key: "m", description: "Move / reparent branch" },
      { key: "r", description: "Reorder stack" },
    ],
  },
]

interface HelpOverlayProps {
  onClose: () => void
}

export function HelpOverlay(props: HelpOverlayProps) {
  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q" || key.name === "?") {
      key.preventDefault()
      props.onClose()
    }
  })

  return (
    <box
      position="absolute"
      top="5%"
      left="10%"
      right="10%"
      bottom="5%"
      border
      borderColor={C.border}
      backgroundColor={C.bg}
      flexDirection="column"
      padding={1}
    >
      <text fg={C.title} paddingBottom={1}>
        <span style={{ fg: C.key }}>gubbi</span> — keyboard shortcuts
      </text>
      <scrollbox flexGrow={1}>
        <For each={HELP_SECTIONS}>
          {(section) => (
            <box flexDirection="column" marginBottom={1}>
              <text fg={C.key}>{section.title}</text>
              <For each={section.bindings}>
                {(binding) => (
                  <box flexDirection="row" gap={1}>
                    <text fg={C.key} width={14}>{binding.key}</text>
                    <text fg={C.text}>{binding.description}</text>
                  </box>
                )}
              </For>
            </box>
          )}
        </For>
      </scrollbox>
      <text fg={C.text} marginTop={1}>
        Press <span style={{ fg: C.key }}>?</span> or{" "}
        <span style={{ fg: C.key }}>Esc</span> to close
      </text>
    </box>
  )
}
