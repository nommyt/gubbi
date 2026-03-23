/**
 * gh.ts — Re-exports from domain-specific GitHub CLI modules
 */

export { isAuthenticated, getAuthUser, loginWeb } from "./gh-auth.ts"

export {
	type PRReviewer,
	type PRCheck,
	type PullRequest,
	listPRs,
	getPR,
	getPRForCurrentBranch,
	createPR,
	mergePR,
	getPRDiff,
	reviewPR,
	checkoutPR,
	closePR,
	reopenPR,
	requestReviewers,
	commentOnPR,
	type SearchPR,
	searchMyOpenPRs,
} from "./gh-prs.ts"

export {
	type Issue,
	type IssueComment,
	listIssues,
	getIssue,
	createIssue,
	getIssueComments,
	commentOnIssue,
	closeIssue,
	reopenIssue,
} from "./gh-issues.ts"

export {
	type WorkflowRun,
	type Workflow,
	listRuns,
	getRun,
	rerunRun,
	getRunLogs,
	listWorkflows,
	triggerWorkflow,
} from "./gh-actions.ts"

export {
	type Notification,
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	muteNotificationThread,
} from "./gh-notifications.ts"

export {
	type UserRepo,
	type RepoInfo,
	type ExploreRepo,
	listUserRepos,
	searchRepos,
	fetchTrendingRepos,
	getRepoInfo,
} from "./gh-repos.ts"
