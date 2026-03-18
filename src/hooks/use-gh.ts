/**
 * use-gh.ts — Reactive GitHub data with polling
 */

import { onMount } from "solid-js"

import {
	isAuthenticated,
	getAuthUser,
	listPRs,
	listIssues,
	listRuns,
	listNotifications,
} from "../lib/gh.ts"
import {
	state,
	setState,
	setLoading,
	updatePRs,
	updateIssues,
	updateRuns,
	showToast,
} from "../lib/store.ts"
import { useInterval } from "./use-interval.ts"

/** Initialize GitHub auth state on mount */
export function useGhInit() {
	onMount(async () => {
		try {
			const [authed, user] = await Promise.all([isAuthenticated(), getAuthUser()])
			setState({ isGhAuthenticated: authed, ghUser: user })

			if (authed) {
				await refreshGhData()
			}
		} catch {
			setState("isGhAuthenticated", false)
		}
	})
}

/** Refresh pull requests */
export async function refreshPRs() {
	if (!state.isGhAuthenticated) return
	setLoading("prs", true)
	try {
		const prs = await listPRs({ state: "open", limit: 50 })
		updatePRs(prs)
	} catch (err) {
		showToast("error", `Failed to load PRs: ${err}`)
	} finally {
		setLoading("prs", false)
	}
}

/** Refresh issues */
export async function refreshIssues() {
	if (!state.isGhAuthenticated) return
	setLoading("issues", true)
	try {
		const issues = await listIssues({ state: "open", limit: 50 })
		updateIssues(issues)
	} catch (err) {
		showToast("error", `Failed to load issues: ${err}`)
	} finally {
		setLoading("issues", false)
	}
}

/** Refresh workflow runs */
export async function refreshRuns() {
	if (!state.isGhAuthenticated) return
	setLoading("actions", true)
	try {
		const runs = await listRuns({ limit: 30 })
		updateRuns(runs)
	} catch (err) {
		showToast("error", `Failed to load runs: ${err}`)
	} finally {
		setLoading("actions", false)
	}
}

/** Refresh notifications */
export async function refreshNotifications() {
	if (!state.isGhAuthenticated) return
	setLoading("notifications", true)
	try {
		const notifications = await listNotifications({ limit: 50 })
		setState("notifications", notifications)
		setState("unreadNotifications", notifications.filter((n) => n.unread).length)
	} catch (err) {
		showToast("error", `Failed to load notifications: ${err}`)
	} finally {
		setLoading("notifications", false)
	}
}

/** Refresh all GitHub data */
export async function refreshGhData() {
	await Promise.all([refreshPRs(), refreshIssues(), refreshRuns(), refreshNotifications()])
}

/** Set up periodic GitHub data refresh */
export function useGhAutoRefresh() {
	// PRs/issues every 60s, notifications every 30s
	useInterval(() => refreshPRs(), 60_000)
	useInterval(() => refreshIssues(), 60_000)
	useInterval(() => refreshRuns(), 30_000)
	useInterval(() => refreshNotifications(), 30_000)
}
