# gubbi

Terminal-native Git + GitHub client — an enhanced alternative to the GitHub web UI.

## Features

- **Smartlog** — Sapling-inspired filtered commit graph with inline PR/CI status
- **Status** — Git staging with diff preview, full-screen toggle, side-by-side mode
- **Branches** — CRUD, checkout, merge, rebase, push
- **Stacked Diffs** — Graphite-equivalent workflow (create, sync, submit, absorb, fold, split)
- **GitHub Integration** — PRs, Issues, Actions, Notifications via `gh` CLI
- **Stash** — Manage stashes with preview
- **Full keyboard navigation** — Vim-style keybindings

## Installation

```bash
bun install
```

## Usage

```bash
# Run from source
bun run src/index.tsx

# Or make it available system-wide (macOS/Linux)
ln -s $(pwd)/src/index.tsx /usr/local/bin/gubbi
```

Then navigate to a git repository and run:

```bash
gubbi
```

## Keybindings

| Key      | Action                               |
| -------- | ------------------------------------ |
| `1-0`    | Switch to view by number             |
| `j/k`    | Navigate lists                       |
| `Enter`  | Select/open                          |
| `Space`  | Stage/unstage                        |
| `f`      | Toggle fullscreen diff               |
| `S`      | Toggle side-by-side diff             |
| `n`      | New (branch, stash, PR, issue, etc.) |
| `u/d`    | Navigate up/down stack               |
| `s`      | Sync stack (pull trunk + restack)    |
| `p`      | Push/submit                          |
| `?`      | Help                                 |
| `Ctrl+c` | Quit                                 |

## Architecture

Built with:

- **Bun** — Fast JavaScript runtime
- **OpenTUI** — Terminal UI renderer with Yoga layout and Tree-sitter syntax highlighting
- **SolidJS** — Fine-grained reactivity

## License

MIT
