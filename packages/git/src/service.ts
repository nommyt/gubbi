/**
 * service.ts — GitService implementation for the plugin system
 */

import { basename } from "node:path"

import type { GitService as GitServiceInterface } from "@gubbi/core/context"
import {
	state,
	setState,
	updateGitStatus,
	updateGitLog,
	updateGitBranches,
	showToast,
} from "@gubbi/core/state"
import type { GitStatusEntry, GitLogEntry, GitBranch } from "@gubbi/core/types"

import {
	isGitRepo,
	getRepoRoot,
	getCurrentBranch,
	getUpstreamStatus,
	getRemoteUrl,
	getDefaultBranch,
	getStatus,
	getLog,
	getBranches,
	getStashList,
	type StatusEntry,
	type LogEntry,
	type BranchEntry,
} from "./git.ts"

export interface GitService extends GitServiceInterface {}

// Singleton instance for direct usage
export const gitService = createGitService()

// ---------------------------------------------------------------------------
// Type mappers — translate internal parser types to core state types
// ---------------------------------------------------------------------------

function toGitStatusEntry(e: StatusEntry): GitStatusEntry {
	// StatusEntry.type includes "ignored" which GitStatusEntry does not.
	// The parser already skips ignored entries (the '!' branch is a no-op),
	// so this cast is safe in practice. We default to "modified" as a fallback.
	const safeType = (e.type === "ignored" ? "modified" : e.type) as GitStatusEntry["type"]
	return {
		type: safeType,
		path: e.path,
		origPath: e.origPath,
		staged: e.staged,
		unstaged: e.unstaged,
	}
}

function toGitLogEntry(e: LogEntry): GitLogEntry {
	return {
		hash: e.hash,
		shortHash: e.shortHash,
		author: e.author,
		email: e.authorEmail,
		authorDate: e.authorDate,
		commitDate: e.committerDate,
		relativeTime: e.relativeDate,
		subject: e.subject,
		refNames: e.refs,
		parents: e.parents,
		signature: e.gpgStatus,
	}
}

function toGitBranch(e: BranchEntry): GitBranch {
	return {
		name: e.name,
		current: e.current,
		// BranchEntry.remote is boolean; GitBranch.remote is the remote name string
		remote: e.remote ? e.remoteName : undefined,
		upstream: e.upstream,
		ahead: e.ahead,
		behind: e.behind,
		lastCommitDate: e.lastCommitDate,
		lastCommitSubject: e.lastCommitSubject,
	}
}

export function createGitService(): GitService {
	async function initialize(): Promise<void> {
		try {
			const cwd = process.cwd()
			const isRepo = await isGitRepo(cwd)
			if (!isRepo) return

			const root = await getRepoRoot(cwd)
			const name = basename(root) || root
			const branch = await getCurrentBranch(root)
			const remoteUrl = await getRemoteUrl("origin", root)
			const { ahead, behind } = await getUpstreamStatus(root)
			const defaultBranch = await getDefaultBranch(root)

			setState("git", {
				isRepo: true,
				repoRoot: root,
				repoName: name,
				currentBranch: branch,
				defaultBranch,
				remoteUrl,
				ahead,
				behind,
			})
		} catch (err) {
			showToast("error", `Failed to detect git repo: ${err}`)
		}
	}

	async function initializeWithRoot(repoRoot: string): Promise<void> {
		try {
			const isRepo = await isGitRepo(repoRoot)
			if (!isRepo) return

			const root = await getRepoRoot(repoRoot)
			const name = basename(root) || root
			const branch = await getCurrentBranch(root)
			const remoteUrl = await getRemoteUrl("origin", root)
			const { ahead, behind } = await getUpstreamStatus(root)
			const defaultBranch = await getDefaultBranch(root)

			// Reset selection state
			setState("git", {
				isRepo: true,
				repoRoot: root,
				repoName: name,
				currentBranch: branch,
				defaultBranch,
				remoteUrl,
				ahead,
				behind,
				status: [],
				log: [],
				branches: [],
				stash: [],
				selectedStatusFile: null,
				selectedLogEntry: null,
				selectedBranch: null,
				diffContent: "",
				commitMessage: "",
			})
		} catch (err) {
			showToast("error", `Failed to switch repo: ${err}`)
		}
	}

	async function refreshStatus(): Promise<void> {
		if (!state.git.isRepo) return
		try {
			const root = state.git.repoRoot
			const [entries, branch] = await Promise.all([getStatus(root), getCurrentBranch(root)])
			updateGitStatus(entries.map(toGitStatusEntry))
			setState("git", "currentBranch", branch)
			// Also refresh upstream
			const { ahead, behind } = await getUpstreamStatus(root)
			setState("git", { ahead, behind })
		} catch (err) {
			showToast("error", `Failed to refresh status: ${err}`)
		}
	}

	async function refreshLog(): Promise<void> {
		if (!state.git.isRepo) return
		try {
			const entries = await getLog({ count: 200, all: true }, state.git.repoRoot)
			updateGitLog(entries.map(toGitLogEntry))
		} catch (err) {
			showToast("error", `Failed to refresh log: ${err}`)
		}
	}

	async function refreshBranches(): Promise<void> {
		if (!state.git.isRepo) return
		try {
			const branches = await getBranches(state.git.repoRoot)
			updateGitBranches(branches.map(toGitBranch))
		} catch (err) {
			showToast("error", `Failed to refresh branches: ${err}`)
		}
	}

	async function refreshStash(): Promise<void> {
		if (!state.git.isRepo) return
		try {
			const stashes = await getStashList(state.git.repoRoot)
			setState("git", "stash", stashes)
		} catch {
			// Ignore
		}
	}

	return {
		initialize,
		initializeWithRoot,
		refreshStatus,
		refreshLog,
		refreshBranches,
		refreshStash,
	}
}
