import { describe, expect, test } from "bun:test"

import {
	parseStatus,
	parseLog,
	parseStashList,
	parseRemotes,
	LOG_SEP,
	LOG_RECORD_SEP,
} from "./parser.ts"

describe("parseStatus", () => {
	test("parses ordinary modified file", () => {
		const output = "1 .M N... 100644 100644 100644 abc123 def456 src/app.ts"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("modified")
		expect(entries[0].path).toBe("src/app.ts")
		expect(entries[0].staged).toBe(false)
		expect(entries[0].unstaged).toBe(true)
	})

	test("parses staged added file", () => {
		const output = "1 A. N... 000000 100644 100644 000000 abc123 new-file.ts"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("added")
		expect(entries[0].staged).toBe(true)
		expect(entries[0].unstaged).toBe(false)
	})

	test("parses untracked files", () => {
		const output = "? untracked.txt"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("untracked")
		expect(entries[0].path).toBe("untracked.txt")
	})

	test("parses renamed files", () => {
		const output = "2 R. N... 100644 100644 100644 abc123 def456 R100 new.ts\told.ts"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("renamed")
		expect(entries[0].path).toBe("new.ts")
		expect(entries[0].origPath).toBe("old.ts")
	})

	test("parses unmerged files", () => {
		const output = "u UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflicted.ts"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("unmerged")
	})

	test("skips header lines", () => {
		const output = "# branch.oid abc123\n# branch.head main\n? file.txt"
		const entries = parseStatus(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].type).toBe("untracked")
	})

	test("handles empty output", () => {
		expect(parseStatus("")).toHaveLength(0)
	})

	test("parses multiple entries", () => {
		const output = [
			"1 M. N... 100644 100644 100644 abc123 def456 staged.ts",
			"1 .M N... 100644 100644 100644 abc123 def456 unstaged.ts",
			"? new.txt",
		].join("\n")
		const entries = parseStatus(output)
		expect(entries).toHaveLength(3)
	})
})

describe("parseLog", () => {
	function makeRecord(fields: Partial<Record<string, string>> = {}): string {
		const {
			hash = "abc123def456",
			shortHash = "abc123d",
			author = "Test User",
			email = "test@example.com",
			authorDate = "2024-01-15 10:30:00 +0000",
			commitDate = "2024-01-15 10:30:00 +0000",
			relDate = "2 hours ago",
			subject = "fix: test commit",
			refs = "",
			parents = "",
			gpg = "N",
		} = fields
		return [
			hash,
			shortHash,
			author,
			email,
			authorDate,
			commitDate,
			relDate,
			subject,
			refs,
			parents,
			gpg,
		].join(LOG_SEP)
	}

	test("parses a single log entry", () => {
		const output = makeRecord() + LOG_RECORD_SEP
		const entries = parseLog(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].hash).toBe("abc123def456")
		expect(entries[0].shortHash).toBe("abc123d")
		expect(entries[0].author).toBe("Test User")
		expect(entries[0].subject).toBe("fix: test commit")
		expect(entries[0].gpgStatus).toBe("N")
	})

	test("parses refs into array", () => {
		const output = makeRecord({ refs: "HEAD -> main, origin/main, tag: v1.0" }) + LOG_RECORD_SEP
		const entries = parseLog(output)
		expect(entries[0].refs).toEqual(["HEAD -> main", "origin/main", "tag: v1.0"])
	})

	test("parses parent hashes", () => {
		const output = makeRecord({ parents: "aaa111 bbb222" }) + LOG_RECORD_SEP
		const entries = parseLog(output)
		expect(entries[0].parents).toEqual(["aaa111", "bbb222"])
	})

	test("handles empty output", () => {
		expect(parseLog("")).toHaveLength(0)
	})

	test("skips malformed records", () => {
		const output = "not enough fields" + LOG_RECORD_SEP
		expect(parseLog(output)).toHaveLength(0)
	})

	test("parses multiple records", () => {
		const output =
			makeRecord({ subject: "first" }) +
			LOG_RECORD_SEP +
			makeRecord({ subject: "second" }) +
			LOG_RECORD_SEP
		const entries = parseLog(output)
		expect(entries).toHaveLength(2)
		expect(entries[0].subject).toBe("first")
		expect(entries[1].subject).toBe("second")
	})
})

describe("parseStashList", () => {
	test("parses stash entries", () => {
		const output =
			"stash@{0}: WIP on main: abc123 some message\nstash@{1}: On feature: def456 other"
		const entries = parseStashList(output)
		expect(entries).toHaveLength(2)
		expect(entries[0].index).toBe(0)
		expect(entries[1].index).toBe(1)
	})

	test("handles empty output", () => {
		expect(parseStashList("")).toHaveLength(0)
	})
})

describe("parseRemotes", () => {
	test("parses remote entries", () => {
		const output =
			"origin\thttps://github.com/user/repo.git (fetch)\norigin\thttps://github.com/user/repo.git (push)"
		const entries = parseRemotes(output)
		expect(entries).toHaveLength(1)
		expect(entries[0].name).toBe("origin")
		expect(entries[0].fetchUrl).toBe("https://github.com/user/repo.git")
	})

	test("handles empty output", () => {
		expect(parseRemotes("")).toHaveLength(0)
	})
})
