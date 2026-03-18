/**
 * use-git.ts — Reactive git state with auto-refresh
 */

import { onMount } from "solid-js"

import {
	isGitRepo,
	getRepoRoot,
	getCurrentBranch,
	getUpstreamStatus,
	getStatus,
	getLog,
	getBranches,
	getStashList,
	getRemoteUrl,
} from "../lib/git.ts"
import { parseStashList } from "../lib/parser.ts"
import {
	state,
	setState,
	setLoading,
	updateStatusEntries,
	updateLogEntries,
	updateBranches,
	showToast,
} from "../lib/store.ts"
import { useInterval } from "./use-interval.ts"

/** Initialize git repo state on mount */
export function useGitInit() {
	onMount(async () => {
		try {
			const cwd = process.cwd()
			const isRepo = await isGitRepo(cwd)
			if (!isRepo) {
				setState("isGitRepo", false)
				return
			}

			const [root, branch, remoteUrl] = await Promise.all([
				getRepoRoot(cwd),
				getCurrentBranch(cwd),
				getRemoteUrl("origin", cwd),
			])

			const repoName = root.split("/").at(-1) ?? root

			setState({
				isGitRepo: true,
				repoRoot: root,
				repoName,
				currentBranch: branch,
				remoteUrl,
			})

			// Load initial data
			await refreshAll(root)
		} catch (err) {
			showToast("error", `Failed to initialize git: ${err}`)
		}
	})
}

/** Refresh upstream ahead/behind counts */
export async function refreshUpstream(cwd?: string) {
	try {
		const { ahead, behind } = await getUpstreamStatus(cwd ?? state.repoRoot)
		setState({ ahead, behind })
	} catch {
		// Ignore — might not have upstream
	}
}

/** Refresh git status */
export async function refreshStatus(cwd?: string) {
	setLoading("status", true)
	try {
		const root = cwd ?? state.repoRoot
		const [entries, branch] = await Promise.all([getStatus(root), getCurrentBranch(root)])
		updateStatusEntries(entries)
		setState("currentBranch", branch)
		await refreshUpstream(root)
	} catch (err) {
		showToast("error", `Failed to refresh status: ${err}`)
	} finally {
		setLoading("status", false)
	}
}

/** Refresh commit log */
export async function refreshLog(cwd?: string) {
	setLoading("log", true)
	try {
		const entries = await getLog({ count: 200, all: true }, cwd ?? state.repoRoot)
		updateLogEntries(entries)
	} catch (err) {
		showToast("error", `Failed to refresh log: ${err}`)
	} finally {
		setLoading("log", false)
	}
}

/** Refresh branches */
export async function refreshBranches(cwd?: string) {
	setLoading("branches", true)
	try {
		const branches = await getBranches(cwd ?? state.repoRoot)
		updateBranches(branches)
	} catch (err) {
		showToast("error", `Failed to refresh branches: ${err}`)
	} finally {
		setLoading("branches", false)
	}
}

/** Refresh stash */
export async function refreshStash(cwd?: string) {
	try {
		const stashes = await getStashList(cwd ?? state.repoRoot)
		setState("stashEntries", stashes)
	} catch {
		// Ignore
	}
}

/** Full refresh of all git data */
export async function refreshAll(cwd?: string) {
	const root = cwd ?? state.repoRoot
	await Promise.all([
		refreshStatus(root),
		refreshLog(root),
		refreshBranches(root),
		refreshStash(root),
	])
}

/** Set up periodic auto-refresh (every 5 seconds for status) */
export function useGitAutoRefresh() {
	useInterval(() => refreshStatus(), 5000)
	useInterval(() => refreshUpstream(), 15000)
}
