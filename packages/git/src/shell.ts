/**
 * shell.ts — Subprocess execution helper using Bun.spawn
 */

export interface ExecResult {
	stdout: string
	stderr: string
	exitCode: number
}

export interface ExecOptions {
	cwd?: string
	timeout?: number
	env?: Record<string, string>
	input?: string
}

export class ShellError extends Error {
	constructor(
		public command: string,
		public exitCode: number,
		public stderr: string,
	) {
		super(`Command "${command}" failed (exit ${exitCode}): ${stderr.trim()}`)
		this.name = "ShellError"
	}
}

const DEFAULT_TIMEOUT = 30_000

export async function exec(
	cmd: string,
	args: string[],
	opts: ExecOptions = {},
): Promise<ExecResult> {
	const { cwd = process.cwd(), timeout = DEFAULT_TIMEOUT, env, input } = opts

	const proc = Bun.spawn([cmd, ...args], {
		cwd,
		env: env ? { ...process.env, ...env } : process.env,
		stdin: input !== undefined ? new TextEncoder().encode(input) : "ignore",
		stdout: "pipe",
		stderr: "pipe",
	})

	const timer = timeout > 0 ? setTimeout(() => proc.kill(), timeout) : null

	try {
		const [stdoutBuf, stderrBuf] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		])
		const exitCode = await proc.exited

		return { stdout: stdoutBuf, stderr: stderrBuf, exitCode }
	} finally {
		if (timer) clearTimeout(timer)
	}
}

/** Like exec() but throws ShellError on non-zero exit */
export async function execOrThrow(
	cmd: string,
	args: string[],
	opts: ExecOptions = {},
): Promise<string> {
	const result = await exec(cmd, args, opts)
	if (result.exitCode !== 0) {
		throw new ShellError(`${cmd} ${args.join(" ")}`, result.exitCode, result.stderr)
	}
	return result.stdout
}

/** Quick check if a command is available on PATH */
export async function commandExists(name: string): Promise<boolean> {
	try {
		const r = await exec("which", [name], { timeout: 2000 })
		return r.exitCode === 0
	} catch {
		return false
	}
}

/**
 * Run an interactive command with stdin/stdout/stderr inherited from the
 * current process (required for commands like `gh auth login --web` that
 * prompt for user input or open a browser flow).
 */
export async function execInteractive(
	cmd: string,
	args: string[],
	opts: Pick<ExecOptions, "cwd"> = {},
): Promise<number> {
	const { cwd = process.cwd() } = opts

	const proc = Bun.spawn([cmd, ...args], {
		cwd,
		env: process.env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	})

	return proc.exited
}
