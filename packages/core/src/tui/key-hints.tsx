/**
 * key-hints.tsx — Reusable keybinding hint bar for view footers.
 *
 * Renders a single-line bar with `key label` pairs separated by ` · `.
 * Accepts optional children rendered after the hint text (e.g. status indicators).
 */

import type { JSX } from "solid-js"
import { For } from "solid-js"

import { useTheme } from "../theme.ts"

/** A single keybinding hint rendered inside a {@link KeyHints} bar. */
export interface KeyHint {
	/** Key or key combo label (e.g. `"j/k"`, `"Enter"`, `"^r"`). */
	key: string
	/** Human-readable description of the action. */
	label: string
}

interface KeyHintsProps {
	/** Keybinding hints to display. */
	hints: KeyHint[]
	/** Optional trailing content (e.g. auto-refresh indicator). */
	children?: JSX.Element
}

/**
 * Footer bar displaying keybinding hints for the current view.
 *
 * Each key is rendered in the accent colour, with labels in secondary text.
 * Used across all gubbi views for consistent key-hint display.
 */
export function KeyHints(props: KeyHintsProps) {
	const t = useTheme()
	return (
		<box height={1} paddingLeft={1} border={["top"]} borderColor={t.border}>
			<text fg={t.textSecondary}>
				<For each={props.hints}>
					{(hint, i) => (
						<>
							<span style={{ fg: t.accent }}>{hint.key}</span> {hint.label}
							{i() < props.hints.length - 1 ? " · " : ""}
						</>
					)}
				</For>
			</text>
			{props.children}
		</box>
	)
}
