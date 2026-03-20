# Gubbi Work Plan

## Overview

Gubbi is a terminal-native **Git + GitHub client** built with OpenTUI + SolidJS. Its core value is seamlessly integrating git operations with GitHub context — unlike gh-dash (GitHub-only) or lazygit (git-only).

**Architecture:**
- `app/cli/src/app.tsx` — main app, global keyboard handler
- `packages/core/` — plugin API, state, registry, hotkeys
- `packages/git/` — git operations (git.ts, service.ts, parser.ts, stack.ts)
- `packages/github/` — GitHub CLI wrapper (gh.ts, service.ts, bridge.ts)
- `packages/tui/` — shared components (header.tsx, status-bar.tsx, dialog.tsx, diff-viewer.tsx)
- `packages/plugin-repo/` — status.tsx, log.tsx, branches.tsx, stash.tsx, remotes.tsx
- `packages/plugin-github/` — pull-requests.tsx, issues.tsx, notifications.tsx, actions.tsx
- `packages/plugin-dashboard/` — dashboard.tsx, smartlog.tsx
- `packages/plugin-stacks/` — stacks.tsx

**Current views:** Dashboard (d), Smartlog (1), Status (2), Log (3), Branches (4), Stacks (5), Stash (6), PRs (7), Issues (8), Actions (9), Notifications (0)

---

## Sprint 1 — Git + GitHub Integration (Core Differentiator)

> Goal: Every git view shows GitHub context. This is gubbi's unique value.

### 1.1 Status View: PR Context + Push & Create PR
**File:** `packages/plugin-repo/src/status.tsx`

- [x] Show PR context banner when on a PR branch: `branch • PR #123 ○ open • mergeable`
- [x] `Shift+P` → push branch + create PR if none exists, or just push if PR exists
- [x] Show progress toasts: `Pushing...` → `Creating PR...` → `Done ✓`
- [x] After commit, prompt: "Push and create PR? (P/n)"

**State needed:** `state.github.prs` must be searchable by `headRefName === state.git.currentBranch`

### 1.2 Branches View: PR + CI Status Per Branch
**File:** `packages/plugin-repo/src/branches.tsx`

- [x] Show PR indicator inline per branch: `PR #123 ○` (green=open, gray=draft)
- [x] Color-code with CI status ( requires checks data in state — now available via `GitHubPR.checks`)
- [x] `Shift+P` → push + create PR for selected branch
- [x] `v` → open branch's PR in browser
- [x] `M` → merge PR from branch list (SelectDialog with squash/merge/rebase)
- [x] `Shift+V` → jump to PR view

### 1.3 Log View: Mark Commits in PRs
**File:** `packages/plugin-repo/src/log.tsx`

- [x] Mark commits on PR branches: `[PR #123 ○]` or `[PR #123 ●]` for merged
- [x] Show PR status badge: ● Merged, ○ Open
- [x] `v` → open containing PR in browser

### 1.4 PR View: Checkout Branch Locally
**File:** `packages/plugin-github/src/pull-requests.tsx`

- [x] `C` (Shift+C) → checkout PR branch via `gh pr checkout`
- [x] Show local branch indicator: `⎇ local` when branch exists in git state
- [x] Toast after checkout: `Checked out feature/new-ui → Switch to Status (2)`
- [x] `b` → jump to branches view

### 1.5 Global Context Switching
**File:** `app/cli/src/app.tsx`

- [x] `Shift+V` in Status/Branches → jump to PR view for current/selected branch
- [x] `b` in PR view → jump to Branches view
- [x] Show contextual hint in status bar when on a PR branch (Sprint 2.3)

---

## Sprint 2 — Unified Workflows

> Goal: Stage → Commit → Push → PR → Merge without ever leaving the TUI.

### 2.1 Commit → Push → PR Flow
**Files:** `packages/plugin-repo/src/status.tsx`, `packages/core/src/state/index.ts`

- [x] After commit, show confirm prompt: "Push and create PR?"
- [x] Smart PR creation: if branch has no PR → create with commit message as title; if PR exists → just push
- [ ] Show inline progress feedback during push and PR creation

**New utility:** `packages/github/src/bridge.ts`
- [x] `pushAndCreatePR()` — push branch, create PR if needed
- [ ] `checkoutPRBranch(pr)` — fetch if remote-only, then checkout
- [x] `getCurrentBranchPR()` — find PR for current branch
- [x] `getPRForBranch(branch)` — find PR for any branch
- [x] `canMergePR(pr)` — check mergeability

### 2.2 Inline PR Merge from PR View
**File:** `packages/plugin-github/src/pull-requests.tsx`

- [x] `M` → merge selected PR inline (no browser)
- [x] Show merge method options: squash / merge / rebase
- [x] Block merge with warning if CI failing or approvals missing

### 2.3 Context-Aware Status Bar
**File:** `packages/tui/src/status-bar.tsx`

- [x] Show hints based on **selected item**, not just current view:
  - Status + file selected: `Space: stage | d: discard | Enter: diff`
  - Status + on PR branch: `P: push & update PR | V: view PR #123`
  - Branches + branch with PR: `P: push | V: view PR | M: merge`
  - PR view + CI failing: `⚠ CI failing | C: checkout | r: review`
- [ ] Show `↻ syncing...` when background polling is active
- [x] Show `updated Xs ago` for last GitHub refresh

---

## Sprint 3 — UI Polish

> Goal: Clean, modern, fast interface.

### 3.1 Header Redesign
**File:** `packages/tui/src/header.tsx`

- [x] Slim top row: `feature/new-ui  PR #123 ✓  ·  +3 ~2  🔔5`
- [x] Remove: version number, verbose auth status (move to status bar)
- [x] Tab row: visual grouping with separator — `[d] │ [1][2][3][4][5][6] │ [7][8][9][0]`
- [x] Active tab: full highlight (not just underline)

### 3.2 Hunk-Level Staging (Magit-style)
**Files:** `packages/plugin-repo/src/status.tsx`, `packages/tui/src/diff-viewer.tsx`, `packages/git/src/hunk-parser.ts`

- [x] Navigate hunks with `[` / `]`
- [x] `s` → stage selected hunk
- [x] `S` (shift) → stage selected line only
- [x] `u` → unstage hunk
- [x] Visual hunk selection indicator in diff footer (hunk N/M)

**Backend:** `packages/git/src/hunk-parser.ts` — parse unified diff into hunks, generate per-hunk patches for `git apply --cached`

### 3.3 Alternative Navigation
**File:** `app/cli/src/app.tsx`

- [x] `Ctrl+Tab` / `Ctrl+Shift+Tab` → cycle views
- [x] `Ctrl+H` / `Ctrl+L` → previous/next view
- [x] Brief toast on view switch showing view name

---

## Sprint 4 — Dashboard as Action Center

> Goal: Dashboard lets you act, not just observe.

### 4.1 Inline Actions on Dashboard PRs
**File:** `packages/plugin-dashboard/src/dashboard.tsx`

- [x] `m` → merge PR (block with warning if checks fail)
- [x] `c` → checkout PR branch
- [x] `o` → open in browser
- [ ] `r` → open review mode
- [x] Show repo name only when it changes between PRs (not on every row)
- [x] Sort by urgency: CI failing → review requested → approved → draft

### 4.2 Notification Actions
**File:** `packages/plugin-dashboard/src/dashboard.tsx`

- [x] `d` → mark notification as done
- [ ] `m` → mute thread
- [x] `Enter` → jump to related PR/issue

---

## Sprint 5 — Interactive Git Power Features

> Features from lazygit that users love most.

### 5.1 Interactive Rebase UI
**File:** `packages/plugin-repo/src/log.tsx`

- [ ] `i` → enter rebase mode (shows rebase TODO list)
- [ ] In rebase mode: `s` squash, `f` fixup, `d` drop, `e` edit, `r` reword
- [ ] Visual mode shows action labels on each commit
- [ ] `Enter` → execute rebase, `Esc` → cancel

### 5.2 Cherry-Pick Copy/Paste
**File:** `packages/plugin-repo/src/log.tsx`

- [x] `Shift+C` → copy commit(s) to clipboard (toggle: add/remove)
- [x] `Shift+V` → cherry-pick copied commits onto current branch
- [x] Show clipboard indicator: `2 commit(s) copied` in footer

### 5.3 Commit Graph Visualization
**Files:** `packages/plugin-dashboard/src/smartlog.tsx`, new `packages/tui/src/commit-graph.tsx`

- [ ] ASCII graph showing branch relationships (`*`, `|`, `\`, `/`)
- [ ] Branch labels inline: `(HEAD -> feature/new-ui, origin/feature/new-ui)`
- [ ] Navigate chunks in commit diff with `[` / `]`

### 5.4 Commit Filtering
**File:** `packages/plugin-repo/src/log.tsx`

- [x] `/` → open filter prompt (filter by message, author, date)
- [x] Show active filter indicator, `Esc` to clear

---

## Sprint 6 — GitHub Power Features

> Features from gh-dash that users love most.

### 6.1 Inline PR Review
**Files:** `packages/plugin-github/src/pull-requests.tsx`, new `packages/tui/src/review-dialog.tsx`

- [ ] `r` → enter review mode (shows PR diff)
- [ ] `c` → add inline comment at current line
- [ ] `a` → approve PR
- [ ] `Shift+R` → request changes
- [ ] Submit review with body

### 6.2 Request Reviewers
**File:** `packages/plugin-github/src/pull-requests.tsx`

- [ ] `Shift+R` → open reviewer selection dialog
- [ ] Multi-select from repo collaborators
- [ ] Submit and show toast confirmation

### 6.3 Advanced Filtering
**Files:** `packages/plugin-github/src/pull-requests.tsx`, `packages/plugin-github/src/issues.tsx`

- [ ] `/` → open filter dialog (author, assignee, labels, state)
- [x] `f` → cycle state: open → closed → all
- [x] Show active filters in view header
- [ ] Persist filters between sessions

### 6.4 Create PR/Issue Dialog
**File:** `packages/plugin-github/src/pull-requests.tsx`

- [x] `n` → open PR creation dialog (title, body, base branch)
- [x] Pre-fill title from last commit message
- [x] Pre-fill base from default branch

---

## Sprint 7 — Advanced Features

> Higher-effort features for power users.

### 7.1 GitHub Actions: Trigger + Watch
**File:** `packages/plugin-github/src/actions.tsx`

- [ ] `t` → trigger workflow with input dialog
- [ ] `w` → watch selected run (live polling every 5s until complete)
- [ ] `Ctrl+L` → toggle auto-refresh
- [ ] Show `● watching` indicator on watched run

### 7.2 Worktree Management
**New files:** `packages/plugin-repo/src/worktrees-view.tsx`, `packages/git/src/worktree.ts`

- [ ] List worktrees with status (locked, prunable, head, path)
- [ ] `a` → create worktree (with post-create hook: copy .env, npm install)
- [ ] `d` → remove worktree
- [ ] `o` → open in new tmux window / zellij tab / terminal
- [ ] `r` → repair worktree
- [ ] Register as new view in plugin

### 7.3 Git Blame View
**New files:** `packages/plugin-repo/src/blame-view.tsx`, `packages/git/src/blame.ts`

- [ ] `b` → toggle blame overlay on selected file
- [ ] Show: commit hash, author (truncated), relative time, line content
- [ ] `Enter` on blame line → jump to commit in Log view

### 7.4 Operation Log & Undo
**New file:** `packages/core/src/history/operation-log.ts`

- [ ] Record every git operation (commit, rebase, merge, checkout, push) with before/after state
- [ ] `Ctrl+Z` → undo last operation via git reflog
- [ ] New view (or overlay) showing recent operations timeline

### 7.5 Enhanced Stack Features
**File:** `packages/plugin-stacks/src/stacks.tsx`

- [ ] Visual stack tree with PR status per branch:
  ```
  ┌─ main (merged)
  ├─ feat/auth         PR #123 ✓ approved
  ├─ feat/auth-ui      PR #124 ○ in review
  └─ feat/auth-tests   PR #125 ◌ draft
  ```
- [ ] `u` / `d` → navigate up/down in stack (checkout)
- [ ] `t` / `b` → jump to top/bottom of stack
- [ ] Auto-rebase dependents when a stack branch is updated

---

## Sprint 8 — Configuration System

> YAML config for power users and team sharing.

### 8.1 YAML Config File
**Files:** `packages/config/src/index.ts`, new `packages/config/src/schema.ts`

Config at `~/.config/gubbi/config.yaml`:

```yaml
theme: "github-dark"
pollInterval:
  notifications: 120000
  prs: 120000

dashboard:
  sections:
    - name: "My PRs"
      type: "pr"
      filters: { author: "@me", state: "open" }
    - name: "Needs Review"
      type: "pr"
      filters: { review-requested: "@me", state: "open" }

keybindings:
  status:
    stage: "Space"
    commit: "c"
    pushAndPR: "P"

actions:
  - name: "Mark Ready"
    key: "R"
    command: "gh pr ready $PR_NUMBER"
  - name: "Auto-merge"
    key: "A"
    commands:
      - "gh pr review $PR_NUMBER --approve"
      - "gh pr merge $PR_NUMBER --auto --squash"
```

- [ ] Load and validate config on startup
- [ ] Apply custom keybindings to registry
- [ ] Load custom dashboard sections
- [ ] Execute custom actions via `packages/core/src/actions/custom.ts`

---

## Sprint 9 — Query & Cache System

> Goal: TanStack Query-style caching for all data fetching. Stale-while-revalidate, deduplication, targeted invalidation.

Currently each view re-implements fetching and caching ad-hoc (dashboard has a module-level cache object, other views have no caching). This sprint creates a centralized query layer.

### 9.1 Query Cache Core
**New file:** `packages/core/src/query.ts`

API inspired by TanStack Query, adapted for SolidJS + terminal:

```ts
// Query: fetch + cache + stale detection
const prsQuery = createQuery({
  queryKey: () => ["prs", { state: "open" }],
  queryFn: () => listPRs({ state: "open" }),
  staleTime: 60_000,        // data fresh for 60s
  refetchInterval: 120_000, // background poll every 2m
})

// Read: returns signal-like { data, isLoading, isStale, error, refetch }
prsQuery.data       // cached data (immediately available)
prsQuery.isLoading  // true only on first fetch
prsQuery.isStale    // true when staleTime expired
prsQuery.refetch()  // manual refresh
```

- [ ] `createQuery()` — keyed fetcher with `staleTime`, `refetchInterval`, `gcTime`
- [ ] Query key serialization + deduplication (same key = single in-flight request)
- [ ] Stale-while-revalidate: show cached data, refetch in background
- [ ] `invalidateQuery(key)` — mark query stale, triggers refetch
- [ ] Garbage collection: evict queries unused for `gcTime` (default 5min)
- [ ] `useQuery()` hook — wraps `createQuery` with SolidJS reactivity (auto-dispose on unmount)

### 9.2 Mutation Layer
**File:** `packages/core/src/query.ts`

```ts
const mergeMutation = createMutation({
  mutationFn: (pr: PullRequest) => mergePR(pr.number, "squash"),
  onMutate: (pr) => {
    // optimistic: remove PR from list immediately
    setQueryData(["prs"], (old) => old.filter(p => p.number !== pr.number))
  },
  onError: (err, pr) => {
    // rollback on failure
    invalidateQuery(["prs"])
  },
  onSuccess: () => invalidateQuery(["prs"]),
})
```

- [ ] `createMutation()` — `mutationFn`, `onMutate`, `onSuccess`, `onError`
- [ ] `setQueryData(key, updater)` — direct cache write for optimistic updates
- [ ] `getQueryData(key)` — read cached value without triggering fetch

### 9.3 Migrate Existing Views
**Files:** all plugin views

- [ ] Dashboard: replace module-level cache with `createQuery` per column
- [ ] PRs view: `createQuery({ queryKey: ["prs"], queryFn: listPRs })`
- [ ] Issues view: same pattern
- [ ] Branches: `createQuery({ queryKey: ["branches"], queryFn: getBranches })`
- [ ] Status: cache diff content per file path
- [ ] Notifications: `createQuery` with `refetchInterval: 120_000`
- [ ] Remove manual `useInterval` calls; replace with `refetchInterval`
- [ ] Add `invalidateQuery(["prs"])` after merge/create PR operations

### 9.4 Targeted Queries
**File:** `packages/github/src/gh.ts`

Current queries fetch full lists every time. Targeted queries fetch only what changed:

- [ ] `getPR(number)` — fetch single PR by number (for detail view)
- [ ] `getIssue(number)` — fetch single issue
- [ ] `getPRDiff(number)` — already exists, ensure cached by PR number
- [ ] Pagination: `listPRs({ limit: 20, cursor })` — fetch pages on demand
- [ ] Background refresh only fetches pages already viewed

---

## Easy Wins (Pick up anytime)

Low effort, can be done in any sprint as filler tasks:

| Task | File | Effort |
|------|------|--------|
| GPG signing indicator on commits (🔒) | `packages/plugin-repo/src/log.tsx` + `packages/git/src/service.ts` | Low |
| Auto-select most recently modified file in Status | `packages/plugin-repo/src/status.tsx` | Low |
| Progress bar component for push/fetch | new `packages/tui/src/progress-bar.tsx` | Low |
| Pinnable panels (persist expanded state) | `packages/core/src/state/index.ts` | Low |
| Submodule management view | new `packages/plugin-repo/src/submodules-view.tsx` | Medium |
| Release management view | new `packages/plugin-github/src/releases-view.tsx` | Medium |
| Working copy auto-record (WIP commits) | `packages/plugin-repo/src/status.tsx` | Medium |

---

## Success Criteria

1. **No browser needed** for: create PR, merge, checkout, review, request reviewers
2. **GitHub context visible** in every git view (PR status, CI, approvals)
3. **One-key context switch** between related git and GitHub views (`G`)
4. **Full workflow in TUI**: stage → commit → push → PR → CI → merge
5. **Clean interface**: essential info only, hints adapt to selected item
