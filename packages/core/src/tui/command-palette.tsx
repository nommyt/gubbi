/**
 * command-palette.tsx — Fuzzy-searchable action overlay (`Ctrl+P` or `:`).
 *
 * Renders a VS Code-style command palette with fuzzy matching, keyboard
 * navigation (`j/k` or arrows), and immediate action execution on `Enter`.
 */

import { setInputActive, useTheme } from "@gubbi/core"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount, onCleanup, createMemo } from "solid-js"

// ---------------------------------------------------------------------------
// Action Registry
// ---------------------------------------------------------------------------

/** A single action that can appear in the command palette. */
export interface PaletteAction {
	/** Unique action identifier. */
	id: string
	/** Human-readable label shown in the palette list. */
	label: string
	/** Optional keyboard shortcut hint shown to the right. */
	shortcut?: string
	/** Optional category for grouping / search weighting. */
	category?: string
	/** Function invoked when the action is selected. */
	callback: () => void
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
	const q = query.toLowerCase()
	const t = target.toLowerCase()
	if (!q) return { match: true, score: 0 }
	if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) }

	let qi = 0
	let score = 0
	let lastMatchIdx = -1
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			score += lastMatchIdx === ti - 1 ? 10 : 1 // consecutive bonus
			lastMatchIdx = ti
			qi++
		}
	}
	return { match: qi === q.length, score }
}

// ---------------------------------------------------------------------------
// Command Palette Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
	/** All available actions to search through. */
	actions: PaletteAction[]
	/** Called when the palette is dismissed (`Esc`). */
	onClose: () => void
}

/**
 * Fuzzy-searchable command palette overlay.
 *
 * Supports keyboard navigation (`Up/Down`, `Ctrl+j/k`, `Ctrl+n/p`),
 * fuzzy matching against action labels and categories, and immediate
 * execution on `Enter`.
 */
export function CommandPalette(props: CommandPaletteProps) {
	const t = useTheme()
	const [query, setQuery] = createSignal("")
	const [selectedIdx, setSelectedIdx] = createSignal(0)

	onMount(() => setInputActive(true))
	onCleanup(() => setInputActive(false))

	const filtered = createMemo(() => {
		const q = query()
		if (!q) return props.actions
		return props.actions
			.map((action) => {
				const labelResult = fuzzyMatch(q, action.label)
				const catResult = action.category
					? fuzzyMatch(q, action.category)
					: { match: false, score: 0 }
				const bestScore = Math.max(labelResult.score, catResult.score)
				return { action, match: labelResult.match || catResult.match, score: bestScore }
			})
			.filter((r) => r.match)
			.sort((a, b) => b.score - a.score)
			.map((r) => r.action)
	})

	// Clamp selection when results change
	const clampedIdx = () => Math.min(selectedIdx(), Math.max(0, filtered().length - 1))

	useKeyboard((key) => {
		if (key.name === "escape") {
			key.preventDefault()
			props.onClose()
			return
		}
		if (key.name === "enter") {
			key.preventDefault()
			const item = filtered()[clampedIdx()]
			if (item) {
				props.onClose()
				item.callback()
			}
			return
		}
		if (key.name === "up" || (key.ctrl && key.name === "k") || (key.ctrl && key.name === "p")) {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(0, i - 1))
			return
		}
		if (key.name === "down" || (key.ctrl && key.name === "j") || (key.ctrl && key.name === "n")) {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(filtered().length - 1, i + 1))
			return
		}
	})

	const maxVisible = 12

	return (
		<box
			position="absolute"
			top="15%"
			left="20%"
			right="20%"
			border
			borderColor={t.borderFocused}
			backgroundColor={t.bgOverlay}
			flexDirection="column"
			padding={0}
		>
			{/* Search input */}
			<box borderColor={t.border} border={["bottom"]} height={3} paddingLeft={1} paddingRight={1}>
				<input
					focused
					placeholder="Type to search actions..."
					onSubmit={
						((v: string) => {
							setQuery(v)
							const item = filtered()[clampedIdx()]
							if (item) {
								props.onClose()
								item.callback()
							}
						}) as unknown as () => void
					}
				/>
			</box>

			{/* Results */}
			<box flexDirection="column" padding={0} height={Math.min(filtered().length, maxVisible) + 1}>
				<Show
					when={filtered().length > 0}
					fallback={
						<box padding={1}>
							<text fg={t.textMuted}>No matching actions</text>
						</box>
					}
				>
					<For each={filtered().slice(0, maxVisible)}>
						{(action, i) => {
							const isSelected = () => i() === clampedIdx()
							return (
								<box
									flexDirection="row"
									paddingLeft={1}
									paddingRight={1}
									height={1}
									backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
								>
									<text fg={isSelected() ? t.text : t.textSecondary} flexGrow={1}>
										{action.label}
									</text>
									<Show when={action.category}>
										<text fg={t.textMuted}>{action.category}</text>
									</Show>
									<Show when={action.shortcut}>
										<text fg={t.accent}> {action.shortcut}</text>
									</Show>
								</box>
							)
						}}
					</For>
				</Show>
			</box>

			{/* Footer */}
			<box height={1} paddingLeft={1} border={["top"]} borderColor={t.border}>
				<text fg={t.textMuted}>
					{filtered().length} action{filtered().length !== 1 ? "s" : ""}
					{" · "}
					<span style={{ fg: t.accent }}>↑↓</span> navigate
					{" · "}
					<span style={{ fg: t.accent }}>Enter</span> run
					{" · "}
					<span style={{ fg: t.accent }}>Esc</span> close
				</text>
			</box>
		</box>
	)
}
