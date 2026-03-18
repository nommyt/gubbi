#!/usr/bin/env bun
/**
 * index.tsx — Gubbi CLI entry point
 * Terminal-native Git + GitHub client powered by plugins
 */

import { render } from "@opentui/solid"

import { App } from "./app.tsx"

render(() => <App />, {
	exitOnCtrlC: false,
})
