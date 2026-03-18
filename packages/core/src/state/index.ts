/**
 * state/index.ts — Global application state using SolidJS stores
 */

import { createRoot } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type {
  AppState,
  GitState,
  GitHubState,
  UIState,
  ToastType,
  GitStatusEntry,
  GitLogEntry,
  GitBranch,
  GitHubPR,
  GitHubIssue,
  GitHubWorkflowRun,
  GitHubNotification,
} from "../types/state.ts"

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialGitState: GitState = {
  isRepo: false,
  repoRoot: "",
  repoName: "",
  currentBranch: "",
  defaultBranch: "main",
  ahead: 0,
  behind: 0,
  remoteUrl: "",
  status: [],
  log: [],
  branches: [],
  stash: [],
  remotes: [],
  selectedStatusFile: null,
  selectedLogEntry: null,
  selectedBranch: null,
  selectedStashIndex: -1,
  diffContent: "",
  diffStaged: false,
  sideBySideDiff: false,
  commitMessage: "",
  isCommitting: false,
}

const initialGitHubState: GitHubState = {
  isAuthenticated: false,
  user: "",
  prs: [],
  issues: [],
  workflowRuns: [],
  notifications: [],
  selectedPR: null,
  selectedIssue: null,
  selectedRun: null,
  unreadNotificationCount: 0,
}

const initialUIState: UIState = {
  currentView: "dashboard",
  focusedPanel: "primary",
  fullscreenPanel: null,
  loading: {
    status: false,
    log: false,
    branches: false,
    prs: false,
    issues: false,
    actions: false,
    notifications: false,
  },
  toasts: [],
  helpVisible: false,
}

const initialState: AppState = {
  git: initialGitState,
  github: initialGitHubState,
  ui: initialUIState,
}

// ---------------------------------------------------------------------------
// Store Creation
// ---------------------------------------------------------------------------

export const [state, setState] = createRoot(() => createStore<AppState>(initialState))

// ---------------------------------------------------------------------------
// Action Helpers
// ---------------------------------------------------------------------------

export function setView(viewId: string) {
  setState("ui", "currentView", viewId)
}

export function setFocus(panel: UIState["focusedPanel"]) {
  setState("ui", "focusedPanel", panel)
}

export function toggleFullscreen(panel: "primary" | "detail") {
  setState("ui", "fullscreenPanel", (prev) => (prev === panel ? null : panel))
}

export function showToast(type: ToastType, message: string, durationMs = 3000) {
  const id = `${Date.now()}-${Math.random()}`
  setState("ui", "toasts", (prev) => [...prev, { id, type, message }])
  setTimeout(() => {
    setState("ui", "toasts", (prev) => prev.filter((t) => t.id !== id))
  }, durationMs)
}

export function setLoading(key: keyof UIState["loading"], value: boolean) {
  setState("ui", "loading", key, value)
}

export function updateGitStatus(entries: GitStatusEntry[]) {
  setState(
    produce((s) => {
      s.git.status = entries
      // Keep selection if still valid
      if (s.git.selectedStatusFile) {
        const still = entries.find((e) => e.path === s.git.selectedStatusFile?.path)
        s.git.selectedStatusFile = still ?? entries[0] ?? null
      } else {
        s.git.selectedStatusFile = entries[0] ?? null
      }
    }),
  )
}

export function updateGitLog(entries: GitLogEntry[]) {
  setState(
    produce((s) => {
      s.git.log = entries
      if (!s.git.selectedLogEntry && entries.length > 0) {
        s.git.selectedLogEntry = entries[0] ?? null
      }
    }),
  )
}

export function updateGitBranches(branches: GitBranch[]) {
  setState(
    produce((s) => {
      s.git.branches = branches
      if (!s.git.selectedBranch && branches.length > 0) {
        s.git.selectedBranch = branches.find((b) => b.current) ?? branches[0] ?? null
      }
    }),
  )
}

export function updateGitHubPRs(prs: GitHubPR[]) {
  setState(
    produce((s) => {
      s.github.prs = prs
      if (!s.github.selectedPR && prs.length > 0) s.github.selectedPR = prs[0] ?? null
    }),
  )
}

export function updateGitHubIssues(issues: GitHubIssue[]) {
  setState(
    produce((s) => {
      s.github.issues = issues
      if (!s.github.selectedIssue && issues.length > 0) s.github.selectedIssue = issues[0] ?? null
    }),
  )
}

export function updateGitHubRuns(runs: GitHubWorkflowRun[]) {
  setState(
    produce((s) => {
      s.github.workflowRuns = runs
      if (!s.github.selectedRun && runs.length > 0) s.github.selectedRun = runs[0] ?? null
    }),
  )
}

export function updateGitHubNotifications(notifications: GitHubNotification[]) {
  setState(
    produce((s) => {
      s.github.notifications = notifications
      s.github.unreadNotificationCount = notifications.filter((n) => n.unread).length
    }),
  )
}

// ---------------------------------------------------------------------------
// State Selectors
// ---------------------------------------------------------------------------

export const selectCurrentView = () => state.ui.currentView
export const selectIsGitRepo = () => state.git.isRepo
export const selectIsGhAuthenticated = () => state.github.isAuthenticated
export const selectFocusedPanel = () => state.ui.focusedPanel
export const selectFullscreenPanel = () => state.ui.fullscreenPanel

// ---------------------------------------------------------------------------
// View Registry
// ---------------------------------------------------------------------------

export const VIEWS = [
  { id: "dashboard", label: "Dashboard", key: "d" },
  { id: "smartlog", label: "Smartlog", key: "1" },
  { id: "status", label: "Status", key: "2" },
  { id: "log", label: "Log", key: "3" },
  { id: "branches", label: "Branches", key: "4" },
  { id: "stacks", label: "Stacks", key: "5" },
  { id: "stash", label: "Stash", key: "6" },
  { id: "prs", label: "Pull Requests", key: "7" },
  { id: "issues", label: "Issues", key: "8" },
  { id: "actions", label: "Actions", key: "9" },
  { id: "notifications", label: "Notifs", key: "0" },
] as const
