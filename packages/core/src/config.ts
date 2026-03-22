/**
 * config.ts — YAML configuration file loader for ~/.config/gubbi/config.yaml
 *
 * Config schema (see plan.md Sprint 8.1 for full spec):
 *   theme: "github-dark"
 *   pollInterval:
 *     notifications: 120000
 *     prs: 120000
 *   dashboard:
 *     sections:
 *       - name: "My PRs"
 *         type: "pr"
 *         filters: { author: "@me", state: "open" }
 *   keybindings:
 *     status:
 *       stage: "Space"
 *       commit: "c"
 */

import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_DIR = join(homedir(), ".config", "gubbi")
const CONFIG_FILE = join(CONFIG_DIR, "config.yaml")

export interface GubbiConfig {
	theme?: string
	pollInterval?: {
		notifications?: number
		prs?: number
		issues?: number
	}
	dashboard?: {
		sections?: Array<{
			name: string
			type: string
			filters?: Record<string, string>
		}>
	}
	keybindings?: Record<string, Record<string, string>>
	actions?: Array<{
		name: string
		key: string
		command?: string
		commands?: string[]
	}>
	repoScan?: {
		paths?: string[]
		maxDepth?: number
	}
}

let cachedConfig: GubbiConfig | null = null

/**
 * Load and parse the config file.
 * Returns an empty object if the file doesn't exist or is invalid.
 */
export function loadConfig(): GubbiConfig {
	if (cachedConfig) return cachedConfig

	try {
		if (!existsSync(CONFIG_FILE)) {
			cachedConfig = {}
			return cachedConfig
		}
		const raw = readFileSync(CONFIG_FILE, "utf-8")
		const parsed = Bun.YAML.parse(raw) as GubbiConfig
		cachedConfig = parsed ?? {}
		return cachedConfig
	} catch {
		cachedConfig = {}
		return cachedConfig
	}
}

/**
 * Get the config file path.
 */
export function getConfigPath(): string {
	return CONFIG_FILE
}

/**
 * Check if a config file exists.
 */
export function configExists(): boolean {
	return existsSync(CONFIG_FILE)
}

/**
 * Reset the cached config (for testing or hot-reload).
 */
export function resetConfigCache() {
	cachedConfig = null
}
