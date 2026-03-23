/**
 * gh-notifications.ts — GitHub notification operations via the `gh` CLI.
 *
 * List, mark as read, and mute notification threads for the authenticated user.
 */

import { exec } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A GitHub notification for the authenticated user. */
export interface Notification {
	/** Notification thread ID. */
	id: string
	/** Subject of the notification (issue, PR, release, etc.). */
	subject: {
		/** Title of the subject (e.g. PR title). */
		title: string
		/** Subject type — `"PullRequest"`, `"Issue"`, `"Release"`, etc. */
		type: string
		/** API URL for the notification subject. */
		url: string
	}
	/** Full repository name (e.g. `"owner/repo"`). */
	repository: string
	/** Reason for the notification — `"mention"`, `"review_requested"`, `"assign"`, `"author"`, etc. */
	reason: string
	/** Whether this notification is unread. */
	unread: boolean
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List notifications for the authenticated user.
 *
 * @param opts.all   - Include read notifications (default: unread only).
 * @param opts.limit - Maximum results per page.
 * @returns Array of {@link Notification}, or `[]` on failure.
 */
export async function listNotifications(
	opts: { all?: boolean; limit?: number } = {},
): Promise<Notification[]> {
	const args = ["api", "notifications"]
	const params: string[] = []
	if (opts.all) params.push("all=true")
	if (opts.limit) params.push(`per_page=${opts.limit}`)
	if (params.length) args.push(`?${params.join("&")}`)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map((raw) => ({
			id: (raw.id as string | null | undefined) ?? "",
			subject: {
				title: ((raw.subject as Record<string, unknown>)?.title as string | null | undefined) ?? "",
				type: ((raw.subject as Record<string, unknown>)?.type as string | null | undefined) ?? "",
				url: ((raw.subject as Record<string, unknown>)?.url as string | null | undefined) ?? "",
			},
			repository:
				((raw.repository as Record<string, unknown>)?.full_name as string | null | undefined) ?? "",
			reason: (raw.reason as string | null | undefined) ?? "",
			unread: Boolean(raw.unread),
			updatedAt: (raw.updated_at as string | null | undefined) ?? "",
		}))
	} catch {
		return []
	}
}

/**
 * Mark a single notification thread as read.
 * @returns `true` if the notification was marked successfully.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
	const r = await exec(GH, ["api", "--method", "PATCH", `notifications/threads/${id}`])
	return r.exitCode === 0
}

/**
 * Mark all notifications as read.
 * @returns `true` if the operation succeeded.
 */
export async function markAllNotificationsRead(): Promise<boolean> {
	const r = await exec(GH, ["api", "--method", "PUT", "notifications"])
	return r.exitCode === 0
}

/**
 * Mute (ignore) a notification thread so future updates are silenced.
 * @returns `true` if the thread was muted successfully.
 */
export async function muteNotificationThread(id: string): Promise<boolean> {
	const r = await exec(GH, ["api", "--method", "PUT", `notifications/threads/${id}/subscription`], {
		input: JSON.stringify({ ignored: true }),
	})
	return r.exitCode === 0
}
