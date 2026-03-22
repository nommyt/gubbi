/**
 * hunk-parser.ts — Parse unified diffs into navigable hunks for staging
 */

export interface DiffHunk {
	/** Index in the hunk list */
	index: number
	/** The file this hunk belongs to */
	file: string
	/** The @@ header line */
	header: string
	/** Lines in this hunk (including context, additions, removals) */
	lines: string[]
	/** Starting line number in the original file */
	oldStart: number
	/** Number of lines in the original file */
	oldCount: number
	/** Starting line number in the new file */
	newStart: number
	/** Number of lines in the new file */
	newCount: number
	/** Whether this hunk has any changes (additions or removals) */
	hasChanges: boolean
}

export interface ParsedDiff {
	/** File headers (diff --git, ---, +++) */
	fileHeaders: string[]
	/** All hunks */
	hunks: DiffHunk[]
}

/**
 * Parse a unified diff string into file headers and hunks.
 */
export function parseDiff(diff: string): ParsedDiff {
	const lines = diff.split("\n")
	const fileHeaders: string[] = []
	const hunks: DiffHunk[] = []

	let currentFile = ""
	let currentHeaders: string[] = []
	let currentHunkLines: string[] = []
	let currentHeader = ""
	let hunkIndex = 0

	const commitHunk = () => {
		if (currentHeader && currentHunkLines.length > 0) {
			const parsed = parseHunkHeader(currentHeader)
			if (parsed) {
				const hasChanges = currentHunkLines.some((l) => l.startsWith("+") || l.startsWith("-"))
				hunks.push({
					index: hunkIndex++,
					file: currentFile,
					header: currentHeader,
					lines: [...currentHunkLines],
					oldStart: parsed.oldStart,
					oldCount: parsed.oldCount,
					newStart: parsed.newStart,
					newCount: parsed.newCount,
					hasChanges,
				})
			}
		}
		currentHunkLines = []
		currentHeader = ""
	}

	for (const line of lines) {
		if (line.startsWith("diff --git")) {
			// Flush any pending hunk
			commitHunk()
			// Start new file
			currentHeaders = [line]
			currentFile = extractFilePath(line)
			continue
		}

		if (line.startsWith("---") || line.startsWith("+++")) {
			currentHeaders.push(line)
			continue
		}

		if (line.startsWith("@@")) {
			// Flush previous hunk
			commitHunk()
			// Store file headers for this file if not yet stored
			if (currentHeaders.length > 0) {
				fileHeaders.push(...currentHeaders)
				currentHeaders = []
			}
			currentHeader = line
			continue
		}

		if (currentHeader) {
			currentHunkLines.push(line)
		}
	}

	// Flush final hunk
	commitHunk()

	return { fileHeaders, hunks }
}

/**
 * Generate an apply-able patch for a single hunk.
 * Includes the file headers needed for `git apply --cached`.
 */
export function hunkToPatch(hunk: DiffHunk, fileHeaders: string[]): string {
	const patch: string[] = []

	// Add file headers
	for (const h of fileHeaders) {
		if (h.startsWith("diff --git") && !h.includes(hunk.file)) continue
		if (h.startsWith("---") && !h.includes(hunk.file)) continue
		if (h.startsWith("+++") && !h.includes(hunk.file)) continue
		patch.push(h)
	}

	// Ensure we have the right file headers
	if (!patch.some((l) => l.startsWith("---"))) {
		patch.push(`--- a/${hunk.file}`)
	}
	if (!patch.some((l) => l.startsWith("+++"))) {
		patch.push(`+++ b/${hunk.file}`)
	}

	// Add hunk header and lines
	patch.push(hunk.header)
	patch.push(...hunk.lines)

	// Ensure trailing newline
	return patch.join("\n") + "\n"
}

/**
 * Generate an apply-able patch for a single line within a hunk.
 * Uses the changed line plus surrounding context lines.
 */
export function lineToPatch(hunk: DiffHunk, fileHeaders: string[], lineIndex: number): string {
	const line = hunk.lines[lineIndex]
	if (!line) return hunkToPatch(hunk, fileHeaders)

	const isChange = line.startsWith("+") || line.startsWith("-")
	if (!isChange) return hunkToPatch(hunk, fileHeaders)

	// Build a minimal hunk: context lines before, the change line, context lines after
	const contextBefore: string[] = []
	const contextAfter: string[] = []

	// Gather context before
	for (let i = lineIndex - 1; i >= 0; i--) {
		const l = hunk.lines[i]
		if (l && l.startsWith(" ")) {
			contextBefore.unshift(l)
		} else {
			break
		}
	}

	// Gather context after
	for (let i = lineIndex + 1; i < hunk.lines.length; i++) {
		const l = hunk.lines[i]
		if (l && l.startsWith(" ")) {
			contextAfter.push(l)
		} else {
			break
		}
	}

	const patchLines = [...contextBefore, line, ...contextAfter]

	// Build the @@ header with correct line numbers
	const parsed = parseHunkHeader(hunk.header)
	if (!parsed) return hunkToPatch(hunk, fileHeaders)

	// Calculate new start based on offset of our line within the hunk
	let oldStart = parsed.oldStart
	let newStart = parsed.newStart
	for (let i = 0; i < lineIndex; i++) {
		const l = hunk.lines[i]
		if (!l?.startsWith("+")) oldStart++
		if (!l?.startsWith("-")) newStart++
	}
	// Back up for context before
	oldStart -= contextBefore.length
	newStart -= contextBefore.length

	const oldCount = patchLines.filter((l) => !l.startsWith("+")).length
	const newCount = patchLines.filter((l) => !l.startsWith("-")).length

	const patch: string[] = []
	for (const h of fileHeaders) {
		if (h.startsWith("diff --git") && !h.includes(hunk.file)) continue
		if (h.startsWith("---") && !h.includes(hunk.file)) continue
		if (h.startsWith("+++") && !h.includes(hunk.file)) continue
		patch.push(h)
	}
	if (!patch.some((l) => l.startsWith("---"))) patch.push(`--- a/${hunk.file}`)
	if (!patch.some((l) => l.startsWith("+++"))) patch.push(`+++ b/${hunk.file}`)

	patch.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`)
	patch.push(...patchLines)

	return patch.join("\n") + "\n"
}

function parseHunkHeader(header: string): {
	oldStart: number
	oldCount: number
	newStart: number
	newCount: number
} | null {
	// @@ -oldStart,oldCount +newStart,newCount @@
	const match = header.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
	if (!match) return null
	const [, m1 = "0", m2, m3 = "0", m4] = match
	return {
		oldStart: parseInt(m1, 10),
		oldCount: m2 ? parseInt(m2, 10) : 1,
		newStart: parseInt(m3, 10),
		newCount: m4 ? parseInt(m4, 10) : 1,
	}
}

function extractFilePath(diffLine: string): string {
	// diff --git a/path/to/file b/path/to/file
	const match = diffLine.match(/diff --git a\/(.+?) b\/(.+)/)
	return match?.[2] ?? ""
}
