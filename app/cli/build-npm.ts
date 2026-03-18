/**
 * build-npm.ts — Build platform-specific binaries for npm publishing
 *
 * Produces standalone Bun executables for each supported platform using
 * `bun build --compile`. The outputs land in app/npm/<pkg>/bin/gubbi.
 *
 * Supported targets (matching Bun's target strings):
 *   bun-darwin-arm64
 *   bun-darwin-x64
 *   bun-linux-arm64
 *   bun-linux-x64
 *
 * Usage:
 *   bun run build-npm.ts                  # all platforms
 *   bun run build-npm.ts darwin-arm64     # single platform
 */

import { resolve } from "path"

const PLATFORMS = [
	{ target: "bun-darwin-arm64", pkg: "gubbi-darwin-arm64" },
	{ target: "bun-darwin-x64", pkg: "gubbi-darwin-x64" },
	{ target: "bun-linux-arm64", pkg: "gubbi-linux-arm64" },
	{ target: "bun-linux-x64", pkg: "gubbi-linux-x64" },
]

const cliDir = import.meta.dir
const repoRoot = resolve(cliDir, "../..")
const npmDir = resolve(cliDir, "../npm")

// Allow filtering to a single platform via CLI arg
const filter = process.argv[2] // e.g. "darwin-arm64"
const targets = filter ? PLATFORMS.filter((p) => p.target.endsWith(filter)) : PLATFORMS

if (targets.length === 0) {
	console.error(`No matching platform for filter: ${filter}`)
	console.error(`Available: ${PLATFORMS.map((p) => p.target.replace("bun-", "")).join(", ")}`)
	process.exit(1)
}

console.log(`Building for ${targets.map((t) => t.target).join(", ")}...`)

for (const { target, pkg } of targets) {
	const outDir = resolve(npmDir, pkg, "bin")
	const outBin = resolve(outDir, "gubbi")

	await Bun.$`mkdir -p ${outDir}`.quiet()

	console.log(`\n[${target}] Building → ${outBin}`)

	const result = await Bun.spawnSync(
		[
			"bun",
			"build",
			"--compile",
			`--target=${target}`,
			"--minify",
			"--sourcemap=none",
			`--outfile=${outBin}`,
			"src/index.tsx",
		],
		{
			cwd: cliDir,
			env: {
				...process.env,
				// Ensure Bun can find workspace packages
				BUN_INSTALL: resolve(repoRoot, "node_modules/.bun"),
			},
			stdout: "inherit",
			stderr: "inherit",
		},
	)

	if (result.exitCode !== 0) {
		console.error(`[${target}] Build failed with exit code ${result.exitCode}`)
		process.exit(result.exitCode ?? 1)
	}

	// Ensure binary is executable
	await Bun.$`chmod +x ${outBin}`.quiet()
	console.log(`[${target}] ✓ Built ${outBin}`)
}

console.log("\nAll builds complete.")
