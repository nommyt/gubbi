#!/usr/bin/env bun
/**
 * index.tsx — Gubbi CLI entry point
 * Terminal-native Git + GitHub client powered by plugins
 */

import { state, writeLastDir } from "@gubbi/core"
import { commandExists } from "@gubbi/git"
import { githubService } from "@gubbi/github"
import { render } from "@opentui/solid"

import { App } from "./app.tsx"

// ---------------------------------------------------------------------------
// --init-shell — print shell wrapper function and exit
// ---------------------------------------------------------------------------

const shell = process.argv[2]
if (shell === "--init-shell") {
	const target = process.argv[3] ?? "zsh"
	switch (target) {
		case "zsh":
		case "bash":
			console.log(`gubbi() {
  command gubbi "$@"
  local rc=$?
  local last_dir="$HOME/.gubbi/last-dir"
  if [[ -f "$last_dir" ]]; then
    local dir
    dir="$(<"$last_dir")"
    rm -f "$last_dir"
    [[ -d "$dir" ]] && cd "$dir"
  fi
  return $rc
}`)
			break
		case "fish":
			console.log(`function gubbi
  command gubbi $argv
  set -l rc $status
  set -l last_dir "$HOME/.gubbi/last-dir"
  if test -f "$last_dir"
    set -l dir (cat "$last_dir")
    rm -f "$last_dir"
    test -d "$dir"; and cd "$dir"
  end
  return $rc
end`)
			break
		default:
			console.error(`gubbi: unsupported shell "${target}" (supported: zsh, bash, fish)`)
			process.exit(1)
	}
	process.exit(0)
}

// ---------------------------------------------------------------------------
// Prerequisite checks — must run before the TUI takes over the terminal
// ---------------------------------------------------------------------------

const gitInstalled = await commandExists("git")
const ghInstalled = await commandExists("gh")

if (!gitInstalled || !ghInstalled) {
	const missing: string[] = []
	if (!gitInstalled) missing.push("git")
	if (!ghInstalled) missing.push("gh")

	const noun = missing.length === 1 ? "dependency" : "dependencies"
	console.error(`gubbi: missing required ${noun}: ${missing.join(", ")}`)
	console.error("")

	if (!gitInstalled) {
		console.error("  git   https://git-scm.com/downloads")
	}
	if (!ghInstalled) {
		console.error("  gh    https://cli.github.com")
	}

	console.error("")
	console.error("Install the above, then run gubbi again.")
	process.exit(1)
}

// ---------------------------------------------------------------------------
// gh auth — must run before the TUI starts so the interactive OAuth flow
// can use the terminal freely.
// ---------------------------------------------------------------------------
await githubService.checkAuth()

// On exit, write last-dir so a shell wrapper can cd into the switched repo.
const startCwd = process.cwd()
process.on("exit", () => {
	const root = state.git.repoRoot
	if (root && !startCwd.startsWith(root)) {
		writeLastDir(root)
	}
})

void render(() => <App />, {
	exitOnCtrlC: false,
})
