#!/usr/bin/env bun
/**
 * index.tsx — Gubbi entry point
 * Terminal-native Git + GitHub client powered by OpenTUI
 */

import { render } from "@opentui/solid"

import { App } from "./app.tsx"

render(() => <App />, {
	exitOnCtrlC: false, // We handle Ctrl+C ourselves for cleanup
})
