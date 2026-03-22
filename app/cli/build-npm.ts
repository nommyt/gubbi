/**
 * build-npm.ts — Build platform-specific binaries for npm publishing
 *
 * Two-step process per platform:
 *   1. Bundle src/index.tsx → a single JS file using solidPlugin (handles JSX)
 *   2. bun build --compile that JS file → standalone executable for the target platform
 *
 * Supported targets:
 *   bun-darwin-arm64 / bun-darwin-x64 / bun-linux-arm64 / bun-linux-x64
 *
 * Usage (from repo root or app/cli):
 *   bun run build-npm.ts                  # all platforms
 *   bun run build-npm.ts darwin-arm64     # single platform
 */

import { createHash } from "node:crypto"
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "path"

import solidPlugin from "@opentui/solid/bun-plugin"
import { build } from "bun"

const PLATFORMS = [
	{ target: "bun-darwin-arm64", pkg: "gubbi-darwin-arm64" },
	{ target: "bun-darwin-x64", pkg: "gubbi-darwin-x64" },
	{ target: "bun-linux-arm64", pkg: "gubbi-linux-arm64" },
	{ target: "bun-linux-x64", pkg: "gubbi-linux-x64" },
]

const cliDir = import.meta.dir
const npmDir = resolve(cliDir, "../npm")
// Use the same bun binary that's running this script
const bunBin = process.execPath

// Allow filtering to a single platform via CLI arg
const filter = process.argv[2] // e.g. "darwin-arm64"
const targets = filter ? PLATFORMS.filter((p) => p.target.endsWith(filter)) : [...PLATFORMS]

if (targets.length === 0) {
	console.error(`No matching platform for filter: ${filter}`)
	console.error(`Available: ${PLATFORMS.map((p) => p.target.replace("bun-", "")).join(", ")}`)
	process.exit(1)
}

console.log(`Building for ${targets.map((t) => t.target).join(", ")}...`)

// ---------------------------------------------------------------------------
// Step 1: Bundle once with solidPlugin → intermediate JS bundle
// ---------------------------------------------------------------------------
const bundleDir = resolve(cliDir, ".build-npm-tmp")
const bundleFile = resolve(bundleDir, "bundle.js")

mkdirSync(bundleDir, { recursive: true })

console.log("\n[bundle] Bundling with solidPlugin...")

const bundleResult = await build({
	entrypoints: [resolve(cliDir, "src/index.tsx")],
	outdir: bundleDir,
	naming: { entry: "bundle.js" },
	target: "bun",
	format: "esm",
	minify: true,
	sourcemap: "none",
	plugins: [solidPlugin],
})

if (!bundleResult.success) {
	for (const log of bundleResult.logs) {
		console.error(log)
	}
	console.error("[bundle] Bundle step failed")
	process.exit(1)
}

console.log(`[bundle] ✓ Bundle written to ${bundleFile}`)

// ---------------------------------------------------------------------------
// Step 2: Compile the bundle into a standalone executable per platform
// ---------------------------------------------------------------------------
for (const { target, pkg } of targets) {
	const outDir = resolve(npmDir, pkg, "bin")
	const outBin = resolve(outDir, "gubbi")

	mkdirSync(outDir, { recursive: true })

	console.log(`\n[${target}] Compiling → ${outBin}`)

	const result = Bun.spawnSync(
		[bunBin, "build", "--compile", `--target=${target}`, `--outfile=${outBin}`, bundleFile],
		{
			cwd: bundleDir,
			stdout: "inherit",
			stderr: "inherit",
		},
	)

	if (result.exitCode !== 0) {
		console.error(`[${target}] Compile failed with exit code ${result.exitCode}`)
		rmSync(bundleDir, { recursive: true, force: true })
		process.exit(result.exitCode ?? 1)
	}

	await Bun.$`chmod +x ${outBin}`.quiet()

	// Generate SHA256 checksum
	const binaryData = readFileSync(outBin)
	const hash = createHash("sha256")
	hash.update(binaryData as unknown as Uint8Array)
	const checksum = hash.digest("hex")
	const checksumPath = `${outBin}.sha256`
	writeFileSync(checksumPath, `${checksum}  gubbi\n`)

	console.log(`[${target}] ✓ Built ${outBin}`)
	console.log(`[${target}] ✓ SHA256: ${checksum}`)
}

// Clean up intermediate bundle
rmSync(bundleDir, { recursive: true, force: true })

console.log("\nAll builds complete.")
