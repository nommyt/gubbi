/**
 * gh-actions.ts — GitHub Actions workflow operations via the `gh` CLI.
 *
 * List and inspect workflow runs, re-run failed jobs, fetch logs,
 * list available workflows, and manually trigger workflow dispatches.
 */

import { exec } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single GitHub Actions workflow run. */
export interface WorkflowRun {
	/** Unique run identifier. */
	id: number
	/** Display name of the run. */
	name: string
	/** Name of the workflow that produced this run. */
	workflowName: string
	/** Execution status. */
	status: "queued" | "in_progress" | "completed" | "waiting"
	/** Final conclusion once completed, or `null` while still running. */
	conclusion:
		| "success"
		| "failure"
		| "cancelled"
		| "skipped"
		| "timed_out"
		| "action_required"
		| null
	/** Branch that triggered this run. */
	branch: string
	/** Event that triggered this run (e.g. `"push"`, `"pull_request"`). */
	event: string
	/** Commit SHA at the head of the triggering ref. */
	headSha: string
	/** ISO-8601 creation timestamp. */
	createdAt: string
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
	/** Web URL for this run. */
	url: string
	/** Run attempt number (starts at 1). */
	attempt: number
}

/** A GitHub Actions workflow definition. */
export interface Workflow {
	/** Unique workflow identifier. */
	id: number
	/** Display name of the workflow. */
	name: string
	/** Path to the workflow YAML file (e.g. `.github/workflows/ci.yml`). */
	path: string
	/** Workflow state (e.g. `"active"`, `"disabled_manually"`). */
	state: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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
		name: (raw.name as string | null | undefined) ?? "",
		workflowName: (raw.workflowName as string | null | undefined) ?? "",
		status: ((raw.status as string | null | undefined) ?? "completed") as WorkflowRun["status"],
		conclusion: (raw.conclusion ?? null) as WorkflowRun["conclusion"],
		branch: (raw.headBranch as string | null | undefined) ?? "",
		event: (raw.event as string | null | undefined) ?? "",
		headSha: (raw.headSha as string | null | undefined) ?? "",
		createdAt: (raw.createdAt as string | null | undefined) ?? "",
		updatedAt: (raw.updatedAt as string | null | undefined) ?? "",
		url: (raw.url as string | null | undefined) ?? "",
		attempt: Number(raw.attempt ?? 1),
	}
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List recent workflow runs in the current repository.
 *
 * @param opts.limit    - Maximum results (default: 30).
 * @param opts.branch   - Filter by branch name.
 * @param opts.workflow - Filter by workflow name or filename.
 * @returns Array of {@link WorkflowRun}, or `[]` on failure.
 */
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

/**
 * Fetch a single workflow run by ID.
 * @returns The {@link WorkflowRun}, or `null` if not found.
 */
export async function getRun(id: number): Promise<WorkflowRun | null> {
	const r = await exec(GH, ["run", "view", String(id), "--json", RUN_FIELDS])
	if (r.exitCode !== 0) return null
	try {
		return mapRun(JSON.parse(r.stdout) as Record<string, unknown>)
	} catch {
		return null
	}
}

/**
 * Re-run a workflow run.
 *
 * @param id         - Run ID to re-run.
 * @param failedOnly - If `true` (default), only re-run failed jobs.
 * @returns `true` if the re-run was triggered successfully.
 */
export async function rerunRun(id: number, failedOnly = true): Promise<boolean> {
	const args = ["run", "rerun", String(id)]
	if (failedOnly) args.push("--failed")
	const r = await exec(GH, args)
	return r.exitCode === 0
}

/**
 * Fetch the full log output of a workflow run.
 * @returns Raw log text.
 */
export async function getRunLogs(id: number): Promise<string> {
	const r = await exec(GH, ["run", "view", String(id), "--log"])
	return r.stdout
}

/**
 * List all workflows defined in the current repository.
 * @returns Array of {@link Workflow}, or `[]` on failure.
 */
export async function listWorkflows(): Promise<Workflow[]> {
	const r = await exec(GH, ["workflow", "list", "--json", "id,name,path,state"])
	if (r.exitCode !== 0) return []
	try {
		return JSON.parse(r.stdout) as Workflow[]
	} catch {
		return []
	}
}

/**
 * Manually trigger a workflow dispatch event.
 *
 * @param workflow - Workflow filename or name to trigger.
 * @param branch  - Git ref to run against (defaults to the default branch).
 * @param inputs  - Key-value pairs passed as workflow inputs.
 * @returns `true` if the dispatch was accepted.
 */
export async function triggerWorkflow(
	workflow: string,
	branch?: string,
	inputs?: Record<string, string>,
): Promise<boolean> {
	const args = ["workflow", "run", workflow]
	if (branch) args.push("--ref", branch)
	if (inputs) {
		for (const [key, value] of Object.entries(inputs)) {
			args.push("-f", `${key}=${value}`)
		}
	}
	const r = await exec(GH, args)
	return r.exitCode === 0
}
