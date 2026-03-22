/**
 * scripts/pre-publish.ts — Pre-publish validation checks
 *
 * Runs comprehensive validation before publishing to npm:
 *   - Verifies all platform binaries exist and are executable
 *   - Ensures package versions are in sync
 *   - Runs tests, linting, and type checking
 *   - Checks git status for uncommitted changes
 *
 * Usage:
 *   bun run scripts/pre-publish.ts
 *   bun run scripts/pre-publish.ts --skip-tests  # Skip test execution
 */

import { existsSync, statSync } from "node:fs"
import { resolve } from "path"

const PLATFORMS = ["gubbi-darwin-arm64", "gubbi-darwin-x64", "gubbi-linux-arm64", "gubbi-linux-x64"]

const repoRoot = import.meta.dir.replace(/\/scripts$/, "")
const skipTests = process.argv.includes("--skip-tests")

let hasErrors = false

function error(message: string) {
	console.error(`❌ ${message}`)
	hasErrors = true
}

function success(message: string) {
	console.log(`✅ ${message}`)
}

function info(message: string) {
	console.log(`ℹ️  ${message}`)
}

// ---------------------------------------------------------------------------
// 1. Check git status
// ---------------------------------------------------------------------------
info("Checking git status...")

const gitStatus = Bun.spawnSync(["git", "status", "--porcelain"], {
	cwd: repoRoot,
	stdout: "pipe",
})

if (gitStatus.stdout.toString().trim()) {
	error("Uncommitted changes detected. Commit or stash changes before publishing.")
	console.log(gitStatus.stdout.toString())
} else {
	success("Git working directory is clean")
}

// ---------------------------------------------------------------------------
// 2. Verify all platform binaries exist and are executable
// ---------------------------------------------------------------------------
info("Verifying platform binaries...")

for (const platform of PLATFORMS) {
	const binaryPath = resolve(repoRoot, "app/npm", platform, "bin/gubbi")

	if (!existsSync(binaryPath)) {
		error(`Binary missing: ${binaryPath}`)
		continue
	}

	const stats = statSync(binaryPath)
	const isExecutable = (stats.mode & 0o111) !== 0

	if (!isExecutable) {
		error(`Binary not executable: ${binaryPath}`)
		continue
	}

	success(`Binary verified: ${platform}`)
}

// ---------------------------------------------------------------------------
// 3. Verify package versions are in sync
// ---------------------------------------------------------------------------
info("Checking package version consistency...")

const mainPkgPath = resolve(repoRoot, "app/npm/gubbi/package.json")
const mainPkg = await Bun.file(mainPkgPath).json()
const mainVersion = mainPkg.version

let versionMismatch = false

for (const platform of PLATFORMS) {
	const pkgPath = resolve(repoRoot, "app/npm", platform, "package.json")
	const pkg = await Bun.file(pkgPath).json()

	if (pkg.version !== mainVersion) {
		error(`Version mismatch: ${platform} has ${pkg.version}, expected ${mainVersion}`)
		versionMismatch = true
		continue
	}

	// Check that main package's optionalDependencies reference the correct version
	const expectedVersion = mainPkg.optionalDependencies?.[platform]
	if (expectedVersion !== mainVersion) {
		error(
			`optionalDependency mismatch: gubbi expects ${platform}@${expectedVersion}, but package is ${pkg.version}`,
		)
		versionMismatch = true
		continue
	}
}

if (!versionMismatch) {
	success(`All packages at version ${mainVersion}`)
}

// ---------------------------------------------------------------------------
// 4. Run type checking
// ---------------------------------------------------------------------------
info("Running type checking...")

const typecheck = Bun.spawnSync(["bun", "run", "typecheck"], {
	cwd: repoRoot,
	stdout: "inherit",
	stderr: "inherit",
})

if (typecheck.exitCode !== 0) {
	error("Type checking failed")
} else {
	success("Type checking passed")
}

// ---------------------------------------------------------------------------
// 5. Run linting
// ---------------------------------------------------------------------------
info("Running linting...")

const lint = Bun.spawnSync(["bun", "run", "lint"], {
	cwd: repoRoot,
	stdout: "inherit",
	stderr: "inherit",
})

if (lint.exitCode !== 0) {
	error("Linting failed")
} else {
	success("Linting passed")
}

// ---------------------------------------------------------------------------
// 6. Run tests (optional)
// ---------------------------------------------------------------------------
if (!skipTests) {
	info("Running tests...")

	const test = Bun.spawnSync(["bun", "run", "test"], {
		cwd: repoRoot,
		stdout: "inherit",
		stderr: "inherit",
	})

	if (test.exitCode !== 0) {
		error("Tests failed")
	} else {
		success("Tests passed")
	}
} else {
	info("Skipping tests (--skip-tests)")
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(60))
if (hasErrors) {
	console.error("❌ Pre-publish validation FAILED")
	console.error("Please fix the errors above before publishing.")
	process.exit(1)
} else {
	console.log("✅ Pre-publish validation PASSED")
	console.log("All checks passed — ready to publish!")
	process.exit(0)
}
