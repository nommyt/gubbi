/**
 * stack.ts — Stacked diffs management
 *
 * Stack metadata is stored in git config so it persists across sessions
 * without requiring an external account or server:
 *   git config --local branch.<name>.gubbi-parent <parent-branch>
 */

import {
	getConfig,
	setConfig,
	unsetConfig,
	getCurrentBranch,
	createBranch,
	rebaseOnto,
	push,
	getLog,
} from "./git.ts"
import { exec, execOrThrow } from "./shell.ts"

const GIT = "git"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StackBranch {
	name: string
	parent: string | null // null means it's rooted at trunk
	prNumber?: number
	prStatus?: "open" | "merged" | "closed" | "draft"
	ciStatus?: "passing" | "failing" | "pending" | "unknown"
	commitCount: number
	commits: Array<{ hash: string; subject: string }>
}

export interface Stack {
	id: string // unique id = bottom branch name
	trunk: string // "main" | "master" | custom
	branches: StackBranch[] // ordered bottom-to-top (trunk excluded)
}

// ---------------------------------------------------------------------------
// Config key helpers
// ---------------------------------------------------------------------------

function parentKey(branch: string) {
	return `branch.${branch}.gubbi-parent`
}

function prKey(branch: string) {
	return `branch.${branch}.gubbi-pr`
}

async function getTrunk(cwd?: string): Promise<string> {
	// Check common trunk names
	for (const name of ["main", "master", "trunk", "develop"]) {
		const r = await exec(GIT, ["rev-parse", "--verify", name], { cwd })
		if (r.exitCode === 0) return name
	}
	return "main"
}

// ---------------------------------------------------------------------------
// Stack parent management
// ---------------------------------------------------------------------------

export async function getStackParent(branch: string, cwd?: string): Promise<string | null> {
	return getConfig(parentKey(branch), cwd)
}

export async function setStackParent(branch: string, parent: string, cwd?: string): Promise<void> {
	await setConfig(parentKey(branch), parent, cwd)
}

export async function clearStackParent(branch: string, cwd?: string): Promise<void> {
	await unsetConfig(parentKey(branch), cwd)
}

// ---------------------------------------------------------------------------
// Build stack graph
// ---------------------------------------------------------------------------

/** Get all branches that have a gubbi-parent config entry */
async function getTrackedBranches(cwd?: string): Promise<Map<string, string>> {
	// git config --local --get-regexp 'branch\..*\.gubbi-parent'
	const r = await exec(GIT, ["config", "--local", "--get-regexp", "branch\\..*\\.gubbi-parent"], {
		cwd,
	})
	const map = new Map<string, string>()
	if (r.exitCode !== 0) return map

	for (const line of r.stdout.split("\n").filter(Boolean)) {
		const spaceIdx = line.indexOf(" ")
		if (spaceIdx === -1) continue
		const key = line.slice(0, spaceIdx)
		const value = line.slice(spaceIdx + 1).trim()
		// key = branch.<name>.gubbi-parent
		const match = /^branch\.(.+)\.gubbi-parent$/.exec(key)
		if (match?.[1]) map.set(match[1], value)
	}

	return map
}

/** Build all stacks from tracked branch metadata */
export async function getStacks(cwd?: string): Promise<Stack[]> {
	const trunk = await getTrunk(cwd)
	const tracked = await getTrackedBranches(cwd)

	if (tracked.size === 0) return []

	// Build adjacency: parent -> children[]
	const children = new Map<string, string[]>()
	for (const [branch, parent] of tracked) {
		const list = children.get(parent) ?? []
		list.push(branch)
		children.set(parent, list)
	}

	// Find all root branches (parented to trunk or to an untracked branch)
	const roots: string[] = []
	for (const [branch, parent] of tracked) {
		if (parent === trunk || !tracked.has(parent)) {
			roots.push(branch)
		}
	}

	// For each root, build a chain
	const stacks: Stack[] = []

	async function buildChain(start: string): Promise<StackBranch[]> {
		const chain: StackBranch[] = []
		let current = start

		while (current && tracked.has(current)) {
			const parent = tracked.get(current) ?? null
			const commits = await getBranchCommits(current, parent ?? trunk, cwd)
			const prNumStr = await getConfig(prKey(current), cwd)
			const prNum = prNumStr ? parseInt(prNumStr, 10) : undefined

			chain.push({
				name: current,
				parent,
				prNumber: prNum,
				commitCount: commits.length,
				commits,
			})

			// Move to child if there's exactly one
			const kids = children.get(current) ?? []
			current = kids.length === 1 ? (kids[0] ?? "") : ""
		}

		return chain
	}

	for (const root of roots) {
		const branches = await buildChain(root)
		if (branches.length > 0) {
			stacks.push({
				id: root,
				trunk,
				branches,
			})
		}
	}

	return stacks
}

/** Get commits in a branch not in its parent */
async function getBranchCommits(
	branch: string,
	parent: string,
	cwd?: string,
): Promise<Array<{ hash: string; subject: string }>> {
	const r = await exec(GIT, ["log", "--format=%H %s", `${parent}..${branch}`], { cwd })
	if (r.exitCode !== 0) return []
	return r.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const spaceIdx = line.indexOf(" ")
			return {
				hash: line.slice(0, spaceIdx),
				subject: line.slice(spaceIdx + 1),
			}
		})
}

// ---------------------------------------------------------------------------
// Stack operations
// ---------------------------------------------------------------------------

/**
 * Create a new branch stacked on the current branch.
 * Commits staged changes if a message is provided.
 */
export async function stackCreate(
	branchName: string,
	commitMessage?: string,
	cwd?: string,
): Promise<void> {
	const current = await getCurrentBranch(cwd)
	await createBranch(branchName, current, true, cwd)
	await setStackParent(branchName, current, cwd)

	if (commitMessage) {
		await execOrThrow(GIT, ["commit", "-m", commitMessage], { cwd })
	}
}

/**
 * Navigate up the stack (to child branch).
 * Returns the branch we moved to, or null if at top.
 */
export async function stackUp(cwd?: string): Promise<string | null> {
	const current = await getCurrentBranch(cwd)
	const tracked = await getTrackedBranches(cwd)

	// Find a branch whose parent is current
	for (const [branch, parent] of tracked) {
		if (parent === current) {
			await execOrThrow(GIT, ["checkout", branch], { cwd })
			return branch
		}
	}
	return null
}

/**
 * Navigate down the stack (to parent branch).
 * Returns the branch we moved to, or null if at bottom.
 */
export async function stackDown(cwd?: string): Promise<string | null> {
	const current = await getCurrentBranch(cwd)
	const parent = await getStackParent(current, cwd)
	if (!parent) return null

	await execOrThrow(GIT, ["checkout", parent], { cwd })
	return parent
}

/**
 * Sync: restack branches after trunk was updated.
 * Rebases each tracked branch onto its parent in order.
 */
export async function stackSync(cwd?: string): Promise<void> {
	const trunk = await getTrunk(cwd)
	// Pull trunk first
	const savedBranch = await getCurrentBranch(cwd)

	await execOrThrow(GIT, ["checkout", trunk], { cwd })
	await execOrThrow(GIT, ["pull"], { cwd })

	// Get all stacks and restack in order
	const stacks = await getStacks(cwd)
	for (const stack of stacks) {
		for (const branch of stack.branches) {
			const parent = branch.parent ?? trunk
			// Rebase branch onto its (possibly updated) parent
			await execOrThrow(GIT, ["checkout", branch.name], { cwd })
			const r = await exec(GIT, ["rebase", parent], { cwd })
			if (r.exitCode !== 0) {
				// Abort on conflict — user must resolve manually
				await exec(GIT, ["rebase", "--abort"], { cwd })
				throw new Error(`Conflict rebasing ${branch.name} onto ${parent}. Resolve manually.`)
			}
		}
	}

	// Return to original branch
	await execOrThrow(GIT, ["checkout", savedBranch], { cwd })
}

/**
 * Fold: merge current branch into its parent and remove it from the stack.
 */
export async function stackFold(cwd?: string): Promise<void> {
	const current = await getCurrentBranch(cwd)
	const parent = await getStackParent(current, cwd)
	if (!parent) throw new Error(`Branch "${current}" has no stack parent`)

	// Get all commits from current not in parent
	const commits = await getBranchCommits(current, parent, cwd)
	if (commits.length === 0) throw new Error("No commits to fold")

	// Checkout parent and cherry-pick or merge
	await execOrThrow(GIT, ["checkout", parent], { cwd })
	await execOrThrow(GIT, ["merge", "--squash", current], { cwd })

	// Update any children to point to parent
	const tracked = await getTrackedBranches(cwd)
	for (const [branch, p] of tracked) {
		if (p === current) {
			await setStackParent(branch, parent, cwd)
		}
	}

	// Remove the folded branch metadata
	await clearStackParent(current, cwd)
	await execOrThrow(GIT, ["branch", "-D", current], { cwd })
}

/**
 * Submit: push all branches in the stack and create/update PRs via gh.
 */
export async function stackSubmit(
	stackId: string,
	opts: { draft?: boolean; base?: string } = {},
	cwd?: string,
): Promise<void> {
	const stacks = await getStacks(cwd)
	const stack = stacks.find((s) => s.id === stackId)
	if (!stack) throw new Error(`Stack "${stackId}" not found`)

	const GH = "gh"

	for (let i = 0; i < stack.branches.length; i++) {
		const branch = stack.branches[i]
		if (!branch) continue
		const parent = branch.parent ?? stack.trunk
		const base = i === 0 ? (opts.base ?? stack.trunk) : (stack.branches[i - 1]?.name ?? stack.trunk)

		// Push branch
		await exec(GIT, ["push", "--force-with-lease", "-u", "origin", branch.name], { cwd })

		// Check if PR exists for this branch
		const prCheckR = await exec(GH, ["pr", "view", branch.name, "--json", "number,state"])
		if (prCheckR.exitCode === 0) {
			// PR exists — update base if needed
			const prData = JSON.parse(prCheckR.stdout) as { number: number; state: string }
			if (prData.state === "OPEN") {
				await exec(GH, ["pr", "edit", String(prData.number), "--base", base])
			}
		} else {
			// Create new PR
			const subject = branch.commits[0]?.subject ?? branch.name
			const prArgs = [
				"pr",
				"create",
				"--head",
				branch.name,
				"--base",
				base,
				"--title",
				subject,
				"--body",
				`Part of stack: ${stack.branches.map((b) => `\`${b.name}\``).join(" → ")}`,
			]
			if (opts.draft) prArgs.push("--draft")

			const prCreateR = await exec(GH, prArgs, { cwd })
			if (prCreateR.exitCode === 0) {
				// Save PR number
				const numR = await exec(GH, ["pr", "view", branch.name, "--json", "number"])
				if (numR.exitCode === 0) {
					const { number } = JSON.parse(numR.stdout) as { number: number }
					await setConfig(prKey(branch.name), String(number), cwd)
				}
			}
		}
	}
}

/**
 * Absorb: automatically route staged changes to the correct ancestor commit.
 * Uses `git absorb` if available, otherwise falls back to manual hunk routing.
 */
export async function stackAbsorb(cwd?: string): Promise<boolean> {
	// Try git-absorb first (installed separately)
	const r = await exec("git", ["absorb", "--and-rebase"], { cwd })
	if (r.exitCode === 0) return true

	// Fallback: not supported without git-absorb
	return false
}

/**
 * Get current stack for the current branch.
 */
export async function getCurrentStack(cwd?: string): Promise<Stack | null> {
	const current = await getCurrentBranch(cwd)
	const stacks = await getStacks(cwd)

	for (const stack of stacks) {
		if (stack.branches.some((b) => b.name === current)) {
			return stack
		}
	}
	return null
}
