/**
 * git.ts — Git command wrappers
 * All functions accept an optional `cwd` (defaults to process.cwd()).
 */

import {
	parseStatus,
	parseLog,
	parseBranches,
	parseStashList,
	parseDiffStat,
	parseBlame,
	parseRemotes,
	LOG_FORMAT,
	LOG_RECORD_SEP,
	type StatusEntry,
	type LogEntry,
	type BranchEntry,
	type StashEntry,
	type DiffStat,
	type BlameEntry,
	type RemoteEntry,
} from "./parser.ts"
import { exec, execOrThrow, ShellError } from "./shell.ts"

export type { StatusEntry, LogEntry, BranchEntry, StashEntry, DiffStat, BlameEntry, RemoteEntry }

const GIT = "git"

// ---------------------------------------------------------------------------
// Repository info
// ---------------------------------------------------------------------------

export async function getRepoRoot(cwd?: string): Promise<string> {
	return (await execOrThrow(GIT, ["rev-parse", "--show-toplevel"], { cwd })).trim()
}

export async function isGitRepo(cwd?: string): Promise<boolean> {
	const r = await exec(GIT, ["rev-parse", "--is-inside-work-tree"], { cwd })
	return r.exitCode === 0
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
	const r = await exec(GIT, ["branch", "--show-current"], { cwd })
	if (r.exitCode === 0 && r.stdout.trim()) return r.stdout.trim()
	// Detached HEAD — return short hash
	return (await execOrThrow(GIT, ["rev-parse", "--short", "HEAD"], { cwd })).trim()
}

export async function getUpstreamStatus(cwd?: string): Promise<{ ahead: number; behind: number }> {
	const r = await exec(GIT, ["rev-list", "--left-right", "--count", "HEAD...@{u}"], { cwd })
	if (r.exitCode !== 0) return { ahead: 0, behind: 0 }
	const [aStr = "0", bStr = "0"] = r.stdout.trim().split(/\s+/)
	return { ahead: parseInt(aStr, 10), behind: parseInt(bStr, 10) }
}

export async function getRemoteUrl(remote = "origin", cwd?: string): Promise<string> {
	const r = await exec(GIT, ["remote", "get-url", remote], { cwd })
	return r.exitCode === 0 ? r.stdout.trim() : ""
}

export async function getDefaultBranch(cwd?: string): Promise<string> {
	// Try to read from origin/HEAD symbolic ref
	const r = await exec(GIT, ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd })
	if (r.exitCode === 0) {
		const ref = r.stdout.trim() // e.g. "refs/remotes/origin/main"
		return ref.replace("refs/remotes/origin/", "")
	}
	// Fallback: check for common branch names
	for (const name of ["main", "master"]) {
		const check = await exec(GIT, ["rev-parse", "--verify", `refs/remotes/origin/${name}`], { cwd })
		if (check.exitCode === 0) return name
	}
	return "main"
}

export async function getRemotes(cwd?: string): Promise<RemoteEntry[]> {
	const r = await exec(GIT, ["remote", "-v"], { cwd })
	return parseRemotes(r.stdout)
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function getStatus(cwd?: string): Promise<StatusEntry[]> {
	const out = await execOrThrow(GIT, ["status", "--porcelain=v2", "--untracked-files=all"], { cwd })
	return parseStatus(out)
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export async function getDiff(path?: string, staged = false, cwd?: string): Promise<string> {
	const args = ["diff", "--no-color"]
	if (staged) args.push("--cached")
	if (path) args.push("--", path)
	const r = await exec(GIT, args, { cwd })
	return r.stdout
}

export async function getDiffBetween(base: string, head: string, cwd?: string): Promise<string> {
	const r = await exec(GIT, ["diff", "--no-color", `${base}...${head}`], { cwd })
	return r.stdout
}

export async function getDiffStat(path?: string, staged = false, cwd?: string): Promise<DiffStat> {
	const args = ["diff", "--stat"]
	if (staged) args.push("--cached")
	if (path) args.push("--", path)
	const r = await exec(GIT, args, { cwd })
	return parseDiffStat(r.stdout)
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export interface LogOptions {
	count?: number
	author?: string
	path?: string
	since?: string
	until?: string
	all?: boolean
	graph?: boolean
	branch?: string
	grep?: string
}

export async function getLog(opts: LogOptions = {}, cwd?: string): Promise<LogEntry[]> {
	const args = ["log", `--format=${LOG_FORMAT}`, `--max-count=${opts.count ?? 200}`]
	if (opts.all) args.push("--all")
	if (opts.graph) args.push("--graph")
	if (opts.author) args.push(`--author=${opts.author}`)
	if (opts.since) args.push(`--since=${opts.since}`)
	if (opts.until) args.push(`--until=${opts.until}`)
	if (opts.grep) args.push(`--grep=${opts.grep}`)
	if (opts.branch) args.push(opts.branch)
	if (opts.path) args.push("--", opts.path)

	const r = await exec(GIT, args, { cwd })
	if (r.exitCode !== 0) return []
	return parseLog(r.stdout)
}

/** Get git log --graph --oneline --decorate output for smartlog */
export async function getGraphLog(
	opts: { count?: number; all?: boolean } = {},
	cwd?: string,
): Promise<string> {
	const args = ["log", "--graph", "--oneline", "--decorate", `--max-count=${opts.count ?? 100}`]
	if (opts.all) args.push("--all")
	const r = await exec(GIT, args, { cwd })
	return r.stdout
}

export async function getFileLog(
	path: string,
	opts: { count?: number; follow?: boolean } = {},
	cwd?: string,
): Promise<LogEntry[]> {
	const args = ["log", `--format=${LOG_FORMAT}`, `--max-count=${opts.count ?? 100}`]
	if (opts.follow) args.push("--follow")
	args.push("--", path)
	const r = await exec(GIT, args, { cwd })
	if (r.exitCode !== 0) return []
	return parseLog(r.stdout)
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

export async function stageFile(path: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["add", "--", path], { cwd })
}

export async function unstageFile(path: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["restore", "--staged", "--", path], { cwd })
}

export async function stageAll(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["add", "--all"], { cwd })
}

export async function unstageAll(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["restore", "--staged", "."], { cwd })
}

export async function discardFile(path: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["restore", "--", path], { cwd })
}

export async function discardAll(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["restore", "."], { cwd })
}

export async function stageHunk(patch: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["apply", "--cached", "--recount"], { cwd, input: patch })
}

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

export interface CommitOptions {
	amend?: boolean
	signoff?: boolean
	gpgSign?: boolean
	noVerify?: boolean
}

export async function commit(
	message: string,
	opts: CommitOptions = {},
	cwd?: string,
): Promise<void> {
	const args = ["commit", "-m", message]
	if (opts.amend) args.push("--amend")
	if (opts.signoff) args.push("--signoff")
	if (opts.gpgSign) args.push("-S")
	if (opts.noVerify) args.push("--no-verify")
	await execOrThrow(GIT, args, { cwd })
}

export async function commitFixup(hash: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["commit", "--fixup", hash], { cwd })
}

export async function amendLastCommit(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["commit", "--amend", "--no-edit"], { cwd })
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function getBranches(cwd?: string): Promise<BranchEntry[]> {
	const currentBranch = await getCurrentBranch(cwd)
	const out = await execOrThrow(
		GIT,
		[
			"for-each-ref",
			"--format=%(refname)\x01%(objectname:short)\x01%(subject)\x01%(committerdate:relative)\x01%(upstream)\x01%(upstream:track,nobracket)",
			"refs/heads",
			"refs/remotes",
		],
		{ cwd },
	)
	return parseBranches(out, currentBranch)
}

export async function checkout(branchOrHash: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["checkout", branchOrHash], { cwd })
}

export async function switchBranch(branch: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["switch", branch], { cwd })
}

export async function createBranch(
	name: string,
	startPoint?: string,
	checkout_ = true,
	cwd?: string,
): Promise<void> {
	if (checkout_) {
		const args = ["checkout", "-b", name]
		if (startPoint) args.push(startPoint)
		await execOrThrow(GIT, args, { cwd })
	} else {
		const args = ["branch", name]
		if (startPoint) args.push(startPoint)
		await execOrThrow(GIT, args, { cwd })
	}
}

export async function renameBranch(oldName: string, newName: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["branch", "-m", oldName, newName], { cwd })
}

export async function deleteBranch(name: string, force = false, cwd?: string): Promise<void> {
	const flag = force ? "-D" : "-d"
	await execOrThrow(GIT, ["branch", flag, name], { cwd })
}

export async function deleteRemoteBranch(
	remote: string,
	name: string,
	cwd?: string,
): Promise<void> {
	await execOrThrow(GIT, ["push", remote, "--delete", name], { cwd })
}

export async function mergeBranch(
	branch: string,
	opts: { noFF?: boolean; squash?: boolean } = {},
	cwd?: string,
): Promise<void> {
	const args = ["merge"]
	if (opts.noFF) args.push("--no-ff")
	if (opts.squash) args.push("--squash")
	args.push(branch)
	await execOrThrow(GIT, args, { cwd })
}

export async function rebaseBranch(
	onto: string,
	opts: { interactive?: boolean; autosquash?: boolean } = {},
	cwd?: string,
): Promise<void> {
	const args = ["rebase"]
	if (opts.interactive) args.push("-i")
	if (opts.autosquash) args.push("--autosquash")
	args.push(onto)
	await execOrThrow(GIT, args, { cwd })
}

export async function rebaseOnto(
	newBase: string,
	oldBase: string,
	branch: string,
	cwd?: string,
): Promise<void> {
	await execOrThrow(GIT, ["rebase", "--onto", newBase, oldBase, branch], { cwd })
}

export async function abortRebase(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["rebase", "--abort"], { cwd })
}

export async function continueRebase(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["rebase", "--continue"], { cwd })
}

// ---------------------------------------------------------------------------
// Stash
// ---------------------------------------------------------------------------

export async function getStashList(cwd?: string): Promise<StashEntry[]> {
	const r = await exec(GIT, ["stash", "list"], { cwd })
	if (r.exitCode !== 0 || !r.stdout.trim()) return []
	return parseStashList(r.stdout)
}

export async function stash(
	message?: string,
	opts: { includeUntracked?: boolean; keepIndex?: boolean } = {},
	cwd?: string,
): Promise<void> {
	const args = ["stash", "push"]
	if (opts.includeUntracked) args.push("--include-untracked")
	if (opts.keepIndex) args.push("--keep-index")
	if (message) args.push("-m", message)
	await execOrThrow(GIT, args, { cwd })
}

export async function stashPop(index?: number, cwd?: string): Promise<void> {
	const args = ["stash", "pop"]
	if (index !== undefined) args.push(`stash@{${index}}`)
	await execOrThrow(GIT, args, { cwd })
}

export async function stashApply(index?: number, cwd?: string): Promise<void> {
	const args = ["stash", "apply"]
	if (index !== undefined) args.push(`stash@{${index}}`)
	await execOrThrow(GIT, args, { cwd })
}

export async function stashDrop(index?: number, cwd?: string): Promise<void> {
	const args = ["stash", "drop"]
	if (index !== undefined) args.push(`stash@{${index}}`)
	await execOrThrow(GIT, args, { cwd })
}

export async function getStashDiff(index: number, cwd?: string): Promise<string> {
	const r = await exec(GIT, ["stash", "show", "-p", "--no-color", `stash@{${index}}`], { cwd })
	return r.stdout
}

// ---------------------------------------------------------------------------
// Cherry-pick & revert
// ---------------------------------------------------------------------------

export async function cherryPick(hash: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["cherry-pick", hash], { cwd })
}

export async function revert(hash: string, noCommit = false, cwd?: string): Promise<void> {
	const args = ["revert", hash]
	if (noCommit) args.push("--no-commit")
	await execOrThrow(GIT, args, { cwd })
}

export async function resetToCommit(
	hash: string,
	mode: "soft" | "mixed" | "hard" = "mixed",
	cwd?: string,
): Promise<void> {
	await execOrThrow(GIT, ["reset", `--${mode}`, hash], { cwd })
}

// ---------------------------------------------------------------------------
// Remote operations
// ---------------------------------------------------------------------------

export async function fetch(
	remote?: string,
	opts: { prune?: boolean } = {},
	cwd?: string,
): Promise<void> {
	const args = ["fetch"]
	if (opts.prune) args.push("--prune")
	if (remote) args.push(remote)
	await execOrThrow(GIT, args, { cwd })
}

export async function pull(cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["pull"], { cwd })
}

export async function push(
	opts: {
		force?: boolean
		forceWithLease?: boolean
		setUpstream?: boolean
		remote?: string
		branch?: string
	} = {},
	cwd?: string,
): Promise<void> {
	const args = ["push"]
	if (opts.forceWithLease) args.push("--force-with-lease")
	else if (opts.force) args.push("--force")
	if (opts.setUpstream) args.push("-u")
	if (opts.remote) args.push(opts.remote)
	if (opts.branch) args.push(opts.branch)
	await execOrThrow(GIT, args, { cwd })
}

// ---------------------------------------------------------------------------
// Blame
// ---------------------------------------------------------------------------

export async function blame(path: string, cwd?: string): Promise<BlameEntry[]> {
	const r = await exec(GIT, ["blame", "--porcelain", "--", path], { cwd })
	if (r.exitCode !== 0) return []
	return parseBlame(r.stdout)
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function getConfig(key: string, cwd?: string): Promise<string | null> {
	const r = await exec(GIT, ["config", "--local", key], { cwd })
	return r.exitCode === 0 ? r.stdout.trim() : null
}

export async function setConfig(key: string, value: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["config", "--local", key, value], { cwd })
}

export async function unsetConfig(key: string, cwd?: string): Promise<void> {
	await exec(GIT, ["config", "--local", "--unset", key], { cwd })
}

// ---------------------------------------------------------------------------
// Worktrees
// ---------------------------------------------------------------------------

export interface WorktreeEntry {
	path: string
	branch: string
	hash: string
	bare: boolean
	locked: boolean
}

export async function getWorktrees(cwd?: string): Promise<WorktreeEntry[]> {
	const r = await exec(GIT, ["worktree", "list", "--porcelain"], { cwd })
	if (r.exitCode !== 0) return []

	const entries: WorktreeEntry[] = []
	const blocks = r.stdout.split("\n\n").filter(Boolean)

	for (const block of blocks) {
		const lines = block.split("\n")
		let path = ""
		let branch = ""
		let hash = ""
		let bare = false
		let locked = false

		for (const line of lines) {
			if (line.startsWith("worktree ")) path = line.slice(9)
			else if (line.startsWith("HEAD ")) hash = line.slice(5)
			else if (line.startsWith("branch ")) branch = line.slice(7).replace("refs/heads/", "")
			else if (line === "bare") bare = true
			else if (line.startsWith("locked")) locked = true
		}

		if (path) entries.push({ path, branch, hash, bare, locked })
	}

	return entries
}

export async function addWorktree(path: string, branch: string, cwd?: string): Promise<void> {
	await execOrThrow(GIT, ["worktree", "add", path, branch], { cwd })
}

export async function removeWorktree(path: string, force = false, cwd?: string): Promise<void> {
	const args = ["worktree", "remove"]
	if (force) args.push("--force")
	args.push(path)
	await execOrThrow(GIT, args, { cwd })
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function getTags(cwd?: string): Promise<string[]> {
	const r = await exec(GIT, ["tag", "--sort=-version:refname"], { cwd })
	return r.stdout.split("\n").filter(Boolean)
}
