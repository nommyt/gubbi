# gubbi

> **Work in progress** — not production ready. Expect breaking changes.

A terminal-native Git + GitHub client. Full keyboard navigation, live GitHub data, and a dashboard that replaces the GitHub web UI — all in your terminal.

Built on [Bun](https://bun.sh), [SolidJS](https://solidjs.com), and [OpenTUI](https://opentui.com/).

---

## Requirements

- [Bun](https://bun.sh) >= 1.3
- [git](https://git-scm.com)
- [gh](https://cli.github.com) — GitHub CLI, authenticated (`gh auth login`)
- [Nerd Font](https://www.nerdfonts.com/) — required for icons. Install any Nerd Font (e.g. JetBrains Mono Nerd Font, Hack Nerd Font) and set it as your terminal font.

## Installation

```bash
git clone https://github.com/nommyt/gubbi
cd gubbi
bun install
```

## Usage

Run from inside any git repository:

```bash
bun run app/cli/src/index.tsx
```

Or add an alias to your shell config:

```bash
alias gubbi="bun run /path/to/gubbi/app/cli/src/index.tsx"
```

## Views

| Key | View         | Description                                                          |
| --- | ------------ | -------------------------------------------------------------------- |
| `d` | **dash**     | Live GitHub dashboard — your PRs, tagged items, repos, notifications |
| `1` | **smartlog** | Sapling-inspired commit graph with ASCII visualization               |
| `2` | **status**   | Git staging area with diff preview and blame overlay                 |
| `3` | **log**      | Commit log with interactive rebase and cherry-pick                   |
| `4` | **branches** | Branch list — checkout, create, delete, merge, rebase, push          |
| `5` | **stacks**   | Stacked diff workflow (Graphite-equivalent)                          |
| `6` | **stash**    | Stash list with preview                                              |
| `7` | **PRs**      | Pull requests — view, review, merge, comment, fullscreen diff        |
| `8` | **issues**   | Issues — browse, filter, create                                      |
| `9` | **actions**  | GitHub Actions workflow runs with watch and auto-refresh             |
| `0` | **notifs**   | Notifications — triage, mark read, batch ops                         |
| `w` | **worktrees**| Git worktree management — create, remove, prune, repair              |

## Keybindings

### Global

| Key            | Action                            |
| -------------- | --------------------------------- |
| `d`, `1`–`0`, `w` | Switch view                  |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle views         |
| `Ctrl+H` / `Ctrl+L` | Previous / next view        |
| `Ctrl+Z`       | Undo last git operation           |
| `Ctrl+O`       | Operations timeline overlay       |
| `Ctrl+R`       | Refresh current view              |
| `?`            | Help overlay                      |
| `Ctrl+c`       | Quit                              |

### Status View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `Space`        | Stage / unstage file              |
| `s`            | Stage selected hunk               |
| `S`            | Stage selected line               |
| `u`            | Unstage selected hunk             |
| `[` / `]`      | Navigate hunks                    |
| `c`            | Commit                            |
| `P`            | Push and create PR                |
| `b`            | Toggle blame overlay              |
| `V`            | Jump to PR for current branch     |

### Log View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `i`            | Enter interactive rebase mode     |
| `s`            | Squash (in rebase mode)           |
| `f`            | Fixup (in rebase mode)            |
| `d`            | Drop (in rebase mode)             |
| `e`            | Edit (in rebase mode)             |
| `r`            | Reword (in rebase mode)           |
| `Enter`        | Execute rebase                    |
| `Esc`          | Cancel rebase                     |
| `C`            | Copy commit to clipboard          |
| `V`            | Cherry-pick copied commits        |
| `/`            | Filter commits                    |
| `v`            | Open containing PR in browser     |

### Pull Requests View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `r`            | Toggle fullscreen diff            |
| `m`            | Merge selected PR                 |
| `a`            | Review (approve/request changes)  |
| `c`            | Add comment                       |
| `R`            | Request reviewers                 |
| `C`            | Checkout PR branch                |
| `n`            | Create new PR                     |
| `f`            | Cycle filter (open/closed/all)    |
| `/`            | Filter by author                  |

### Dashboard View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `h/l`          | Navigate columns                  |
| `m`            | Merge selected PR                 |
| `c`            | Checkout PR branch                |
| `o`            | Open in browser                   |
| `r`            | Jump to PRs view (review mode)    |
| `Ctrl+R`       | Refresh dashboard                 |
| `d`            | Mark notification as done         |

### Actions View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `t`            | Trigger workflow                  |
| `w`            | Toggle watch on selected run      |
| `Ctrl+L`       | Toggle auto-refresh               |
| `r`            | Re-run workflow                   |

### Stacks View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `u/d`          | Navigate up/down in stack         |
| `t/b`          | Jump to top/bottom of stack       |
| `R`            | Rebase all dependents             |
| `s`            | Sync stack                        |
| `p`            | Submit stack as PRs               |
| `a`            | Absorb staged changes             |

### Worktrees View

| Key            | Action                            |
| -------------- | --------------------------------- |
| `n`            | Create new worktree               |
| `d`            | Remove worktree                   |
| `p`            | Prune stale worktrees             |
| `r`            | Repair worktree                   |
| `o`            | Open in terminal                  |

## Configuration

gubbi supports a YAML config file at `~/.config/gubbi/config.yaml`:

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

State is persisted at `~/.gubbi/state.json` (filter preferences, operation history).

## Architecture

```
gubbi/
├── app/
│   └── cli/                  # Entry point (bun + @opentui/solid renderer)
└── packages/
    ├── core/                 # State, plugin API, query cache, config, operation log
    ├── git/                  # git CLI wrappers + parser + hunk staging
    ├── github/               # gh CLI wrappers (PRs, issues, notifications, repos, actions)
    ├── tui/                  # Shared components (Header, StatusBar, DiffViewer, BlameView, dialogs)
    ├── plugin-dashboard/     # Dashboard + Smartlog views
    ├── plugin-repo/          # Status, Log, Branches, Stash, Worktrees views
    ├── plugin-github/        # PRs, Issues, Actions, Notifications views
    └── plugin-stacks/        # Stacked diff workflow view
```

**Stack:**

- [Bun](https://bun.sh) — runtime and package manager
- [SolidJS](https://solidjs.com) — fine-grained reactivity
- [OpenTUI](https://opentui.com/) — terminal renderer with Yoga flexbox layout
- [gh CLI](https://cli.github.com) — GitHub API access (no OAuth token needed)
- [Turborepo](https://turbo.build) — monorepo task runner

## Features

### Git + GitHub Integration
- PR context shown in every git view (status, branches, log)
- One-key workflow: Stage → Commit → Push → PR → Merge
- Multi-step progress toasts during push and PR creation
- Syncing indicator during background polling

### Interactive Rebase
- Enter rebase mode with `i` on any commit
- Squash, fixup, drop, edit, reword with single keys
- Execute with `Enter`, cancel with `Esc`

### Git Blame
- Toggle blame overlay with `b` in status view
- Shows commit hash, author, date for each line

### Operation Log & Undo
- `Ctrl+Z` undoes last git operation (commit, push, etc.)
- `Ctrl+O` shows operations timeline

### Query Cache
- TanStack Query-style caching for all data fetching
- Stale-while-revalidate pattern
- Background polling with `refetchInterval`
- Targeted invalidation after mutations

### Worktree Management
- List, create, remove, prune, repair worktrees
- Open worktree in new terminal window

## Inspirations

- [lazygit](https://github.com/jesseduffield/lazygit) — terminal git UI patterns
- [gh-dash](https://github.com/dlvhdr/gh-dash) — GitHub dashboard in terminal
- [Sapling](https://sapling-scm.com/) — smartlog commit graph
- [Magit](https://magit.vc/) — hunk staging and rebase UI

## Contributing

This project is in early development. Issues and PRs are welcome.

```bash
# Install dependencies
bun install

# Run in dev mode (restarts on file change)
bun run dev:cli

# Lint
bun run lint

# Typecheck
bun run typecheck
```

## License

MIT
