#!/usr/bin/env node
/**
 * install.js — postinstall script for the `gubbi` npm package
 *
 * Resolves the correct platform-specific binary package and copies or symlinks
 * it into ./bin/gubbi so that npm's bin wiring works correctly.
 *
 * Pattern used by: esbuild, @biomejs/biome, turbo, etc.
 */

"use strict"

const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const platform = os.platform() // "darwin" | "linux" | "win32"
const arch = os.arch() // "arm64" | "x64"

/** Map Node.js platform/arch to our npm package names */
function getPlatformPackage() {
	if (platform === "darwin" && arch === "arm64") return "gubbi-darwin-arm64"
	if (platform === "darwin" && arch === "x64") return "gubbi-darwin-x64"
	if (platform === "linux" && arch === "arm64") return "gubbi-linux-arm64"
	if (platform === "linux" && arch === "x64") return "gubbi-linux-x64"
	return null
}

const pkgName = getPlatformPackage()

if (!pkgName) {
	console.warn(
		`gubbi: unsupported platform ${platform}/${arch}. ` +
			`Please open an issue at https://github.com/nommyt/gubbi/issues`,
	)
	process.exit(0)
}

// ---------------------------------------------------------------------------
// Locate the platform binary
// ---------------------------------------------------------------------------

let platformBinPath

try {
	// Resolve the platform package relative to this package's node_modules
	const pkgJsonPath = require.resolve(`${pkgName}/package.json`)
	const pkgDir = path.dirname(pkgJsonPath)
	platformBinPath = path.join(pkgDir, "bin", "gubbi")
} catch {
	// The optional dependency wasn't installed (wrong platform or skipped)
	console.warn(
		`gubbi: could not find optional dependency ${pkgName}. ` +
			`This is expected if you are on an unsupported platform.`,
	)
	process.exit(0)
}

if (!fs.existsSync(platformBinPath)) {
	console.warn(
		`gubbi: binary not found at ${platformBinPath}. ` +
			`The package may be missing its binary — please reinstall or report at https://github.com/nommyt/gubbi/issues`,
	)
	process.exit(0)
}

// ---------------------------------------------------------------------------
// Install the binary into ./bin/gubbi
// ---------------------------------------------------------------------------

const binDir = path.join(__dirname, "bin")
const binPath = path.join(binDir, "gubbi")

if (!fs.existsSync(binDir)) {
	fs.mkdirSync(binDir, { recursive: true })
}

// Remove any existing file or symlink
try {
	fs.unlinkSync(binPath)
} catch {
	// File doesn't exist — that's fine
}

try {
	fs.symlinkSync(platformBinPath, binPath)
} catch {
	// If symlinking fails (e.g. on some CI environments), copy instead
	fs.copyFileSync(platformBinPath, binPath)
}

// Ensure the binary is executable
try {
	fs.chmodSync(binPath, 0o755)
} catch {
	// Best effort — may fail on Windows
}

console.log(`gubbi: installed ${pkgName} binary`)
