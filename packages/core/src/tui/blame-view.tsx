/**
 * blame-view.tsx — Git blame overlay for file lines.
 *
 * Parses `git blame --porcelain` output and displays per-line
 * commit hash, author, relative date, and file content in a
 * scrollable, keyboard-navigable overlay.
 */

import { state, useTheme, relativeTime } from "@gubbi/core"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

/** A single line of blame output with commit metadata. */
export interface BlameLine {
	/** Abbreviated commit hash (8 chars). */
	hash: string
	/** Author name (truncated to 16 chars). */
	author: string
	/** Human-readable relative date (e.g. `"3d ago"`). */
	date: string
	/** Source line content. */
	content: string
}

/**
 * Run `git blame --porcelain` on a file and parse the result.
 *
 * @param filePath - Path to the file to blame.
 * @param cwd      - Working directory (defaults to repo root).
 * @returns Array of {@link BlameLine}, or `[]` on failure.
 */
export async function getBlame(filePath: string, cwd?: string): Promise<BlameLine[]> {
	try {
		const proc = Bun.spawn(["git", "blame", "--porcelain", "--", filePath], {
			cwd: cwd ?? state.git.repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		})
		const [stdout] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		])
		const exitCode = await proc.exited
		if (exitCode !== 0) return []
		return parseBlamePorcelain(stdout)
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
		const date = authorTime ? relativeTime(Number(authorTime) * 1000) : ""

		result.push({
			hash: hash.slice(0, 8),
			author: (info["author"] ?? "unknown").slice(0, 16),
			date,
			content,
		})
	}

	return result
}

interface BlameViewProps {
	/** Path to the file being blamed. */
	filePath: string
	/** Called when the user presses `Esc` to close. */
	onClose: () => void
	/** Called when the user presses `Enter` to jump to a commit. */
	onJumpToCommit?: (hash: string) => void
}

/**
 * Full-screen git blame viewer.
 *
 * Displays per-line blame annotations with `j/k` navigation,
 * `Enter` to jump to a commit, and `Esc` to close.
 */
export function BlameView(props: BlameViewProps) {
	const t = useTheme()
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
			borderColor={t.borderFocused}
			title={`blame: ${props.filePath}`}
		>
			<Show
				when={!loading()}
				fallback={
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={t.textSecondary}>Loading blame...</text>
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
									backgroundColor={isSelected() ? t.bgSecondary : "transparent"}
									onMouseDown={() => setSelectedIdx(i())}
								>
									<text fg={t.textSecondary}>{line.hash}</text>
									<text fg={t.accent}>{line.author.padEnd(16)}</text>
									<text fg={t.textMuted}>{line.date.padEnd(8)}</text>
									<text fg={t.text}>{line.content}</text>
								</box>
							)
						}}
					</For>
				</scrollbox>
			</Show>

			<box height={1} paddingLeft={1} border={["top"]} borderColor={t.border}>
				<text fg={t.textSecondary}>
					<span style={{ fg: t.accent }}>j/k</span> nav ·{" "}
					<span style={{ fg: t.accent }}>Enter</span> jump to commit ·{" "}
					<span style={{ fg: t.accent }}>Esc</span> close
				</text>
			</box>
		</box>
	)
}
