#!/usr/bin/env bun
/**
 * index.tsx — Gubbi CLI entry point
 * Terminal-native Git + GitHub client powered by plugins
 */

import { commandExists } from "@gubbi/git"
import { githubService } from "@gubbi/github"
import { render } from "@opentui/solid"

import { App } from "./app.tsx"

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

void render(() => <App />, {
	exitOnCtrlC: false,
})
