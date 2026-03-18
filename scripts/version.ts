/**
 * scripts/version.ts — Synchronize npm package versions across all gubbi npm packages
 *
 * Usage:
 *   bun run scripts/version.ts 1.2.3
 *
 * Updates:
 *   - app/npm/gubbi/package.json             (main package + optionalDependencies)
 *   - app/npm/gubbi-darwin-arm64/package.json
 *   - app/npm/gubbi-darwin-x64/package.json
 *   - app/npm/gubbi-linux-arm64/package.json
 *   - app/npm/gubbi-linux-x64/package.json
 */

const version = process.argv[2]

if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
	console.error("Usage: bun run scripts/version.ts <version>")
	console.error("Example: bun run scripts/version.ts 1.0.0")
	process.exit(1)
}

const repoRoot = import.meta.dir.replace(/\/scripts$/, "")

const PLATFORM_PKGS = [
	"gubbi-darwin-arm64",
	"gubbi-darwin-x64",
	"gubbi-linux-arm64",
	"gubbi-linux-x64",
]

// Update each platform package
for (const pkg of PLATFORM_PKGS) {
	const pkgPath = `${repoRoot}/app/npm/${pkg}/package.json`
	const pkgJson = await Bun.file(pkgPath).json()
	pkgJson.version = version
	await Bun.write(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n")
	console.log(`Updated ${pkg} → ${version}`)
}

// Update the main gubbi package (version + optionalDependencies)
const mainPkgPath = `${repoRoot}/app/npm/gubbi/package.json`
const mainPkg = await Bun.file(mainPkgPath).json()
mainPkg.version = version
for (const pkg of PLATFORM_PKGS) {
	mainPkg.optionalDependencies[pkg] = version
}
await Bun.write(mainPkgPath, JSON.stringify(mainPkg, null, 2) + "\n")
console.log(`Updated gubbi → ${version}`)

console.log(`\nAll packages set to v${version}`)
