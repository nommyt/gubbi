/**
 * gh-auth.ts — GitHub authentication via the `gh` CLI.
 *
 * Provides helpers to check auth status, retrieve the logged-in user,
 * and launch an interactive browser-based OAuth login flow.
 */

import { exec, execOrThrow, execInteractive } from "@gubbi/git"

const GH = "gh"

/**
 * Check whether the user is currently authenticated with `gh`.
 * Resolves `true` if `gh auth status` exits successfully within 5 s.
 */
export async function isAuthenticated(): Promise<boolean> {
	const r = await exec(GH, ["auth", "status"], { timeout: 5000 })
	return r.exitCode === 0
}

/**
 * Return the GitHub login (username) of the currently authenticated user.
 * Returns an empty string if no user is logged in or the request fails.
 */
export async function getAuthUser(): Promise<string> {
	try {
		const out = await execOrThrow(GH, ["api", "user", "--jq", ".login"])
		return out.trim()
	} catch {
		return ""
	}
}

/**
 * Launch an interactive `gh auth login --web` flow.
 *
 * Hands stdio to the terminal so the user can complete the browser-based
 * OAuth flow without leaving gubbi.
 *
 * @returns `true` if the login succeeded.
 */
export async function loginWeb(): Promise<boolean> {
	const exitCode = await execInteractive(GH, ["auth", "login", "--web"])
	return exitCode === 0
}
