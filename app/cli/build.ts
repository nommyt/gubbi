/**
 * build.ts — Compile gubbi CLI to a standalone executable
 */

import { homedir } from "os"
import { resolve } from "path"
import solidPlugin from "@opentui/solid/bun-plugin"
import { build } from "bun"

const outputDir = "./dist"

// Clean dist directory
await Bun.$`rm -rf ${outputDir}`.quiet()
await Bun.$`mkdir -p ${outputDir}`.quiet()
console.log(`Cleaned ${outputDir}`)

// Build the executable
const result = await build({
  entrypoints: ["src/index.tsx"],
  outdir: outputDir,
  naming: {
    entry: "gubbi",
  },
  target: "bun",
  format: "esm",
  minify: true,
  sourcemap: "inline",
  plugins: [solidPlugin],
})

console.log("Build result:", result)

if (result.success && result.outputs.length > 0) {
  const buildOutput = result.outputs[0]!
  const actualOutputPath = buildOutput.path
  console.log(`Executable built at: ${actualOutputPath}`)

  // Ensure the output file is executable
  await Bun.$`chmod +x ${actualOutputPath}`.quiet()
  console.log("Set executable permission")

  // Copy OpenTUI native modules to dist
  console.log("Copying native modules...")
  const workspaceRoot = resolve(process.cwd(), "../..")
  
  try {
    // Find all OpenTUI packages in the bun cache
    const bunCache = resolve(workspaceRoot, "node_modules/.bun")
    const opentuiPackages = await Bun.$`ls -d ${bunCache}/@opentui+* 2>/dev/null || echo ""`.text()
    
    for (const pkgPath of opentuiPackages.trim().split("\n").filter(Boolean)) {
      if (!pkgPath) continue
      
      const pkgName = pkgPath.split("/").pop()?.replace(/@\d.+$/, "") // Remove version
      if (!pkgName) continue
      
      // Extract the actual package name from @opentui+name@version format
      const match = pkgName.match(/@opentui\+(.+)/)
      if (!match) continue
      
      const fullPkgName = `@opentui/${match[1]}`
      const actualSource = resolve(pkgPath, "node_modules", fullPkgName)
      
      if (await Bun.file(`${actualSource}/package.json`).exists()) {
        const destDir = resolve(outputDir, "node_modules", fullPkgName)
        await Bun.$`mkdir -p ${destDir}`.quiet()
        await Bun.$`cp -r ${actualSource}/* ${destDir}/ 2>/dev/null || true`.quiet()
        console.log(`✓ Copied ${fullPkgName}`)
      }
    }
  } catch (err) {
    console.error("Warning: Could not copy all native modules:", err)
  }

  // Update local bin
  const localBinDir = `${homedir()}/.local/bin`
  const localBinPath = `${localBinDir}/gubbi`

  // Ensure local bin directory exists
  await Bun.$`mkdir -p ${localBinDir}`.quiet()

  // Remove existing symlink or file
  await Bun.$`rm -f ${localBinPath}`.quiet()

  // Create new symlink
  try {
    await Bun.$`ln -s ${actualOutputPath} ${localBinPath}`.quiet()
    console.log(`Updated local bin: ${localBinPath} -> ${actualOutputPath}`)
  } catch (error) {
    console.error("Failed to update local bin:", error)
    process.exit(1)
  }
} else {
  console.error("Build failed or no outputs generated")
  process.exit(1)
}
