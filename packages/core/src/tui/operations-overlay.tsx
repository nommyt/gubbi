/**
 * operations-overlay.tsx — Recent git operations timeline for undo support.
 *
 * Displays a scrollable list of recorded git operations (commit, merge,
 * rebase, etc.) with before/after hashes and relative timestamps.
 * Supports clearing the log via `c` and closing via `Esc`.
 */

import {
	getOperations,
	clearOperations,
	type OperationEntry,
	useTheme,
	relativeTime,
} from "@gubbi/core"
import { icons } from "@gubbi/core"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"

interface OperationsOverlayProps {
	/** Called when the user presses `Esc` to close. */
	onClose: () => void
}

/**
 * Operations timeline overlay.
 *
 * Shows each recorded git operation with its type, description,
 * before → after hashes, and relative timestamp. Press `c` to clear
 * the log, `Esc` to close.
 */
export function OperationsOverlay(props: OperationsOverlayProps) {
	const t = useTheme()
	const [operations, setOperations] = createSignal<OperationEntry[]>(getOperations())

	useKeyboard((key) => {
		if (key.name === "escape") {
			key.preventDefault()
			props.onClose()
		} else if (key.name === "c") {
			key.preventDefault()
			clearOperations()
			setOperations([])
		}
	})

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			border
			borderColor={t.borderFocused}
			title="operations (Ctrl+Z to undo)"
		>
			<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
				<For each={operations()}>
					{(op) => (
						<box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
							<box flexDirection="row" gap={1}>
								<text fg={op.undone ? t.textMuted : t.success}>
									{op.undone ? icons.circleSlash : icons.circleFilled}
								</text>
								<text fg={op.undone ? t.textMuted : t.text}>
									{op.type}: {op.description}
								</text>
								<box flexGrow={1} />
								<text fg={t.textSecondary}>{relativeTime(op.timestamp)}</text>
							</box>
							<box flexDirection="row" paddingLeft={2} gap={1}>
								<text fg={t.textSecondary}>{op.beforeHash.slice(0, 7)}</text>
								<text fg={t.textSecondary}>→</text>
								<text fg={t.textSecondary}>{op.afterHash.slice(0, 7)}</text>
								<Show when={op.undone}>
									<text fg={t.textMuted}> (undone)</text>
								</Show>
							</box>
						</box>
					)}
				</For>

				<Show when={operations().length === 0}>
					<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
						<text fg={t.textSecondary}>No operations recorded</text>
					</box>
				</Show>
			</scrollbox>

			<box height={1} paddingLeft={1} border={["top"]} borderColor={t.border}>
				<text fg={t.textSecondary}>
					<span style={{ fg: t.accent }}>c</span> clear · <span style={{ fg: t.accent }}>Esc</span>{" "}
					close
				</text>
			</box>
		</box>
	)
}
