/**
 * repo-scan.ts — Scan directories for git repos, build fullName→path map
 */

import { homedir } from "node:os"

import { loadConfig } from "@gubbi/core"
import { getPersistedValue, setPersistedValue } from "@gubbi/core"

import { exec } from "./shell.ts"

export type RepoMap = Record<string, string>

const REPO_MAP_KEY = "repoMap"
const REPO_MAP_UPDATED_KEY = "repoMapUpdatedAt"
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Parse a git remote URL into "owner/repo" (GitHub only).
 * Supports:
 *   git@github.com:owner/repo.git
 *   ssh://git@github.com/owner/repo.git
 *   https://github.com/owner/repo.git
 *   git://github.com/owner/repo.git
 */
export function normalizeRemoteToFullName(url: string): string | null {
	if (!url) return null

	// SSH style: git@github.com:owner/repo.git
	const sshMatch = url.match(/git@github\.com:(.+?)(?:\.git)?$/)
	if (sshMatch) return sshMatch[1] ?? null

	// URL style: https://github.com/owner/repo.git or ssh://git@github.com/owner/repo.git
	const urlMatch = url.match(/github\.com\/(.+?)(?:\.git)?$/)
	if (urlMatch) return urlMatch[1] ?? null

	return null
}

/**
 * Expand ~ to home directory in a path.
 */
function expandHome(p: string): string {
	if (p.startsWith("~/")) return homedir() + p.slice(1)
	if (p === "~") return homedir()
	return p
}

/**
 * Scan given directories for git repos and build a fullName→path map.
 * Uses `find -L` to locate .git directories up to maxDepth levels.
 */
export async function scanRepos(scanPaths: string[], maxDepth = 3): Promise<RepoMap> {
	const map: RepoMap = {}

	for (const rawPath of scanPaths) {
		const scanPath = expandHome(rawPath)

		const r = await exec(
			"find",
			["-L", scanPath, "-maxdepth", String(maxDepth), "-type", "d", "-name", ".git"],
			{ timeout: 60_000 },
		)
		if (r.exitCode !== 0) continue

		const gitDirs = r.stdout
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean)

		for (const gitDir of gitDirs) {
			const repoDir = gitDir.replace(/\/\.git$/, "")

			const remoteResult = await exec("git", ["-C", repoDir, "remote", "get-url", "origin"], {
				timeout: 5_000,
			})
			if (remoteResult.exitCode !== 0) continue

			const fullName = normalizeRemoteToFullName(remoteResult.stdout.trim())
			if (fullName) {
				map[fullName] = repoDir
			}
		}
	}

	return map
}

/**
 * Look up a local clone path by full repo name.
 */
export function findLocalClone(fullName: string, map: RepoMap): string | null {
	return map[fullName] ?? null
}

/**
 * Load the persisted repo map from state.
 */
export function loadRepoMap(): RepoMap {
	return getPersistedValue<RepoMap>(REPO_MAP_KEY, {})
}

/**
 * Save the repo map to persisted state.
 */
export function saveRepoMap(map: RepoMap) {
	setPersistedValue(REPO_MAP_KEY, map)
	setPersistedValue(REPO_MAP_UPDATED_KEY, Date.now())
}

/**
 * Get the repo map — returns cached map if fresh (<24h), otherwise scans and persists.
 * Returns empty map if no repoScan config is set.
 */
export async function getOrScanRepoMap(): Promise<RepoMap> {
	const config = loadConfig()
	const scanConfig = config.repoScan

	// If no scan paths configured, return persisted map (might be empty)
	if (!scanConfig?.paths?.length) {
		return loadRepoMap()
	}

	// Check freshness
	const updatedAt = getPersistedValue<number>(REPO_MAP_UPDATED_KEY, 0)
	const age = Date.now() - updatedAt
	if (age < STALE_THRESHOLD_MS) {
		return loadRepoMap()
	}

	// Scan fresh
	const map = await scanRepos(scanConfig.paths, scanConfig.maxDepth ?? 3)
	saveRepoMap(map)
	return map
}
