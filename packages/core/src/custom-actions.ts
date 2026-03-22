/**
 * custom-actions.ts — Execute custom actions defined in config.yaml
 *
 * Config format:
 *   actions:
 *     - name: "Mark Ready"
 *       key: "R"
 *       command: "gh pr ready $PR_NUMBER"
 *     - name: "Auto-merge"
 *       key: "A"
 *       commands:
 *         - "gh pr review $PR_NUMBER --approve"
 *         - "gh pr merge $PR_NUMBER --auto --squash"
 */

import { loadConfig } from "./config.ts"
import { showToast } from "./state/index.ts"

export interface CustomAction {
	name: string
	key: string
	command?: string
	commands?: string[]
}

/**
 * Get all custom actions from config.
 */
export function getCustomActions(): CustomAction[] {
	const config = loadConfig()
	return config.actions ?? []
}

/**
 * Execute a custom action with variable substitution.
 * Variables: $PR_NUMBER, $BRANCH, $REPO
 */
export async function executeAction(
	action: CustomAction,
	context: { prNumber?: number; branch?: string; repo?: string },
): Promise<boolean> {
	const commands = action.commands ?? (action.command ? [action.command] : [])

	for (const cmd of commands) {
		const resolved = cmd
			.replace(/\$PR_NUMBER/g, String(context.prNumber ?? ""))
			.replace(/\$BRANCH/g, context.branch ?? "")
			.replace(/\$REPO/g, context.repo ?? "")

		try {
			// Use shell to execute the command
			const proc = Bun.spawn(["sh", "-c", resolved], {
				stdout: "pipe",
				stderr: "pipe",
			})
			const exitCode = await proc.exited
			if (exitCode !== 0) {
				const stderr = await new Response(proc.stderr).text()
				showToast("error", `Action "${action.name}" failed: ${stderr}`)
				return false
			}
		} catch (err) {
			showToast("error", `Action "${action.name}" failed: ${String(err)}`)
			return false
		}
	}

	showToast("success", `Executed: ${action.name}`)
	return true
}
