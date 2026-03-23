/**
 * dialog.tsx — Modal dialog components (confirm, input, select, help).
 *
 * All dialogs render as absolutely-positioned overlays and capture
 * keyboard input while open.
 */

import { setInputActive, useTheme } from "@gubbi/core"
import { useKeyboard } from "@opentui/solid"
import { Show, For, onMount, onCleanup } from "solid-js"

// ---------------------------------------------------------------------------
// Confirm Dialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
	/** Dialog title text. */
	title: string
	/** Descriptive message shown below the title. */
	message: string
	/** If `true`, renders the dialog with danger-coloured borders and text. */
	dangerous?: boolean
	/** Label for the confirm button (default: `"y"`). */
	confirmLabel?: string
	/** Label for the cancel button (default: `"n"`). */
	cancelLabel?: string
	/** Called when the user confirms (presses `y` or `Enter`). */
	onConfirm: () => void
	/** Called when the user cancels (presses `n`, `Esc`, or `q`). */
	onCancel: () => void
}

/**
 * Yes/no confirmation dialog.
 *
 * Press `y` or `Enter` to confirm, `n` / `Esc` / `q` to cancel.
 * Use `dangerous` for destructive actions like delete or discard.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
	const t = useTheme()

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
			borderColor={props.dangerous ? t.borderDanger : t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={1}
			gap={1}
		>
			<text fg={props.dangerous ? t.error : t.text}>{props.title}</text>
			<text fg={t.textSecondary}>{props.message}</text>
			<box flexDirection="row" gap={2} marginTop={1}>
				<text>
					<span style={{ fg: props.dangerous ? t.error : t.success }}>
						[{props.confirmLabel ?? "y"} confirm]
					</span>
				</text>
				<text>
					<span style={{ fg: t.textSecondary }}>[{props.cancelLabel ?? "n"} cancel]</span>
				</text>
			</box>
		</box>
	)
}

// ---------------------------------------------------------------------------
// Input Dialog
// ---------------------------------------------------------------------------

interface InputDialogProps {
	/** Dialog title text. */
	title: string
	/** Placeholder text for the input field. */
	placeholder?: string
	/** Pre-filled value. */
	initialValue?: string
	/** Render a multiline textarea instead of a single-line input. */
	multiline?: boolean
	/** Called with the trimmed value when the user presses `Enter`. */
	onSubmit: (value: string) => void
	/** Called when the user presses `Esc`. */
	onCancel: () => void
}

/**
 * Text input dialog.
 *
 * Supports single-line and multiline modes. Activates the global
 * input lock while open so that view-level keybindings are suppressed.
 */
export function InputDialog(props: InputDialogProps) {
	const t = useTheme()

	onMount(() => setInputActive(true))
	onCleanup(() => setInputActive(false))

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
			borderColor={t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={1}
			gap={1}
		>
			<text fg={t.text}>{props.title}</text>
			<Show
				when={props.multiline}
				fallback={
					<box border borderColor={t.border} height={3}>
						<input
							focused
							placeholder={props.placeholder ?? ""}
							onSubmit={
								((v: string) => {
									if (v.trim()) props.onSubmit(v.trim())
									else props.onCancel()
								}) as unknown as () => void
							}
						/>
					</box>
				}
			>
				<box border borderColor={t.border} height={8}>
					<textarea focused onSubmit={() => props.onCancel()} />
				</box>
			</Show>
			<text fg={t.textSecondary}>
				<span style={{ fg: t.accent }}>Enter</span> confirm ·{" "}
				<span style={{ fg: t.accent }}>Esc</span> cancel
			</text>
		</box>
	)
}

// ---------------------------------------------------------------------------
// Select Dialog
// ---------------------------------------------------------------------------

/** A single option in a {@link SelectDialog}. */
interface SelectOption {
	/** Display label. */
	label: string
	/** Optional secondary description. */
	description?: string
	/** Value passed to `onSelect` when this option is chosen. */
	value: string
}

interface SelectDialogProps {
	/** Dialog title text. */
	title: string
	/** List of selectable options. */
	options: SelectOption[]
	/** Called with the selected option's value. */
	onSelect: (value: string) => void
	/** Called when the user presses `Esc` or `q`. */
	onCancel: () => void
}

/**
 * Scrollable selection dialog with arrow-key navigation.
 *
 * Uses OpenTUI's native `<select>` component for the option list.
 */
export function SelectDialog(props: SelectDialogProps) {
	const t = useTheme()

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
			borderColor={t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={1}
			height={maxHeight}
		>
			<text fg={t.text} paddingBottom={1}>
				{props.title}
			</text>
			<select
				focused
				options={props.options.map((o) => ({
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
					selectedBackgroundColor: t.bgTertiary,
					selectedTextColor: t.text,
					descriptionColor: t.textSecondary,
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

/** A group of keybindings displayed in the help overlay. */
interface HelpSection {
	/** Section heading (e.g. `"Global"`, `"Status"`). */
	title: string
	/** Keybinding entries in this section. */
	bindings: Array<{ key: string; description: string }>
}

/** All keyboard shortcut sections shown in the help overlay. */
const HELP_SECTIONS: HelpSection[] = [
	{
		title: "Global",
		bindings: [
			{ key: "d", description: "Dashboard" },
			{ key: "1-9", description: "Switch to view by number" },
			{ key: "0", description: "Notifications" },
			{ key: "Tab", description: "Cycle panel focus" },
			{ key: "f", description: "Toggle full-screen diff" },
			{ key: "S", description: "Toggle side-by-side diff" },
			{ key: "/", description: "Search / filter" },
			{ key: "?", description: "This help" },
			{ key: "Ctrl+t", description: "Switch theme" },
			{ key: "Mod+r", description: "Refresh all data (Cmd on Mac, Ctrl on other)" },
			{ key: "q / Esc", description: "Go back / cancel" },
			{ key: "Mod+c", description: "Quit (Cmd on Mac, Ctrl on other)" },
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
	/** Called when the user closes the overlay (`?`, `Esc`, or `q`). */
	onClose: () => void
}

/**
 * Full-screen help overlay listing all keyboard shortcuts.
 *
 * Renders scrollable sections for global, navigation, status, and
 * stacks keybindings.
 */
export function HelpOverlay(props: HelpOverlayProps) {
	const t = useTheme()

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
			borderColor={t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={1}
		>
			<text fg={t.text} paddingBottom={1}>
				<span style={{ fg: t.accent }}>gubbi</span> — keyboard shortcuts
			</text>
			<scrollbox flexGrow={1}>
				<For each={HELP_SECTIONS}>
					{(section) => (
						<box flexDirection="column" marginBottom={1}>
							<text fg={t.accent}>{section.title}</text>
							<For each={section.bindings}>
								{(binding) => (
									<box flexDirection="row" gap={1}>
										<text fg={t.accent} width={14}>
											{binding.key}
										</text>
										<text fg={t.textSecondary}>{binding.description}</text>
									</box>
								)}
							</For>
						</box>
					)}
				</For>
			</scrollbox>
			<text fg={t.textSecondary} marginTop={1}>
				Press <span style={{ fg: t.accent }}>?</span> or <span style={{ fg: t.accent }}>Esc</span>{" "}
				to close
			</text>
		</box>
	)
}
