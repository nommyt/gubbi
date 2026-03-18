/**
 * service.ts — GitHubService implementation for the plugin system
 */

import type { GitHubService as GitHubServiceInterface } from "@gubbi/core/context"
import type { GitHubNotification } from "@gubbi/core/types"
import { state, setState, updateGitHubPRs, updateGitHubIssues, updateGitHubRuns, updateGitHubNotifications, showToast } from "@gubbi/core/state"
import { listPRs, listIssues, listRuns, listNotifications, type Notification } from "./gh.ts"

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

export interface GitHubService extends GitHubServiceInterface {}

// Singleton instance for direct usage
export const githubService = createGitHubService()

export function createGitHubService(): GitHubService {
  async function refreshPRs(): Promise<void> {
    if (!state.github.isAuthenticated) return
    try {
      const prs = await listPRs({ state: "open", limit: 50 })
      updateGitHubPRs(prs)
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
    refreshPRs,
    refreshIssues,
    refreshRuns,
    refreshNotifications,
  }
}
