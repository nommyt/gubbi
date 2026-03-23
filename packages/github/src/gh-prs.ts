/**
 * gh-prs.ts — Pull request operations via the `gh` CLI.
 *
 * Covers listing, viewing, creating, merging, reviewing, checking out,
 * closing, reopening, and commenting on pull requests. Also includes
 * cross-repo PR search via {@link searchMyOpenPRs}.
 */

import { exec } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A reviewer attached to a pull request. */
export interface PRReviewer {
	/** GitHub login of the reviewer. */
	login: string
	/** Current review state. */
	state: "APPROVED" | "CHANGES_REQUESTED" | "PENDING" | "COMMENTED" | "DISMISSED"
}

/** A CI status check associated with a pull request. */
export interface PRCheck {
	/** Name of the check or status context. */
	name: string
	/** Execution status. */
	status: "QUEUED" | "IN_PROGRESS" | "COMPLETED"
	/** Final conclusion once completed, or `null` while still running. */
	conclusion:
		| "SUCCESS"
		| "FAILURE"
		| "SKIPPED"
		| "CANCELLED"
		| "TIMED_OUT"
		| "ACTION_REQUIRED"
		| null
	/** URL to the check run details page. */
	detailsUrl: string
}

/** A pull request in the current repository. */
export interface PullRequest {
	/** PR number (e.g. 123). */
	number: number
	/** PR title. */
	title: string
	/** Current state — OPEN, CLOSED, or MERGED. */
	state: "OPEN" | "CLOSED" | "MERGED"
	/** Whether this PR is a draft. */
	isDraft: boolean
	/** Login of the PR author. */
	author: string
	/** Source branch name. */
	headRefName: string
	/** Target branch name. */
	baseRefName: string
	/** Markdown body of the PR description. */
	body: string
	/** Label names attached to this PR. */
	labels: string[]
	/** Reviewers and their review states. */
	reviewers: PRReviewer[]
	/** CI status checks. */
	checks: PRCheck[]
	/** Lines added. */
	additions: number
	/** Lines deleted. */
	deletions: number
	/** Number of files changed. */
	changedFiles: number
	/** ISO-8601 creation timestamp. */
	createdAt: string
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
	/** Web URL for this PR. */
	url: string
	/** Merge conflict status — MERGEABLE, CONFLICTING, or UNKNOWN. */
	mergeable: string
	/** Detailed merge-state status from GitHub. */
	mergeStateStatus: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PR_FIELDS = [
	"number",
	"title",
	"state",
	"isDraft",
	"author",
	"headRefName",
	"baseRefName",
	"body",
	"labels",
	"reviewDecision",
	"additions",
	"deletions",
	"changedFiles",
	"createdAt",
	"updatedAt",
	"url",
	"mergeable",
	"mergeStateStatus",
	"statusCheckRollup",
].join(",")

function mapPR(raw: Record<string, unknown>): PullRequest {
	const labels = Array.isArray(raw.labels)
		? (raw.labels as Array<{ name: string }>).map((l) => l.name)
		: []

	const reviewers: PRReviewer[] = []
	if (Array.isArray(raw.reviews)) {
		for (const r of raw.reviews as Array<{ author: { login: string }; state: string }>) {
			reviewers.push({ login: r.author?.login ?? "", state: r.state as PRReviewer["state"] })
		}
	}

	const checks: PRCheck[] = []
	if (Array.isArray(raw.statusCheckRollup)) {
		for (const c of raw.statusCheckRollup as Array<Record<string, unknown>>) {
			checks.push({
				name:
					(c.name as string | null | undefined) ?? (c.context as string | null | undefined) ?? "",
				status: ((c.status as string | null | undefined) ?? "COMPLETED") as PRCheck["status"],
				conclusion: (c.conclusion ?? c.state ?? null) as PRCheck["conclusion"],
				detailsUrl:
					(c.detailsUrl as string | null | undefined) ??
					(c.targetUrl as string | null | undefined) ??
					"",
			})
		}
	}

	const author =
		typeof raw.author === "object" && raw.author !== null
			? (((raw.author as Record<string, unknown>).login as string | null | undefined) ?? "")
			: ((raw.author as string | null | undefined) ?? "")

	return {
		number: Number(raw.number),
		title: (raw.title as string | null | undefined) ?? "",
		state: ((raw.state as string | null | undefined) ?? "OPEN") as PullRequest["state"],
		isDraft: Boolean(raw.isDraft),
		author,
		headRefName: (raw.headRefName as string | null | undefined) ?? "",
		baseRefName: (raw.baseRefName as string | null | undefined) ?? "",
		body: (raw.body as string | null | undefined) ?? "",
		labels,
		reviewers,
		checks,
		additions: Number(raw.additions ?? 0),
		deletions: Number(raw.deletions ?? 0),
		changedFiles: Number(raw.changedFiles ?? 0),
		createdAt: (raw.createdAt as string | null | undefined) ?? "",
		updatedAt: (raw.updatedAt as string | null | undefined) ?? "",
		url: (raw.url as string | null | undefined) ?? "",
		mergeable: (raw.mergeable as string | null | undefined) ?? "UNKNOWN",
		mergeStateStatus: (raw.mergeStateStatus as string | null | undefined) ?? "",
	}
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List pull requests in the current repository.
 *
 * @param opts.state  - Filter by state (default: open).
 * @param opts.limit  - Maximum results to return (default: 50).
 * @param opts.author - Filter by author login.
 * @param opts.label  - Filter by label name.
 * @param opts.search - Free-text search query.
 * @returns Parsed {@link PullRequest} array, or `[]` on failure.
 */
export async function listPRs(
	opts: {
		state?: "open" | "closed" | "merged" | "all"
		limit?: number
		author?: string
		label?: string
		search?: string
	} = {},
): Promise<PullRequest[]> {
	const args = ["pr", "list", "--json", PR_FIELDS, "--limit", String(opts.limit ?? 50)]
	if (opts.state && opts.state !== "all") args.push("--state", opts.state)
	if (opts.author) args.push("--author", opts.author)
	if (opts.label) args.push("--label", opts.label)
	if (opts.search) args.push("--search", opts.search)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapPR)
	} catch {
		return []
	}
}

/**
 * Fetch a single pull request by number.
 * @returns The {@link PullRequest}, or `null` if not found.
 */
export async function getPR(number: number): Promise<PullRequest | null> {
	const r = await exec(GH, ["pr", "view", String(number), "--json", PR_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapPR(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Fetch the pull request associated with the current branch.
 * @returns The {@link PullRequest}, or `null` if none exists.
 */
export async function getPRForCurrentBranch(): Promise<PullRequest | null> {
	const r = await exec(GH, ["pr", "view", "--json", PR_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapPR(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Create a new pull request from the current branch.
 *
 * @param opts.title  - PR title (required).
 * @param opts.body   - Markdown description (required).
 * @param opts.base   - Target branch (defaults to repo default).
 * @param opts.draft  - Create as a draft PR.
 * @param opts.labels - Label names to attach.
 * @returns The newly created {@link PullRequest}, or `null` on failure.
 */
export async function createPR(opts: {
	title: string
	body: string
	base?: string
	draft?: boolean
	labels?: string[]
}): Promise<PullRequest | null> {
	const args = ["pr", "create", "--title", opts.title, "--body", opts.body, "--json", PR_FIELDS]
	if (opts.base) args.push("--base", opts.base)
	if (opts.draft) args.push("--draft")
	if (opts.labels?.length) args.push("--label", opts.labels.join(","))

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return null
	try {
		return mapPR(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Merge a pull request.
 *
 * @param number - PR number to merge.
 * @param method - Merge strategy: merge commit, squash, or rebase (default: merge).
 * @param opts.deleteAfterMerge - Delete the head branch after merging.
 * @returns `true` if the merge succeeded.
 */
export async function mergePR(
	number: number,
	method: "merge" | "squash" | "rebase" = "merge",
	opts: { deleteAfterMerge?: boolean } = {},
): Promise<boolean> {
	const args = ["pr", "merge", String(number), `--${method}`]
	if (opts.deleteAfterMerge) args.push("--delete-branch")
	const r = await exec(GH, args)
	return r.exitCode === 0
}

/**
 * Retrieve the raw unified diff for a pull request.
 * @returns The diff string (may be empty if the PR has no changes).
 */
export async function getPRDiff(number: number): Promise<string> {
	const r = await exec(GH, ["pr", "diff", String(number)])
	return r.stdout
}

/**
 * Submit a review on a pull request.
 *
 * @param number - PR number to review.
 * @param action - Review action: approve, request changes, or leave a comment.
 * @param body   - Optional review body text.
 * @returns `true` if the review was submitted successfully.
 */
export async function reviewPR(
	number: number,
	action: "approve" | "request-changes" | "comment",
	body?: string,
): Promise<boolean> {
	const args = ["pr", "review", String(number), `--${action}`]
	if (body) args.push("--body", body)
	const r = await exec(GH, args)
	return r.exitCode === 0
}

/**
 * Check out a pull request's branch locally.
 * @returns `true` if the checkout succeeded.
 */
export async function checkoutPR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "checkout", String(number)])
	return r.exitCode === 0
}

/**
 * Close an open pull request without merging.
 * @returns `true` if the PR was closed successfully.
 */
export async function closePR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "close", String(number)])
	return r.exitCode === 0
}

/**
 * Reopen a previously closed pull request.
 * @returns `true` if the PR was reopened successfully.
 */
export async function reopenPR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "reopen", String(number)])
	return r.exitCode === 0
}

/**
 * Request reviews from one or more GitHub users on a pull request.
 *
 * @param number    - PR number.
 * @param reviewers - Array of GitHub logins to request reviews from.
 * @returns `true` if all reviewers were added successfully.
 */
export async function requestReviewers(number: number, reviewers: string[]): Promise<boolean> {
	if (reviewers.length === 0) return true
	const args = ["pr", "edit", String(number), ...reviewers.flatMap((r) => ["--add-reviewer", r])]
	const result = await exec(GH, args)
	return result.exitCode === 0
}

/**
 * Add a comment to a pull request.
 * @returns `true` if the comment was posted successfully.
 */
export async function commentOnPR(number: number, body: string): Promise<boolean> {
	const r = await exec(GH, ["pr", "comment", String(number), "--body", body])
	return r.exitCode === 0
}

// ---------------------------------------------------------------------------
// Cross-repo PR search
// ---------------------------------------------------------------------------

/** A pull request returned by the cross-repo search API. */
export interface SearchPR {
	/** PR number. */
	number: number
	/** PR title. */
	title: string
	/** Current state. */
	state: "open" | "closed" | "merged"
	/** Whether this PR is a draft. */
	isDraft: boolean
	/** Full repository name (e.g. `"owner/repo"`). */
	repository: string
	/** Web URL for this PR. */
	url: string
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
	/** CI status checks. */
	checks: PRCheck[]
}

/**
 * Search for all open PRs authored by the authenticated user across all repos.
 *
 * @param opts.limit - Maximum results (default: 50).
 * @returns Array of {@link SearchPR}, or `[]` on failure.
 */
export async function searchMyOpenPRs(opts: { limit?: number } = {}): Promise<SearchPR[]> {
	const args = [
		"search",
		"prs",
		"--author",
		"@me",
		"--state",
		"open",
		"--json",
		"number,title,state,isDraft,repository,url,updatedAt,statusCheckRollup",
		"--limit",
		String(opts.limit ?? 50),
	]

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as Array<Record<string, unknown>>
		return data.map((raw) => {
			const repo = raw.repository as Record<string, unknown> | undefined
			const checks: PRCheck[] = []
			if (Array.isArray(raw.statusCheckRollup)) {
				for (const c of raw.statusCheckRollup as Array<Record<string, unknown>>) {
					checks.push({
						name:
							(c.name as string | null | undefined) ??
							(c.context as string | null | undefined) ??
							"",
						status: ((c.status as string | null | undefined) ?? "COMPLETED") as PRCheck["status"],
						conclusion: (c.conclusion ?? c.state ?? null) as PRCheck["conclusion"],
						detailsUrl:
							(c.detailsUrl as string | null | undefined) ??
							(c.targetUrl as string | null | undefined) ??
							"",
					})
				}
			}
			return {
				number: Number(raw.number ?? 0),
				title: (raw.title as string | null | undefined) ?? "",
				state: ((raw.state as string | null | undefined) ?? "open") as SearchPR["state"],
				isDraft: Boolean(raw.isDraft),
				repository:
					(repo?.nameWithOwner as string | null | undefined) ??
					(repo?.name as string | null | undefined) ??
					"",
				url: (raw.url as string | null | undefined) ?? "",
				updatedAt: (raw.updatedAt as string | null | undefined) ?? "",
				checks,
			}
		})
	} catch {
		return []
	}
}
