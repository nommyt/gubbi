/**
 * which-key.tsx — Contextual hint overlay showing available key completions.
 *
 * Appears at the bottom-right corner when a prefix key is pressed.
 * Auto-dismisses after a timeout or when the user presses the next key.
 * Inspired by Neovim's which-key and Emacs' which-key-mode.
 */

import { useTheme } from "@gubbi/core"
import { For } from "solid-js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single key completion shown inside the {@link WhichKey} overlay. */
export interface WhichKeyBinding {
	/** The follow-up key (e.g. `"b"`, `"Enter"`). */
	key: string
	/** Human-readable description of the action. */
	label: string
}

interface WhichKeyProps {
	/** The prefix key that was pressed (displayed as the overlay header). */
	prefix: string
	/** Available follow-up key completions for this prefix. */
	bindings: WhichKeyBinding[]
}

// ---------------------------------------------------------------------------
// WhichKey Overlay
// ---------------------------------------------------------------------------

/**
 * Floating overlay listing available key completions after a prefix key.
 *
 * Renders in the bottom-right corner with the prefix followed by each
 * binding's key and label.
 */
export function WhichKey(props: WhichKeyProps) {
	const t = useTheme()

	return (
		<box
			position="absolute"
			bottom={2}
			right={1}
			border
			borderColor={t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={0}
			paddingLeft={1}
			paddingRight={1}
		>
			<text fg={t.accent} paddingBottom={0}>
				{props.prefix}…
			</text>
			<For each={props.bindings}>
				{(binding) => (
					<box flexDirection="row" gap={1} height={1}>
						<text fg={t.accent} width={4}>
							{binding.key}
						</text>
						<text fg={t.textSecondary}>{binding.label}</text>
					</box>
				)}
			</For>
		</box>
	)
}
