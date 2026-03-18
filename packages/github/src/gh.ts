/**
 * gh.ts — GitHub CLI (gh) wrappers
 * All commands use `gh` with JSON output for structured parsing.
 */

import { exec, execOrThrow, execInteractive } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function isAuthenticated(): Promise<boolean> {
	const r = await exec(GH, ["auth", "status"], { timeout: 5000 })
	return r.exitCode === 0
}

export async function getAuthUser(): Promise<string> {
	try {
		const out = await execOrThrow(GH, ["api", "user", "--jq", ".login"])
		return out.trim()
	} catch {
		return ""
	}
}

/**
 * Trigger an interactive `gh auth login --web` flow.
 * This hands stdio to the terminal so the user can complete the browser-based
 * OAuth flow without leaving gubbi.
 * Returns true if login succeeded.
 */
export async function loginWeb(): Promise<boolean> {
	const exitCode = await execInteractive(GH, ["auth", "login", "--web"])
	return exitCode === 0
}

// ---------------------------------------------------------------------------
// Pull Requests
// ---------------------------------------------------------------------------

export interface PRReviewer {
	login: string
	state: "APPROVED" | "CHANGES_REQUESTED" | "PENDING" | "COMMENTED" | "DISMISSED"
}

export interface PRCheck {
	name: string
	status: "QUEUED" | "IN_PROGRESS" | "COMPLETED"
	conclusion:
		| "SUCCESS"
		| "FAILURE"
		| "SKIPPED"
		| "CANCELLED"
		| "TIMED_OUT"
		| "ACTION_REQUIRED"
		| null
	detailsUrl: string
}

export interface PullRequest {
	number: number
	title: string
	state: "OPEN" | "CLOSED" | "MERGED"
	isDraft: boolean
	author: string
	headRefName: string // source branch
	baseRefName: string // target branch
	body: string
	labels: string[]
	reviewers: PRReviewer[]
	checks: PRCheck[]
	additions: number
	deletions: number
	changedFiles: number
	createdAt: string
	updatedAt: string
	url: string
	mergeable: string // MERGEABLE | CONFLICTING | UNKNOWN
	mergeStateStatus: string
}

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
				name: String(c.name ?? c.context ?? ""),
				status: String(c.status ?? "COMPLETED") as PRCheck["status"],
				conclusion: (c.conclusion ?? c.state ?? null) as PRCheck["conclusion"],
				detailsUrl: String(c.detailsUrl ?? c.targetUrl ?? ""),
			})
		}
	}

	const author =
		typeof raw.author === "object" && raw.author !== null
			? String((raw.author as Record<string, unknown>).login ?? "")
			: String(raw.author ?? "")

	return {
		number: Number(raw.number),
		title: String(raw.title ?? ""),
		state: String(raw.state ?? "OPEN") as PullRequest["state"],
		isDraft: Boolean(raw.isDraft),
		author,
		headRefName: String(raw.headRefName ?? ""),
		baseRefName: String(raw.baseRefName ?? ""),
		body: String(raw.body ?? ""),
		labels,
		reviewers,
		checks,
		additions: Number(raw.additions ?? 0),
		deletions: Number(raw.deletions ?? 0),
		changedFiles: Number(raw.changedFiles ?? 0),
		createdAt: String(raw.createdAt ?? ""),
		updatedAt: String(raw.updatedAt ?? ""),
		url: String(raw.url ?? ""),
		mergeable: String(raw.mergeable ?? "UNKNOWN"),
		mergeStateStatus: String(raw.mergeStateStatus ?? ""),
	}
}

export async function listPRs(
	opts: { state?: "open" | "closed" | "merged" | "all"; limit?: number } = {},
): Promise<PullRequest[]> {
	const args = ["pr", "list", "--json", PR_FIELDS, "--limit", String(opts.limit ?? 50)]
	if (opts.state && opts.state !== "all") args.push("--state", opts.state)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapPR)
	} catch {
		return []
	}
}

export async function getPR(number: number): Promise<PullRequest | null> {
	const r = await exec(GH, ["pr", "view", String(number), "--json", PR_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapPR(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

export async function getPRForCurrentBranch(): Promise<PullRequest | null> {
	const r = await exec(GH, ["pr", "view", "--json", PR_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapPR(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

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

export async function getPRDiff(number: number): Promise<string> {
	const r = await exec(GH, ["pr", "diff", String(number)])
	return r.stdout
}

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

export async function checkoutPR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "checkout", String(number)])
	return r.exitCode === 0
}

export async function closePR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "close", String(number)])
	return r.exitCode === 0
}

export async function reopenPR(number: number): Promise<boolean> {
	const r = await exec(GH, ["pr", "reopen", String(number)])
	return r.exitCode === 0
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface Issue {
	number: number
	title: string
	state: "OPEN" | "CLOSED"
	author: string
	body: string
	labels: string[]
	assignees: string[]
	comments: number
	reactions: Record<string, number>
	createdAt: string
	updatedAt: string
	url: string
}

export interface IssueComment {
	id: string
	author: string
	body: string
	createdAt: string
	url: string
}

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
			? String((raw.author as Record<string, unknown>).login ?? "")
			: String(raw.author ?? "")
	const comments =
		typeof raw.comments === "number"
			? raw.comments
			: Array.isArray(raw.comments)
				? raw.comments.length
				: 0

	return {
		number: Number(raw.number),
		title: String(raw.title ?? ""),
		state: String(raw.state ?? "OPEN") as Issue["state"],
		author,
		body: String(raw.body ?? ""),
		labels,
		assignees,
		comments,
		reactions: (raw.reactions as Record<string, number>) ?? {},
		createdAt: String(raw.createdAt ?? ""),
		updatedAt: String(raw.updatedAt ?? ""),
		url: String(raw.url ?? ""),
	}
}

export async function listIssues(
	opts: { state?: "open" | "closed" | "all"; limit?: number; labels?: string[] } = {},
): Promise<Issue[]> {
	const args = ["issue", "list", "--json", ISSUE_FIELDS, "--limit", String(opts.limit ?? 50)]
	if (opts.state && opts.state !== "all") args.push("--state", opts.state)
	if (opts.labels?.length) args.push("--label", opts.labels.join(","))

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapIssue)
	} catch {
		return []
	}
}

export async function getIssue(number: number): Promise<Issue | null> {
	const r = await exec(GH, ["issue", "view", String(number), "--json", ISSUE_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapIssue(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

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
						? String((c.author as Record<string, unknown>).login ?? "")
						: String(c.author ?? "")
				return {
					id: String(c.id ?? ""),
					author,
					body: String(c.body ?? ""),
					createdAt: String(c.createdAt ?? ""),
					url: String(c.url ?? ""),
				}
			})
	} catch {
		return []
	}
}

export async function commentOnIssue(number: number, body: string): Promise<boolean> {
	const r = await exec(GH, ["issue", "comment", String(number), "--body", body])
	return r.exitCode === 0
}

export async function commentOnPR(number: number, body: string): Promise<boolean> {
	const r = await exec(GH, ["pr", "comment", String(number), "--body", body])
	return r.exitCode === 0
}

export async function closeIssue(number: number): Promise<boolean> {
	const r = await exec(GH, ["issue", "close", String(number)])
	return r.exitCode === 0
}

export async function reopenIssue(number: number): Promise<boolean> {
	const r = await exec(GH, ["issue", "reopen", String(number)])
	return r.exitCode === 0
}

// ---------------------------------------------------------------------------
// GitHub Actions / Workflow Runs
// ---------------------------------------------------------------------------

export interface WorkflowRun {
	id: number
	name: string
	workflowName: string
	status: "queued" | "in_progress" | "completed" | "waiting"
	conclusion:
		| "success"
		| "failure"
		| "cancelled"
		| "skipped"
		| "timed_out"
		| "action_required"
		| null
	branch: string
	event: string
	headSha: string
	createdAt: string
	updatedAt: string
	url: string
	attempt: number
}

const RUN_FIELDS = [
	"databaseId",
	"name",
	"workflowName",
	"status",
	"conclusion",
	"headBranch",
	"event",
	"headSha",
	"createdAt",
	"updatedAt",
	"url",
	"attempt",
].join(",")

function mapRun(raw: Record<string, unknown>): WorkflowRun {
	return {
		id: Number(raw.databaseId ?? raw.id),
		name: String(raw.name ?? ""),
		workflowName: String(raw.workflowName ?? ""),
		status: String(raw.status ?? "completed") as WorkflowRun["status"],
		conclusion: (raw.conclusion ?? null) as WorkflowRun["conclusion"],
		branch: String(raw.headBranch ?? ""),
		event: String(raw.event ?? ""),
		headSha: String(raw.headSha ?? ""),
		createdAt: String(raw.createdAt ?? ""),
		updatedAt: String(raw.updatedAt ?? ""),
		url: String(raw.url ?? ""),
		attempt: Number(raw.attempt ?? 1),
	}
}

export async function listRuns(
	opts: { limit?: number; branch?: string; workflow?: string } = {},
): Promise<WorkflowRun[]> {
	const args = ["run", "list", "--json", RUN_FIELDS, "--limit", String(opts.limit ?? 30)]
	if (opts.branch) args.push("--branch", opts.branch)
	if (opts.workflow) args.push("--workflow", opts.workflow)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapRun)
	} catch {
		return []
	}
}

export async function getRun(id: number): Promise<WorkflowRun | null> {
	const r = await exec(GH, ["run", "view", String(id), "--json", RUN_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapRun(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

export async function rerunRun(id: number, failedOnly = true): Promise<boolean> {
	const args = ["run", "rerun", String(id)]
	if (failedOnly) args.push("--failed")
	const r = await exec(GH, args)
	return r.exitCode === 0
}

export async function getRunLogs(id: number): Promise<string> {
	const r = await exec(GH, ["run", "view", String(id), "--log"])
	return r.stdout
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notification {
	id: string
	subject: {
		title: string
		type: string // "PullRequest" | "Issue" | "Release" etc.
		url: string
	}
	repository: string
	reason: string // "mention" | "review_requested" | "assign" | "author" etc.
	unread: boolean
	updatedAt: string
}

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
			id: String(raw.id ?? ""),
			subject: {
				title: String((raw.subject as Record<string, unknown>)?.title ?? ""),
				type: String((raw.subject as Record<string, unknown>)?.type ?? ""),
				url: String((raw.subject as Record<string, unknown>)?.url ?? ""),
			},
			repository: String((raw.repository as Record<string, unknown>)?.full_name ?? ""),
			reason: String(raw.reason ?? ""),
			unread: Boolean(raw.unread),
			updatedAt: String(raw.updated_at ?? ""),
		}))
	} catch {
		return []
	}
}

export async function markNotificationRead(id: string): Promise<boolean> {
	const r = await exec(GH, ["api", "--method", "PATCH", `notifications/threads/${id}`])
	return r.exitCode === 0
}

export async function markAllNotificationsRead(): Promise<boolean> {
	const r = await exec(GH, ["api", "--method", "PUT", "notifications"])
	return r.exitCode === 0
}

// ---------------------------------------------------------------------------
// Repo info
// ---------------------------------------------------------------------------

export interface RepoInfo {
	name: string
	owner: string
	fullName: string
	description: string
	defaultBranch: string
	isPrivate: boolean
	stargazerCount: number
	forkCount: number
	url: string
}

export async function getRepoInfo(): Promise<RepoInfo | null> {
	const r = await exec(GH, [
		"repo",
		"view",
		"--json",
		"name,owner,nameWithOwner,description,defaultBranchRef,isPrivate,stargazerCount,forkCount,url",
	])
	if (r.exitCode !== 0) return null
	try {
		const raw = JSON.parse(r.stdout) as Record<string, unknown>
		return {
			name: String(raw.name ?? ""),
			owner: String((raw.owner as Record<string, unknown>)?.login ?? ""),
			fullName: String(raw.nameWithOwner ?? ""),
			description: String(raw.description ?? ""),
			defaultBranch: String((raw.defaultBranchRef as Record<string, unknown>)?.name ?? "main"),
			isPrivate: Boolean(raw.isPrivate),
			stargazerCount: Number(raw.stargazerCount ?? 0),
			forkCount: Number(raw.forkCount ?? 0),
			url: String(raw.url ?? ""),
		}
	} catch {
		return null
	}
}
