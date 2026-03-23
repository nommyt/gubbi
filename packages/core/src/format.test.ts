import { describe, expect, test } from "bun:test"

import { relativeTime } from "./format.ts"

describe("relativeTime", () => {
	test("returns seconds for recent timestamps", () => {
		const now = Date.now()
		expect(relativeTime(now - 30_000)).toBe("30s ago")
	})

	test("returns minutes", () => {
		const now = Date.now()
		expect(relativeTime(now - 5 * 60_000)).toBe("5m ago")
	})

	test("returns hours", () => {
		const now = Date.now()
		expect(relativeTime(now - 3 * 3600_000)).toBe("3h ago")
	})

	test("returns days", () => {
		const now = Date.now()
		expect(relativeTime(now - 7 * 86400_000)).toBe("7d ago")
	})

	test("returns months", () => {
		const now = Date.now()
		expect(relativeTime(now - 60 * 86400_000)).toBe("2mo ago")
	})

	test("returns years", () => {
		const now = Date.now()
		expect(relativeTime(now - 400 * 86400_000)).toBe("1y ago")
	})

	test("compact mode omits 'ago' suffix", () => {
		const now = Date.now()
		expect(relativeTime(now - 30_000, { compact: true })).toBe("30s")
		expect(relativeTime(now - 5 * 60_000, { compact: true })).toBe("5m")
		expect(relativeTime(now - 3 * 3600_000, { compact: true })).toBe("3h")
	})

	test("accepts ISO date strings", () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
		expect(relativeTime(fiveMinAgo)).toBe("5m ago")
	})

	test("accepts Date objects", () => {
		const d = new Date(Date.now() - 3 * 3600_000)
		expect(relativeTime(d)).toBe("3h ago")
	})

	test("accepts epoch milliseconds", () => {
		const ts = Date.now() - 7 * 86400_000
		expect(relativeTime(ts)).toBe("7d ago")
	})

	test("returns input string for invalid date strings", () => {
		expect(relativeTime("not-a-date")).toBe("not-a-date")
	})

	test("returns empty string for NaN numbers", () => {
		expect(relativeTime(NaN)).toBe("")
	})
})
