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
| `1` | **smartlog** | Sapling-inspired commit graph with inline PR and CI status           |
| `2` | **status**   | Git staging area with diff preview                                   |
| `3` | **log**      | Commit log                                                           |
| `4` | **branches** | Branch list — checkout, create, delete, merge, rebase, push          |
| `5` | **stacks**   | Stacked diff workflow (Graphite-equivalent)                          |
| `6` | **stash**    | Stash list with preview                                              |
| `7` | **PRs**      | Pull requests — view, review, merge, comment                         |
| `8` | **issues**   | Issues — browse, filter, create                                      |
| `9` | **actions**  | GitHub Actions workflow runs                                         |
| `0` | **notifs**   | Notifications — triage, mark read, batch ops                         |

## Keybindings

| Key            | Action                            |
| -------------- | --------------------------------- |
| `d`, `1`–`0`   | Switch view                       |
| `h/l` or `←/→` | Navigate columns (dashboard)      |
| `j/k` or `↑/↓` | Navigate lists                    |
| `Enter`        | Open / select                     |
| `Space`        | Stage / unstage                   |
| `r`            | Refresh current view              |
| `f`            | Toggle fullscreen diff            |
| `S`            | Toggle side-by-side diff          |
| `n`            | New (branch, stash, PR, issue…)   |
| `u/d`          | Navigate up/down stack            |
| `s`            | Sync stack (pull trunk + restack) |
| `p`            | Push / submit                     |
| `?`            | Help overlay                      |
| `Ctrl+c`       | Quit                              |

## Architecture

```
gubbi/
├── app/
│   └── cli/                  # Entry point (bun + @opentui/solid renderer)
└── packages/
    ├── core/                 # Global state (SolidJS store), view registry, plugin context
    ├── git/                  # git CLI wrappers + parser
    ├── github/               # gh CLI wrappers (PRs, issues, notifications, repos)
    ├── tui/                  # Shared terminal UI components (Header, StatusBar, HelpOverlay)
    ├── plugin-dashboard/     # Dashboard + Smartlog views
    ├── plugin-repo/          # Status, Log, Branches, Stash, Remotes views
    ├── plugin-github/        # PRs, Issues, Actions, Notifications views
    └── plugin-stacks/        # Stacked diff workflow view
```

**Stack:**

- [Bun](https://bun.sh) — runtime and package manager
- [SolidJS](https://solidjs.com) — fine-grained reactivity
- [OpenTUI](https://opentui.com/) — terminal renderer with Yoga flexbox layout
- [gh CLI](https://cli.github.com) — GitHub API access (no OAuth token needed)
- [Turborepo](https://turbo.build) — monorepo task runner

## Roadmap

### Dashboard

- [x] My open PRs across all repos (cross-repo search)
- [x] Tagged PRs and issues (review requested + @mentions)
- [x] My repos sorted by latest activity with latest commit
- [x] Notifications with unread state
- [x] Background polling with per-column intervals
- [x] Cache — instant load on revisit, silent background refresh
- [ ] Click-through to full PR/issue view within gubbi
- [ ] Notification mark-as-read from dashboard

### Git

- [x] Status with diff preview
- [x] Stage / unstage files
- [x] Commit log with graph
- [x] Branch management (checkout, create, delete, merge, rebase)
- [x] Stash management
- [ ] Interactive rebase
- [ ] Cherry-pick
- [ ] Conflict resolution UI

### GitHub

- [x] PR list, detail, diff
- [x] PR review (approve, request changes, comment)
- [x] PR merge
- [x] Issue list and detail
- [x] GitHub Actions workflow runs
- [x] Notifications with batch mark-read
- [ ] PR checks / CI status drill-down
- [ ] Create PR from branch
- [ ] Issue creation
- [ ] PR review thread reply

### Stacks

- [x] Stack visualization
- [x] Create, sync, submit
- [ ] Absorb, fold, split
- [ ] Conflict resolution during sync

### General

- [x] Plugin architecture
- [x] Vim-style keyboard navigation
- [x] Help overlay
- [x] Toast notifications
- [x] `gh` CLI auth flow at startup
- [ ] Config file (`~/.config/gubbi/config.toml`)
- [ ] Mouse support (partial)
- [ ] Custom keybinding remapping

## Inspirations

- [Better Hub](https://github.com/better-auth/better-hub) by the Better Auth team — inspiration for the UI layouts

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
