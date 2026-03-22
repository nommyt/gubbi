/**
 * scripts/release.ts — Unified release script
 *
 * Orchestrates the complete release process:
 *   1. Run pre-publish validation (tests, lint, typecheck)
 *   2. Build all platform binaries
 *   3. Verify binaries and checksums
 *   4. Create and push git tag (triggers CI/CD publish workflow)
 *
 * Usage:
 *   bun run release              # Interactive release
 *   bun run release --dry-run    # Preview without making changes
 *   bun run release --version 1.0.0  # Specify version explicitly
 *
 * Prerequisites:
 *   - Working directory must be clean (no uncommitted changes)
 *   - Must be on main branch
 *   - Version must be bumped (via `bun changeset version`)
 */

import { existsSync, statSync, readFileSync } from "node:fs"
import { resolve } from "path"

const repoRoot = import.meta.dir.replace(/\/scripts$/, "")
const isDryRun = process.argv.includes("--dry-run")
const explicitVersion = process.argv.find((arg) => arg.startsWith("--version="))?.split("=")[1]

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

function warning(message: string) {
	console.log(`⚠️  ${message}`)
}

function step(message: string) {
	console.log(`\n${"=".repeat(60)}`)
	console.log(`📦 ${message}`)
	console.log("=".repeat(60))
}

if (isDryRun) {
	warning("DRY RUN MODE - No changes will be made")
}

// ---------------------------------------------------------------------------
// Step 0: Pre-flight checks
// ---------------------------------------------------------------------------
step("Pre-flight checks")

// Check git status
info("Checking git status...")
const gitStatus = Bun.spawnSync(["git", "status", "--porcelain"], {
	cwd: repoRoot,
	stdout: "pipe",
})

if (gitStatus.stdout.toString().trim()) {
	error("Working directory has uncommitted changes. Commit or stash them first.")
	console.log(gitStatus.stdout.toString())
	process.exit(1)
} else {
	success("Working directory is clean")
}

// Check current branch
const currentBranch = Bun.spawnSync(["git", "branch", "--show-current"], {
	cwd: repoRoot,
	stdout: "pipe",
})
	.stdout.toString()
	.trim()

if (currentBranch !== "main") {
	warning(`You're on branch '${currentBranch}' instead of 'main'`)
	const { createInterface } = await import("readline")
	const readline = createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	const answer = await new Promise<string>((resolve) => {
		readline.question("Continue anyway? (y/N) ", resolve)
	})
	readline.close()
	if (answer.toLowerCase() !== "y") {
		console.log("Release cancelled.")
		process.exit(0)
	}
} else {
	success("On main branch")
}

// Get version from package.json
const mainPkgPath = resolve(repoRoot, "app/npm/gubbi/package.json")
const mainPkg = await Bun.file(mainPkgPath).json()
const version = explicitVersion || mainPkg.version

info(`Release version: ${version}`)

// Check if tag already exists
const tagExists = Bun.spawnSync(["git", "tag", "-l", `v${version}`], {
	cwd: repoRoot,
	stdout: "pipe",
})
	.stdout.toString()
	.trim()

if (tagExists) {
	error(`Tag v${version} already exists. Did you forget to bump the version?`)
	process.exit(1)
} else {
	success(`Tag v${version} is available`)
}

// ---------------------------------------------------------------------------
// Step 1: Run pre-publish validation
// ---------------------------------------------------------------------------
step("Running pre-publish validation")

info("Running validation checks...")
const validation = Bun.spawnSync(["bun", "run", "pre-publish"], {
	cwd: repoRoot,
	stdout: "inherit",
	stderr: "inherit",
})

if (validation.exitCode !== 0) {
	error("Pre-publish validation failed")
	process.exit(1)
}

success("All validation checks passed")

// ---------------------------------------------------------------------------
// Step 2: Build all platform binaries
// ---------------------------------------------------------------------------
step("Building platform binaries")

info("Building binaries for all platforms...")
const build = Bun.spawnSync(["bun", "run", "build:npm"], {
	cwd: repoRoot,
	stdout: "inherit",
	stderr: "inherit",
})

if (build.exitCode !== 0) {
	error("Build failed")
	process.exit(1)
}

success("All platform binaries built successfully")

// ---------------------------------------------------------------------------
// Step 3: Verify binaries and checksums
// ---------------------------------------------------------------------------
step("Verifying binaries and checksums")

const PLATFORMS = ["gubbi-darwin-arm64", "gubbi-darwin-x64", "gubbi-linux-arm64", "gubbi-linux-x64"]

for (const platform of PLATFORMS) {
	const binaryPath = resolve(repoRoot, "app/npm", platform, "bin/gubbi")
	const checksumPath = `${binaryPath}.sha256`

	// Check binary exists
	if (!existsSync(binaryPath)) {
		error(`Binary missing: ${binaryPath}`)
		continue
	}

	// Check binary is executable
	const stats = statSync(binaryPath)
	const isExecutable = (stats.mode & 0o111) !== 0
	if (!isExecutable) {
		error(`Binary not executable: ${binaryPath}`)
		continue
	}

	// Check checksum exists
	if (!existsSync(checksumPath)) {
		error(`Checksum missing: ${checksumPath}`)
		continue
	}

	// Verify checksum
	const expectedChecksum = readFileSync(checksumPath, "utf-8").split(/\s+/)[0]
	const binaryData = readFileSync(binaryPath)
	const { createHash } = await import("node:crypto")
	const hash = createHash("sha256")
	hash.update(binaryData as unknown as Uint8Array)
	const actualChecksum = hash.digest("hex")

	if (expectedChecksum !== actualChecksum) {
		error(`Checksum mismatch for ${platform}`)
		console.log(`  Expected: ${expectedChecksum}`)
		console.log(`  Actual:   ${actualChecksum}`)
		continue
	}

	success(`Verified ${platform} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
}

if (hasErrors) {
	error("Binary verification failed")
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 4: Create and push git tag
// ---------------------------------------------------------------------------
step("Creating git tag")

const tag = `v${version}`

if (isDryRun) {
	info(`[DRY RUN] Would create and push tag: ${tag}`)
	info("[DRY RUN] This would trigger the GitHub Actions publish workflow")
} else {
	info(`Creating tag ${tag}...`)

	const createTag = Bun.spawnSync(["git", "tag", "-a", tag, "-m", `Release ${tag}`], {
		cwd: repoRoot,
		stdout: "inherit",
		stderr: "inherit",
	})

	if (createTag.exitCode !== 0) {
		error("Failed to create git tag")
		process.exit(1)
	}

	success(`Created tag ${tag}`)

	info("Pushing tag to origin...")

	const pushTag = Bun.spawnSync(["git", "push", "origin", tag], {
		cwd: repoRoot,
		stdout: "inherit",
		stderr: "inherit",
	})

	if (pushTag.exitCode !== 0) {
		error("Failed to push tag")
		info("You can manually push the tag with: git push origin " + tag)
		process.exit(1)
	}

	success(`Pushed tag ${tag} to origin`)
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(60))
if (isDryRun) {
	console.log("✅ DRY RUN COMPLETE")
	console.log("\nEverything looks good! Run without --dry-run to publish.")
} else {
	console.log("✅ RELEASE INITIATED")
	console.log(`\nTag ${tag} has been pushed.`)
	console.log("The GitHub Actions workflow will now:")
	console.log("  1. Build platform binaries")
	console.log("  2. Create a GitHub Release")
	console.log("  3. Publish packages to npm")
	console.log("\nMonitor progress at:")
	console.log("  https://github.com/nommyt/gubbi/actions")
}
console.log("=".repeat(60))
