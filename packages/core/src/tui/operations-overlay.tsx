/**
 * operations-overlay.tsx — Shows recent git operations timeline for undo support
 */

import { getOperations, clearOperations, type OperationEntry } from "@gubbi/core"
import { icons } from "@gubbi/core"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	dim: "#8b949e",
	text: "#e6edf3",
	hash: "#8b949e",
	undone: "#484f58",
	commit: "#3fb950",
}

function formatTime(ts: number): string {
	const diff = (Date.now() - ts) / 1000
	if (diff < 60) return `${Math.floor(diff)}s ago`
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
	return `${Math.floor(diff / 86400)}d ago`
}

interface OperationsOverlayProps {
	onClose: () => void
}

export function OperationsOverlay(props: OperationsOverlayProps) {
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
			borderColor={C.activeBorder}
			title="operations (Ctrl+Z to undo)"
		>
			<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
				<For each={operations()}>
					{(op) => (
						<box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
							<box flexDirection="row" gap={1}>
								<text fg={op.undone ? C.undone : C.commit}>
									{op.undone ? icons.circleSlash : icons.circleFilled}
								</text>
								<text fg={op.undone ? C.undone : C.text}>
									{op.type}: {op.description}
								</text>
								<box flexGrow={1} />
								<text fg={C.dim}>{formatTime(op.timestamp)}</text>
							</box>
							<box flexDirection="row" paddingLeft={2} gap={1}>
								<text fg={C.hash}>{op.beforeHash.slice(0, 7)}</text>
								<text fg={C.dim}>→</text>
								<text fg={C.hash}>{op.afterHash.slice(0, 7)}</text>
								<Show when={op.undone}>
									<text fg={C.undone}> (undone)</text>
								</Show>
							</box>
						</box>
					)}
				</For>

				<Show when={operations().length === 0}>
					<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
						<text fg={C.dim}>No operations recorded</text>
					</box>
				</Show>
			</scrollbox>

			<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
				<text fg={C.dim}>
					<span style={{ fg: "#58a6ff" }}>c</span> clear ·{" "}
					<span style={{ fg: "#58a6ff" }}>Esc</span> close
				</text>
			</box>
		</box>
	)
}
