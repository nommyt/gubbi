/**
 * blame-view.tsx — Git blame overlay for file lines
 */

import { state } from "@gubbi/core"
import { exec } from "@gubbi/git"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	hash: "#8b949e",
	author: "#58a6ff",
	date: "#484f58",
	content: "#e6edf3",
	dim: "#8b949e",
}

export interface BlameLine {
	hash: string
	author: string
	date: string
	content: string
}

export async function getBlame(filePath: string, cwd?: string): Promise<BlameLine[]> {
	try {
		const r = await exec("git", ["blame", "--porcelain", "--", filePath], {
			cwd: cwd ?? state.git.repoRoot,
		})
		if (r.exitCode !== 0) return []
		return parseBlamePorcelain(r.stdout)
	} catch {
		return []
	}
}

function parseBlamePorcelain(raw: string): BlameLine[] {
	const lines = raw.split("\n")
	const result: BlameLine[] = []
	let i = 0

	while (i < lines.length) {
		const header = lines[i]
		if (!header) {
			i++
			continue
		}

		const hash = header.split(" ")[0] ?? ""
		const info: Record<string, string> = {}
		i++

		// Read metadata lines until we hit a content line
		while (i < lines.length) {
			const line = lines[i]
			if (line === undefined || line.startsWith("\t")) break
			const spaceIdx = line.indexOf(" ")
			if (spaceIdx > 0) {
				const key = line.slice(0, spaceIdx)
				const val = line.slice(spaceIdx + 1)
				info[key] = val
			}
			i++
		}

		// Content line starts with tab
		const content = (lines[i] ?? "").slice(1)
		i++

		const authorTime = info["author-time"]
		const date = authorTime ? formatDate(new Date(Number(authorTime) * 1000)) : ""

		result.push({
			hash: hash.slice(0, 8),
			author: (info["author"] ?? "unknown").slice(0, 16),
			date,
			content,
		})
	}

	return result
}

function formatDate(d: Date): string {
	const now = new Date()
	const diff = (now.getTime() - d.getTime()) / 1000
	if (diff < 60) return `${Math.floor(diff)}s ago`
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
	if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
	return `${Math.floor(diff / (86400 * 30))}mo ago`
}

interface BlameViewProps {
	filePath: string
	onClose: () => void
	onJumpToCommit?: (hash: string) => void
}

export function BlameView(props: BlameViewProps) {
	const [lines, setLines] = createSignal<BlameLine[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [loading, setLoading] = createSignal(true)

	onMount(async () => {
		setLoading(true)
		const result = await getBlame(props.filePath)
		setLines(result)
		setLoading(false)
	})

	useKeyboard((key) => {
		if (key.name === "escape") {
			key.preventDefault()
			props.onClose()
		} else if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, lines().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "enter") {
			key.preventDefault()
			const line = lines()[selectedIdx()]
			if (line && props.onJumpToCommit) {
				props.onJumpToCommit(line.hash)
			}
		}
	})

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			border
			borderColor={C.activeBorder}
			title={`blame: ${props.filePath}`}
		>
			<Show
				when={!loading()}
				fallback={
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={C.dim}>Loading blame...</text>
					</box>
				}
			>
				<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
					<For each={lines()}>
						{(line, i) => {
							const isSelected = () => selectedIdx() === i()
							return (
								<box
									flexDirection="row"
									paddingLeft={1}
									paddingRight={1}
									gap={1}
									backgroundColor={isSelected() ? C.selected : "transparent"}
									onMouseDown={() => setSelectedIdx(i())}
								>
									<text fg={C.hash}>{line.hash}</text>
									<text fg={C.author}>{line.author.padEnd(16)}</text>
									<text fg={C.date}>{line.date.padEnd(8)}</text>
									<text fg={isSelected() ? "#e6edf3" : C.content}>{line.content}</text>
								</box>
							)
						}}
					</For>
				</scrollbox>
			</Show>

			<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
				<text fg={C.dim}>
					<span style={{ fg: "#58a6ff" }}>j/k</span> nav ·{" "}
					<span style={{ fg: "#58a6ff" }}>Enter</span> jump to commit ·{" "}
					<span style={{ fg: "#58a6ff" }}>Esc</span> close
				</text>
			</box>
		</box>
	)
}
