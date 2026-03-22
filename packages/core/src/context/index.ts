/**
 * context/index.ts — Service interfaces for git and GitHub operations
 */

/**
 * Service interfaces
 */
export interface GitService {
	initialize: () => Promise<void>
	initializeWithRoot: (repoRoot: string) => Promise<void>
	refreshStatus: () => Promise<void>
	refreshLog: () => Promise<void>
	refreshBranches: () => Promise<void>
	refreshStash: () => Promise<void>
}

export interface GitHubService {
	checkAuth: () => Promise<void>
	refreshPRs: () => Promise<void>
	refreshIssues: () => Promise<void>
	refreshRuns: () => Promise<void>
	refreshNotifications: () => Promise<void>
}
