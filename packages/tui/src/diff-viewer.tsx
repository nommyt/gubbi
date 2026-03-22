/**
 * diff-viewer.tsx — Diff display with hunk-level selection for staging
 * Supports full-screen toggle and hunk navigation.
 */

import { Show, For } from "solid-js"

const C = {
	bg: "transparent",
	border: "#30363d",
	title: "#8b949e",
	empty: "#484f58",
	add: "#3fb950",
	remove: "#f78166",
	context: "#8b949e",
	hunkHeader: "#58a6ff",
	selectedBorder: "#58a6ff",
	selectedBg: "#161b22",
}

interface DiffViewerProps {
	content: string
	title?: string
	staged?: boolean
	/** Whether this panel is currently full-screen */
	fullscreen?: boolean
	/** Called when user presses f/F to toggle full screen */
	onToggleFullscreen?: () => void
	/** Currently selected hunk index (-1 = none) */
	selectedHunk?: number
	/** Total number of hunks */
	hunkCount?: number
	/** Called when navigating hunks */
	onNavigateHunk?: (direction: "prev" | "next") => void
	/** Called to stage the selected hunk */
	onStageHunk?: () => void
}

function lineColor(line: string): string {
	if (line.startsWith("+")) return C.add
	if (line.startsWith("-")) return C.remove
	return C.context
}

export function DiffViewer(props: DiffViewerProps) {
	const isEmpty = () => !props.content || props.content.trim() === ""
	const hasHunks = () => props.hunkCount !== undefined && props.hunkCount > 0
	const selectedHunk = () => props.selectedHunk ?? -1

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			border
			borderColor={C.border}
			title={props.title ?? "diff"}
		>
			<Show
				when={!isEmpty()}
				fallback={
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={C.empty}>No changes</text>
					</box>
				}
			>
				<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
					<For each={props.content.split("\n")}>
						{(line) => {
							const isHunkHeader = () => line.startsWith("@@")
							return (
								<box flexDirection="row" paddingLeft={1}>
									<text fg={isHunkHeader() ? C.hunkHeader : lineColor(line)}>{line}</text>
								</box>
							)
						}}
					</For>
				</scrollbox>
			</Show>

			{/* Status bar for diff */}
			<box
				height={1}
				flexDirection="row"
				paddingLeft={1}
				paddingRight={1}
				border={["top"]}
				borderColor={C.border}
			>
				<text fg={C.title}>{props.staged ? "staged" : "unstaged"}</text>
				<Show when={hasHunks()}>
					<text fg={C.title}>
						{" · "}hunk {selectedHunk() + 1}/{props.hunkCount}
					</text>
					<text fg={C.title}>
						{" · "}
						<span style={{ fg: "#58a6ff" }}>[</span>
						<span style={{ fg: "#58a6ff" }}>]</span> navigate
						{" · "}
						<span style={{ fg: "#58a6ff" }}>s</span> stage
						{" · "}
						<span style={{ fg: "#58a6ff" }}>u</span> unstage
						{" · "}
						<span style={{ fg: "#58a6ff" }}>S</span> stage line
					</text>
				</Show>
				<text fg={C.title}>
					{" · "}
					<span style={{ fg: "#58a6ff" }}>f</span> fullscreen
				</text>
			</box>
		</box>
	)
}
