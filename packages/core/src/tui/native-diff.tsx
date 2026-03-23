/**
 * native-diff.tsx — Themed diff viewer using OpenTUI's native `<diff>` element.
 *
 * Passes raw unified diff strings directly to the native renderer for
 * syntax-highlighted, unified or side-by-side display. Automatically
 * detects the file language for highlighting.
 */

import { useTheme } from "@gubbi/core"
import { Show } from "solid-js"

// ---------------------------------------------------------------------------
// File type detection for syntax highlighting
// ---------------------------------------------------------------------------

/** Maps file extensions to tree-sitter language identifiers. */
const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	py: "python",
	rs: "rust",
	go: "go",
	rb: "ruby",
	java: "java",
	kt: "kotlin",
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	cs: "c_sharp",
	swift: "swift",
	zig: "zig",
	lua: "lua",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	xml: "xml",
	html: "html",
	css: "css",
	scss: "css",
	md: "markdown",
	sql: "sql",
	graphql: "graphql",
	proto: "protobuf",
	dockerfile: "dockerfile",
}

/**
 * Detect the tree-sitter language identifier from a file path.
 * Falls back to `undefined` if the extension is unrecognised.
 */
function detectLanguage(filepath?: string): string | undefined {
	if (!filepath) return undefined
	const name = filepath.split("/").pop()?.toLowerCase() ?? ""
	if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile"
	if (name === "makefile") return "make"
	const ext = name.split(".").pop() ?? ""
	return EXT_TO_LANG[ext]
}

// ---------------------------------------------------------------------------
// NativeDiff — Primary component
// ---------------------------------------------------------------------------

interface NativeDiffProps {
	/** Raw unified diff string (git diff output) */
	content: string
	/** Display mode */
	mode?: "unified" | "split"
	/** File path for language detection */
	filepath?: string
	/** Explicit language override */
	language?: string
	/** Panel title */
	title?: string
	/** Whether diff is of staged changes */
	staged?: boolean
	/** Whether this panel is full-screen */
	fullscreen?: boolean
	/** Toggle fullscreen callback */
	onToggleFullscreen?: () => void
	/** Currently selected hunk index (-1 = none) */
	selectedHunk?: number
	/** Total number of hunks */
	hunkCount?: number
	/** Hunk navigation callback */
	onNavigateHunk?: (direction: "prev" | "next") => void
	/** Stage selected hunk callback */
	onStageHunk?: () => void
	/** Show line numbers */
	showLineNumbers?: boolean
}

/**
 * Themed diff viewer panel.
 *
 * Wraps OpenTUI's native `<diff>` element with theme-aware colours,
 * automatic language detection, hunk navigation hints, and a status
 * bar showing staged/unstaged state.
 */
export function NativeDiff(props: NativeDiffProps) {
	const t = useTheme()
	const filetype = () => props.language ?? detectLanguage(props.filepath)
	const isEmpty = () => !props.content?.trim()
	const hasHunks = () => props.hunkCount !== undefined && props.hunkCount > 0
	const selectedHunk = () => props.selectedHunk ?? -1

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			border
			borderColor={t.border}
			title={props.title ?? "diff"}
		>
			<Show
				when={!isEmpty()}
				fallback={
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={t.textMuted}>No changes</text>
					</box>
				}
			>
				<diff
					diff={props.content}
					view={props.mode ?? "unified"}
					filetype={filetype()}
					showLineNumbers={props.showLineNumbers ?? true}
					addedBg={t.diffAddedBg}
					removedBg={t.diffRemovedBg}
					contextBg="transparent"
					flexGrow={1}
				/>
			</Show>

			{/* Status bar */}
			<box
				height={1}
				flexDirection="row"
				paddingLeft={1}
				paddingRight={1}
				border={["top"]}
				borderColor={t.border}
			>
				<text fg={t.textSecondary}>{props.staged ? "staged" : "unstaged"}</text>
				<Show when={hasHunks()}>
					<text fg={t.textSecondary}>
						{" · "}hunk {selectedHunk() + 1}/{props.hunkCount}
					</text>
					<text fg={t.textSecondary}>
						{" · "}
						<span style={{ fg: t.accent }}>[</span>
						<span style={{ fg: t.accent }}>]</span> navigate
						{" · "}
						<span style={{ fg: t.accent }}>s</span> stage
						{" · "}
						<span style={{ fg: t.accent }}>u</span> unstage
						{" · "}
						<span style={{ fg: t.accent }}>S</span> stage line
					</text>
				</Show>
				<text fg={t.textSecondary}>
					{" · "}
					<span style={{ fg: t.accent }}>f</span> fullscreen
				</text>
			</box>
		</box>
	)
}
