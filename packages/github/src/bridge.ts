/**
 * bridge.ts — Shared git+GitHub workflow utilities
 */

import { state } from "@gubbi/core/state"
import type { GitHubPR } from "@gubbi/core/types"
import { push } from "@gubbi/git"

import { createPR } from "./gh.ts"
import type { PullRequest } from "./gh.ts"

/**
 * Find the open PR for the current branch.
 */
export function getCurrentBranchPR(): GitHubPR | null {
	return (
		state.github.prs.find(
			(pr) => pr.headRefName === state.git.currentBranch && pr.state === "OPEN",
		) ?? null
	)
}

/**
 * Find the open PR for any given branch name.
 */
export function getPRForBranch(branch: string, prs: GitHubPR[]): GitHubPR | null {
	return prs.find((pr) => pr.headRefName === branch && pr.state === "OPEN") ?? null
}

/**
 * Check if a PR is safe to merge (no failing CI, not blocked).
 * Takes the full PullRequest type from gh.ts which includes checks.
 */
export function canMergePR(pr: PullRequest): { ok: boolean; reason?: string } {
	if (pr.isDraft) return { ok: false, reason: "PR is a draft" }
	if (pr.mergeable === "CONFLICTING") return { ok: false, reason: "PR has merge conflicts" }
	const failing = pr.checks.filter((c) => c.conclusion === "FAILURE")
	if (failing.length > 0)
		return { ok: false, reason: `CI failing: ${failing.map((c) => c.name).join(", ")}` }
	return { ok: true }
}

/**
 * Push current branch and create a PR if none exists.
 * Uses the commit message as the PR title when creating a new PR.
 */
export async function pushAndCreatePR(
	branch: string,
	commitTitle?: string,
): Promise<{ pushed: boolean; pr?: GitHubPR }> {
	await push(
		{
			branch,
			setUpstream: !state.git.branches.find((b) => b.name === branch && !b.remote)?.upstream,
		},
		state.git.repoRoot,
	)

	const existing = getCurrentBranchPR()
	if (existing) return { pushed: true, pr: existing }

	if (!state.github.isAuthenticated) return { pushed: true }

	const title = commitTitle || branch
	const created = await createPR({
		title,
		body: "",
		base: state.git.defaultBranch,
	})
	if (created) {
		return {
			pushed: true,
			pr: {
				number: created.number,
				title: created.title,
				state: created.state,
				isDraft: created.isDraft,
				author: created.author,
				headRefName: created.headRefName,
				baseRefName: created.baseRefName,
				body: created.body,
				labels: created.labels,
				additions: created.additions,
				deletions: created.deletions,
				changedFiles: created.changedFiles,
				createdAt: created.createdAt,
				updatedAt: created.updatedAt,
				url: created.url,
				mergeable: created.mergeable,
				mergeStateStatus: created.mergeStateStatus,
			},
		}
	}
	return { pushed: true }
}
