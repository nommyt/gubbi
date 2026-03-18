#!/usr/bin/env bun
/**
 * build.ts — Compile gubbi to a standalone executable and update local bin
 */

import { homedir } from "os"

import solidPlugin from "@opentui/solid/bun-plugin"
import { build } from "bun"

const outputDir = "./dist"
const outputName = "gubbi"
const outputPath = `${outputDir}/${outputName}`

// Clean dist directory
await Bun.$`rm -rf ${outputDir}`.quiet()
await Bun.$`mkdir -p ${outputDir}`.quiet()
console.log(`Cleaned ${outputDir}`)

const result = await build({
	entrypoints: ["src/index.tsx"],
	outdir: outputDir,
	naming: {
		entry: "gubbi", // Output as "gubbi" (no extension)
	},
	target: "bun",
	format: "esm",
	minify: true, // Minify for smaller binary size
	sourcemap: "inline", // Or "none" if not needed
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
