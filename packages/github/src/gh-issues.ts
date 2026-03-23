/**
 * gh-issues.ts — GitHub issue operations via the `gh` CLI.
 *
 * List, view, create, comment on, close, and reopen issues in the
 * current repository.
 */

import { exec } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A GitHub issue in the current repository. */
export interface Issue {
	/** Issue number (e.g. 42). */
	number: number
	/** Issue title. */
	title: string
	/** Current state — OPEN or CLOSED. */
	state: "OPEN" | "CLOSED"
	/** Login of the user who opened the issue. */
	author: string
	/** Markdown body of the issue. */
	body: string
	/** Label names attached to this issue. */
	labels: string[]
	/** Logins of assigned users. */
	assignees: string[]
	/** Total number of comments. */
	comments: number
	/** Reaction emoji counts (e.g. `{ "+1": 3 }`). */
	reactions: Record<string, number>
	/** ISO-8601 creation timestamp. */
	createdAt: string
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
	/** Web URL for this issue. */
	url: string
}

/** A single comment on a GitHub issue. */
export interface IssueComment {
	/** Node ID of the comment. */
	id: string
	/** Login of the comment author. */
	author: string
	/** Markdown body. */
	body: string
	/** ISO-8601 creation timestamp. */
	createdAt: string
	/** Web URL for this comment. */
	url: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ISSUE_FIELDS = [
	"number",
	"title",
	"state",
	"author",
	"body",
	"labels",
	"assignees",
	"comments",
	"reactions",
	"createdAt",
	"updatedAt",
	"url",
].join(",")

function mapIssue(raw: Record<string, unknown>): Issue {
	const labels = Array.isArray(raw.labels)
		? (raw.labels as Array<{ name: string }>).map((l) => l.name)
		: []
	const assignees = Array.isArray(raw.assignees)
		? (raw.assignees as Array<{ login: string }>).map((a) => a.login)
		: []
	const author =
		typeof raw.author === "object" && raw.author !== null
			? (((raw.author as Record<string, unknown>).login as string | null | undefined) ?? "")
			: ((raw.author as string | null | undefined) ?? "")
	const comments =
		typeof raw.comments === "number"
			? raw.comments
			: Array.isArray(raw.comments)
				? raw.comments.length
				: 0

	return {
		number: Number(raw.number),
		title: (raw.title as string | null | undefined) ?? "",
		state: ((raw.state as string | null | undefined) ?? "OPEN") as Issue["state"],
		author,
		body: (raw.body as string | null | undefined) ?? "",
		labels,
		assignees,
		comments,
		reactions: (raw.reactions as Record<string, number>) ?? {},
		createdAt: (raw.createdAt as string | null | undefined) ?? "",
		updatedAt: (raw.updatedAt as string | null | undefined) ?? "",
		url: (raw.url as string | null | undefined) ?? "",
	}
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List issues in the current repository.
 *
 * @param opts.state  - Filter by state (default: open).
 * @param opts.limit  - Maximum number of issues to return (default: 50).
 * @param opts.labels - Filter by label names.
 * @param opts.mention - Filter to issues mentioning this user.
 * @param opts.author - Filter by author login.
 * @returns Parsed {@link Issue} array, or `[]` on failure.
 */
export async function listIssues(
	opts: {
		state?: "open" | "closed" | "all"
		limit?: number
		labels?: string[]
		mention?: string
		author?: string
	} = {},
): Promise<Issue[]> {
	const args = ["issue", "list", "--json", ISSUE_FIELDS, "--limit", String(opts.limit ?? 50)]
	if (opts.state && opts.state !== "all") args.push("--state", opts.state)
	if (opts.labels?.length) args.push("--label", opts.labels.join(","))
	if (opts.mention) args.push("--mention", opts.mention)
	if (opts.author) args.push("--author", opts.author)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapIssue)
	} catch {
		return []
	}
}

/**
 * Fetch a single issue by number.
 * @returns The {@link Issue}, or `null` if not found.
 */
export async function getIssue(number: number): Promise<Issue | null> {
	const r = await exec(GH, ["issue", "view", String(number), "--json", ISSUE_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapIssue(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Create a new issue in the current repository.
 *
 * @param opts.title     - Issue title (required).
 * @param opts.body      - Markdown body (required).
 * @param opts.labels    - Label names to attach.
 * @param opts.assignees - User logins to assign.
 * @returns The newly created {@link Issue}, or `null` on failure.
 */
export async function createIssue(opts: {
	title: string
	body: string
	labels?: string[]
	assignees?: string[]
}): Promise<Issue | null> {
	const args = [
		"issue",
		"create",
		"--title",
		opts.title,
		"--body",
		opts.body,
		"--json",
		ISSUE_FIELDS,
	]
	if (opts.labels?.length) args.push("--label", opts.labels.join(","))
	if (opts.assignees?.length) args.push("--assignee", opts.assignees.join(","))

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return null
	try {
		return mapIssue(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Fetch all comments on an issue.
 * @returns Array of {@link IssueComment}, or `[]` on failure.
 */
export async function getIssueComments(number: number): Promise<IssueComment[]> {
	const r = await exec(GH, [
		"issue",
		"view",
		String(number),
		"--json",
		"comments",
		"--jq",
		".comments[]",
	])
	if (r.exitCode !== 0) return []
	try {
		return r.stdout
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const c = JSON.parse(line) as Record<string, unknown>
				const author =
					typeof c.author === "object" && c.author !== null
						? (((c.author as Record<string, unknown>).login as string | null | undefined) ?? "")
						: ((c.author as string | null | undefined) ?? "")
				return {
					id: (c.id as string | null | undefined) ?? "",
					author,
					body: (c.body as string | null | undefined) ?? "",
					createdAt: (c.createdAt as string | null | undefined) ?? "",
					url: (c.url as string | null | undefined) ?? "",
				}
			})
	} catch {
		return []
	}
}

/**
 * Add a comment to an issue.
 * @returns `true` if the comment was posted successfully.
 */
export async function commentOnIssue(number: number, body: string): Promise<boolean> {
	const r = await exec(GH, ["issue", "comment", String(number), "--body", body])
	return r.exitCode === 0
}

/**
 * Close an open issue.
 * @returns `true` if the issue was closed successfully.
 */
export async function closeIssue(number: number): Promise<boolean> {
	const r = await exec(GH, ["issue", "close", String(number)])
	return r.exitCode === 0
}

/**
 * Reopen a previously closed issue.
 * @returns `true` if the issue was reopened successfully.
 */
export async function reopenIssue(number: number): Promise<boolean> {
	const r = await exec(GH, ["issue", "reopen", String(number)])
	return r.exitCode === 0
}
