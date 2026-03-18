/**
 * store.ts — Global reactive application state using SolidJS stores/signals
 */

import { createSignal, createRoot } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { StatusEntry, LogEntry, BranchEntry, StashEntry } from "./parser.ts"
import type { PullRequest as GHPullRequest, Issue as GHIssue, WorkflowRun, Notification } from "./gh.ts"

export type ViewName =
  | "smartlog"
  | "status"
  | "log"
  | "branches"
  | "stacks"
  | "stash"
  | "prs"
  | "issues"
  | "actions"
  | "notifications"
  | "remotes"

export const VIEWS: { id: ViewName; label: string; key: string }[] = [
  { id: "smartlog",      label: "Smartlog",     key: "1" },
  { id: "status",        label: "Status",        key: "2" },
  { id: "log",           label: "Log",           key: "3" },
  { id: "branches",      label: "Branches",      key: "4" },
  { id: "stacks",        label: "Stacks",        key: "5" },
  { id: "stash",         label: "Stash",         key: "6" },
  { id: "prs",           label: "Pull Requests",  key: "7" },
  { id: "issues",        label: "Issues",         key: "8" },
  { id: "actions",       label: "Actions",        key: "9" },
  { id: "notifications", label: "Notifs",         key: "0" },
]

export interface ToastMessage {
  id: string
  type: "info" | "success" | "error" | "warning"
  message: string
}

export interface AppState {
  // Repo metadata
  repoRoot: string
  repoName: string
  isGitRepo: boolean
  isGhAuthenticated: boolean
  ghUser: string

  // Branch info
  currentBranch: string
  ahead: number
  behind: number
  remoteUrl: string
  defaultBranch: string

  // Current view
  currentView: ViewName

  // Panel focus: "primary" | "detail"
  focusedPanel: "primary" | "detail"

  // Full screen diff mode
  fullscreenPanel: "primary" | "detail" | null

  // Loading flags
  loading: {
    status: boolean
    log: boolean
    branches: boolean
    prs: boolean
    issues: boolean
    actions: boolean
    notifications: boolean
  }

  // Notifications badge counts
  unreadNotifications: number

  // Toasts/notifications
  toasts: ToastMessage[]

  // Help overlay visible
  helpVisible: boolean

  // Status data
  statusEntries: StatusEntry[]
  selectedStatusFile: StatusEntry | null

  // Log data
  logEntries: LogEntry[]
  selectedLogEntry: LogEntry | null

  // Branches data
  branches: BranchEntry[]
  selectedBranch: BranchEntry | null

  // Stash data
  stashEntries: StashEntry[]
  selectedStashIndex: number

  // GitHub data
  prs: GHPullRequest[]
  selectedPR: GHPullRequest | null
  issues: GHIssue[]
  selectedIssue: GHIssue | null
  workflowRuns: WorkflowRun[]
  selectedRun: WorkflowRun | null
  notifications: Notification[]

  // Current diff content
  diffContent: string
  diffStaged: boolean
  sideBySideDiff: boolean

  // Commit message (when composing)
  commitMessage: string
  isCommitting: boolean
}

const initialState: AppState = {
  repoRoot: "",
  repoName: "",
  isGitRepo: false,
  isGhAuthenticated: false,
  ghUser: "",

  currentBranch: "",
  ahead: 0,
  behind: 0,
  remoteUrl: "",
  defaultBranch: "main",

  currentView: "smartlog",
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

  unreadNotifications: 0,
  toasts: [],
  helpVisible: false,

  statusEntries: [],
  selectedStatusFile: null,

  logEntries: [],
  selectedLogEntry: null,

  branches: [],
  selectedBranch: null,

  stashEntries: [],
  selectedStashIndex: -1,

  prs: [],
  selectedPR: null,
  issues: [],
  selectedIssue: null,
  workflowRuns: [],
  selectedRun: null,
  notifications: [],

  diffContent: "",
  diffStaged: false,
  sideBySideDiff: false,

  commitMessage: "",
  isCommitting: false,
}

// Create store in a root to avoid reactive leaks
export const [state, setState] = createRoot(() => createStore<AppState>(initialState))

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

export function setView(view: ViewName) {
  setState("currentView", view)
}

export function setFocus(panel: AppState["focusedPanel"]) {
  setState("focusedPanel", panel)
}

export function toggleFullscreen(panel: "primary" | "detail") {
  setState("fullscreenPanel", prev => prev === panel ? null : panel)
}

export function showToast(type: ToastMessage["type"], message: string, durationMs = 3000) {
  const id = `${Date.now()}-${Math.random()}`
  setState("toasts", prev => [...prev, { id, type, message }])
  setTimeout(() => {
    setState("toasts", prev => prev.filter(t => t.id !== id))
  }, durationMs)
}

export function setLoading(key: keyof AppState["loading"], value: boolean) {
  setState("loading", key, value)
}

export function updateStatusEntries(entries: StatusEntry[]) {
  setState(produce(s => {
    s.statusEntries = entries
    // Keep selection if still valid
    if (s.selectedStatusFile) {
      const still = entries.find(e => e.path === s.selectedStatusFile?.path)
      s.selectedStatusFile = still ?? entries[0] ?? null
    } else {
      s.selectedStatusFile = entries[0] ?? null
    }
  }))
}

export function updateLogEntries(entries: LogEntry[]) {
  setState(produce(s => {
    s.logEntries = entries
    if (!s.selectedLogEntry && entries.length > 0) {
      s.selectedLogEntry = entries[0] ?? null
    }
  }))
}

export function updateBranches(branches: BranchEntry[]) {
  setState(produce(s => {
    s.branches = branches
    if (!s.selectedBranch && branches.length > 0) {
      s.selectedBranch = branches.find(b => b.current) ?? branches[0] ?? null
    }
  }))
}

export function updatePRs(prs: GHPullRequest[]) {
  setState(produce(s => {
    s.prs = prs
    if (!s.selectedPR && prs.length > 0) s.selectedPR = prs[0] ?? null
  }))
}

export function updateIssues(issues: GHIssue[]) {
  setState(produce(s => {
    s.issues = issues
    if (!s.selectedIssue && issues.length > 0) s.selectedIssue = issues[0] ?? null
  }))
}

export function updateRuns(runs: WorkflowRun[]) {
  setState(produce(s => {
    s.workflowRuns = runs
    if (!s.selectedRun && runs.length > 0) s.selectedRun = runs[0] ?? null
  }))
}
