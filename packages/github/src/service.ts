/**
 * service.ts — GitHubService implementation for the plugin system
 */

import type { GitHubService as GitHubServiceInterface } from "@gubbi/core/context"
import {
	state,
	setState,
	updateGitHubPRs,
	updateGitHubIssues,
	updateGitHubRuns,
	updateGitHubNotifications,
	showToast,
} from "@gubbi/core/state"
import type { GitHubNotification } from "@gubbi/core/types"
import { commandExists } from "@gubbi/git"

import {
	listPRs,
	listIssues,
	listRuns,
	listNotifications,
	isAuthenticated,
	getAuthUser,
	loginWeb,
	type Notification,
} from "./gh.ts"

// Notification from @gubbi/github has a nested `subject` object;
// GitHubNotification in core flattens title/type/url to the top level.
function toGitHubNotification(n: Notification): GitHubNotification {
	return {
		id: n.id,
		title: n.subject.title,
		type: n.subject.type,
		repository: n.repository,
		unread: n.unread,
		updatedAt: n.updatedAt,
		url: n.subject.url,
	}
}

export interface GitHubService extends GitHubServiceInterface {
	checkAuth(): Promise<void>
}

// Singleton instance for direct usage
export const githubService = createGitHubService()

export function createGitHubService(): GitHubService {
	/**
	 * Check gh authentication at startup.
	 * - If gh is not installed, silently skip (GitHub features stay hidden).
	 * - If gh is installed but not authenticated, trigger `gh auth login --web`
	 *   so the user completes the OAuth flow right in the terminal.
	 * - On success, populate state.github.isAuthenticated and state.github.user.
	 */
	async function checkAuth(): Promise<void> {
		setState("github", "isCheckingAuth", true)
		try {
			const ghInstalled = await commandExists("gh")
			if (!ghInstalled) return

			let authed = await isAuthenticated()

			if (!authed) {
				const ok = await loginWeb()
				if (!ok) return
				authed = await isAuthenticated()
			}

			if (authed) {
				const user = await getAuthUser()
				setState("github", "isAuthenticated", true)
				setState("github", "user", user)
			}
		} finally {
			setState("github", "isCheckingAuth", false)
		}
	}

	async function refreshPRs(): Promise<void> {
		if (!state.github.isAuthenticated) return
		try {
			const prs = await listPRs({ state: "open", limit: 50 })
			updateGitHubPRs(prs)
			setState("github", "lastRefreshTime", Date.now())
		} catch (err) {
			showToast("error", `Failed to load PRs: ${err}`)
		}
	}

	async function refreshIssues(): Promise<void> {
		if (!state.github.isAuthenticated) return
		try {
			const issues = await listIssues({ state: "open", limit: 50 })
			updateGitHubIssues(issues)
		} catch (err) {
			showToast("error", `Failed to load issues: ${err}`)
		}
	}

	async function refreshRuns(): Promise<void> {
		if (!state.github.isAuthenticated) return
		try {
			const runs = await listRuns({ limit: 30 })
			updateGitHubRuns(runs)
		} catch (err) {
			showToast("error", `Failed to load runs: ${err}`)
		}
	}

	async function refreshNotifications(): Promise<void> {
		if (!state.github.isAuthenticated) return
		try {
			const notifications = await listNotifications({ limit: 50 })
			updateGitHubNotifications(notifications.map(toGitHubNotification))
		} catch (err) {
			showToast("error", `Failed to load notifications: ${err}`)
		}
	}

	return {
		checkAuth,
		refreshPRs,
		refreshIssues,
		refreshRuns,
		refreshNotifications,
	}
}
