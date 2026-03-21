/**
 * types/state.ts — State slice interfaces for plugins
 */

// ---------------------------------------------------------------------------
// Git State
// ---------------------------------------------------------------------------

export interface GitStatusEntry {
	type:
		| "added"
		| "modified"
		| "deleted"
		| "renamed"
		| "copied"
		| "untracked"
		| "unmerged"
		| "unchanged"
	path: string
	origPath?: string // For renames
	staged: boolean
	unstaged: boolean
}

export interface GitLogEntry {
	hash: string
	shortHash: string
	author: string
	email: string
	authorDate: string
	commitDate: string
	relativeTime: string
	subject: string
	refNames: string[]
	parents: string[]
	signature: string // GPG signature status
}

export interface GitBranch {
	name: string
	current: boolean
	remote?: string
	upstream?: string
	ahead: number
	behind: number
	lastCommitDate: string
	lastCommitSubject: string
}

export interface GitStash {
	index: number
	message: string
}

export interface GitRemote {
	name: string
	url: string
	type: "fetch" | "push"
}

export interface GitState {
	// Repo info
	isRepo: boolean
	repoRoot: string
	repoName: string

	// Branch info
	currentBranch: string
	defaultBranch: string
	ahead: number
	behind: number
	remoteUrl: string

	// Data
	status: GitStatusEntry[]
	log: GitLogEntry[]
	branches: GitBranch[]
	stash: GitStash[]
	remotes: GitRemote[]

	// Selection
	selectedStatusFile: GitStatusEntry | null
	selectedLogEntry: GitLogEntry | null
	selectedBranch: GitBranch | null
	selectedStashIndex: number

	// UI state
	diffContent: string
	diffStaged: boolean
	sideBySideDiff: boolean
	commitMessage: string
	isCommitting: boolean
}

// ---------------------------------------------------------------------------
// GitHub State
// ---------------------------------------------------------------------------

export interface GitHubPR {
	number: number
	title: string
	state: "OPEN" | "CLOSED" | "MERGED"
	isDraft: boolean
	author: string
	headRefName: string
	baseRefName: string
	body: string
	labels: string[]
	additions: number
	deletions: number
	changedFiles: number
	createdAt: string
	updatedAt: string
	url: string
	mergeable: string
	mergeStateStatus: string
	checks: Array<{
		name: string
		status: string
		conclusion: string | null
	}>
}

export interface GitHubIssue {
	number: number
	title: string
	state: "OPEN" | "CLOSED"
	author: string
	labels: string[]
	createdAt: string
	updatedAt: string
	url: string
}

export interface GitHubWorkflowRun {
	id: number
	name: string
	status: string
	conclusion: string | null
	createdAt: string
	updatedAt: string
	url: string
}

export interface GitHubNotification {
	id: string
	title: string
	type: string
	repository: string
	unread: boolean
	updatedAt: string
	url: string
}

export interface GitHubState {
	// Auth
	isAuthenticated: boolean
	isCheckingAuth: boolean
	user: string

	// Data
	prs: GitHubPR[]
	issues: GitHubIssue[]
	workflowRuns: GitHubWorkflowRun[]
	notifications: GitHubNotification[]

	// Selection
	selectedPR: GitHubPR | null
	selectedIssue: GitHubIssue | null
	selectedRun: GitHubWorkflowRun | null

	// Badge counts
	unreadNotificationCount: number

	// Refresh tracking
	lastRefreshTime: number
}

// ---------------------------------------------------------------------------
// UI State
// ---------------------------------------------------------------------------

export type ToastType = "info" | "success" | "error" | "warning"

export interface ToastMessage {
	id: string
	type: ToastType
	message: string
	persistent?: boolean
}

export type ViewId = string

export interface LoadingState {
	status: boolean
	log: boolean
	branches: boolean
	prs: boolean
	issues: boolean
	actions: boolean
	notifications: boolean
}

export interface UIState {
	currentView: ViewId
	focusedPanel: "primary" | "detail"
	fullscreenPanel: "primary" | "detail" | null
	loading: LoadingState
	toasts: ToastMessage[]
	helpVisible: boolean
	syncing: boolean
}

// ---------------------------------------------------------------------------
// Root State
// ---------------------------------------------------------------------------

export interface AppState {
	git: GitState
	github: GitHubState
	ui: UIState
}
