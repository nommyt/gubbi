/**
 * persist.ts — Simple JSON state persistence for filter/UI state across sessions
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const STATE_DIR = join(homedir(), ".gubbi")
const STATE_FILE = join(STATE_DIR, "state.json")

function ensureDir() {
	mkdirSync(STATE_DIR, { recursive: true })
}

/**
 * Read persisted state from ~/.gubbi/state.json
 * Returns an empty object if the file doesn't exist or is invalid.
 */
export function readPersistedState(): Record<string, unknown> {
	try {
		if (!existsSync(STATE_FILE)) return {}
		const raw = readFileSync(STATE_FILE, "utf-8")
		return JSON.parse(raw)
	} catch {
		return {}
	}
}

/**
 * Write a value to persisted state, merging with existing state.
 */
export function writePersistedState(partial: Record<string, unknown>) {
	try {
		ensureDir()
		const existing = readPersistedState()
		const merged = { ...existing, ...partial }
		writeFileSync(STATE_FILE, JSON.stringify(merged, null, "\t"))
	} catch {
		// Silently fail — persistence is best-effort
	}
}

/**
 * Read a single key from persisted state.
 */
export function getPersistedValue<T>(key: string, fallback: T): T {
	const state = readPersistedState()
	return key in state ? (state[key] as T) : fallback
}

/**
 * Write a single key to persisted state.
 */
export function setPersistedValue(key: string, value: unknown) {
	writePersistedState({ [key]: value })
}
