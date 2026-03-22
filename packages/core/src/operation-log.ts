/**
 * operation-log.ts — Record git operations with before/after state for undo support
 */

import { setPersistedValue, getPersistedValue } from "./persist.ts"

export interface OperationEntry {
	id: string
	type: string
	description: string
	beforeHash: string
	afterHash: string
	timestamp: number
	undone: boolean
}

const MAX_OPERATIONS = 50

/**
 * Record a git operation with before/after state.
 */
export function recordOperation(
	type: string,
	description: string,
	beforeHash: string,
	afterHash: string,
) {
	const ops = getOperations()
	const entry: OperationEntry = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		type,
		description,
		beforeHash,
		afterHash,
		timestamp: Date.now(),
		undone: false,
	}
	const updated = [entry, ...ops].slice(0, MAX_OPERATIONS)
	setPersistedValue("operations", updated)
}

/**
 * Get all recorded operations.
 */
export function getOperations(): OperationEntry[] {
	return getPersistedValue<OperationEntry[]>("operations", [])
}

/**
 * Mark the last non-undone operation as undone.
 */
export function markLastUndone(): OperationEntry | null {
	const ops = getOperations()
	const idx = ops.findIndex((op) => !op.undone)
	if (idx < 0) return null
	ops[idx]!.undone = true
	setPersistedValue("operations", ops)
	return ops[idx]!
}

/**
 * Clear the operation log.
 */
export function clearOperations() {
	setPersistedValue("operations", [])
}
