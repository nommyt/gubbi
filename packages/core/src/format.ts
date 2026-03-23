/**
 * format.ts — Shared formatting utilities.
 *
 * Centralises date/time formatting functions used across views so that
 * every view renders relative timestamps consistently.
 */

/**
 * Format a date/time as a human-readable relative string (e.g. "3h ago" or "3h").
 *
 * Accepts ISO strings, epoch-ms numbers, or Date objects.
 * Use `compact: true` to omit the " ago" suffix.
 */
export function relativeTime(input: string | number | Date, opts?: { compact?: boolean }): string {
	try {
		const ts = typeof input === "number" ? input : new Date(input).getTime()
		if (Number.isNaN(ts)) return typeof input === "string" ? input : ""
		const diff = Math.floor((Date.now() - ts) / 1000)
		const suffix = opts?.compact ? "" : " ago"
		if (diff < 60) return `${diff}s${suffix}`
		const m = Math.floor(diff / 60)
		if (m < 60) return `${m}m${suffix}`
		const h = Math.floor(m / 60)
		if (h < 24) return `${h}h${suffix}`
		const d = Math.floor(h / 24)
		if (d < 30) return `${d}d${suffix}`
		const mo = Math.floor(d / 30)
		if (mo < 12) return `${mo}mo${suffix}`
		return `${Math.floor(mo / 12)}y${suffix}`
	} catch {
		return typeof input === "string" ? input : ""
	}
}
