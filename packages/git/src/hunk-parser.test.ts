import { describe, expect, test } from "bun:test"

import { parseDiff, hunkToPatch } from "./hunk-parser.ts"

const SIMPLE_DIFF = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 line 1
+added line
 line 2
 line 3`

const MULTI_HUNK_DIFF = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 line 1
+added line
 line 2
 line 3
@@ -10,3 +11,2 @@
 line 10
-removed line
 line 12`

const MULTI_FILE_DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 original
+new line
 end
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -5,3 +5,2 @@
 context
-deleted
 more`

describe("parseDiff", () => {
	test("parses a simple single-hunk diff", () => {
		const result = parseDiff(SIMPLE_DIFF)
		expect(result.hunks).toHaveLength(1)
		expect(result.hunks[0].file).toBe("src/app.ts")
		expect(result.hunks[0].oldStart).toBe(1)
		expect(result.hunks[0].oldCount).toBe(3)
		expect(result.hunks[0].newStart).toBe(1)
		expect(result.hunks[0].newCount).toBe(4)
		expect(result.hunks[0].hasChanges).toBe(true)
	})

	test("parses multiple hunks in same file", () => {
		const result = parseDiff(MULTI_HUNK_DIFF)
		expect(result.hunks).toHaveLength(2)
		expect(result.hunks[0].oldStart).toBe(1)
		expect(result.hunks[1].oldStart).toBe(10)
	})

	test("parses multi-file diffs", () => {
		const result = parseDiff(MULTI_FILE_DIFF)
		expect(result.hunks).toHaveLength(2)
		expect(result.hunks[0].file).toBe("src/a.ts")
		expect(result.hunks[1].file).toBe("src/b.ts")
	})

	test("detects additions and removals", () => {
		const result = parseDiff(MULTI_HUNK_DIFF)
		expect(result.hunks[0].lines.some((l) => l.startsWith("+"))).toBe(true)
		expect(result.hunks[1].lines.some((l) => l.startsWith("-"))).toBe(true)
	})

	test("handles empty input", () => {
		const result = parseDiff("")
		expect(result.hunks).toHaveLength(0)
		expect(result.fileHeaders).toHaveLength(0)
	})

	test("hunk index increments sequentially", () => {
		const result = parseDiff(MULTI_HUNK_DIFF)
		expect(result.hunks[0].index).toBe(0)
		expect(result.hunks[1].index).toBe(1)
	})
})

describe("hunkToPatch", () => {
	test("generates valid patch for a hunk", () => {
		const { hunks, fileHeaders } = parseDiff(SIMPLE_DIFF)
		const patch = hunkToPatch(hunks[0], fileHeaders)
		expect(patch).toContain("diff --git")
		expect(patch).toContain("@@")
		expect(patch).toContain("+added line")
		expect(patch.endsWith("\n")).toBe(true)
	})

	test("includes correct file in patch headers", () => {
		const { hunks, fileHeaders } = parseDiff(MULTI_FILE_DIFF)
		const patchA = hunkToPatch(hunks[0], fileHeaders)
		expect(patchA).toContain("src/a.ts")
		const patchB = hunkToPatch(hunks[1], fileHeaders)
		expect(patchB).toContain("src/b.ts")
	})
})
