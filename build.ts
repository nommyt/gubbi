#!/usr/bin/env bun
/**
 * build.ts — Compile gubbi to a standalone executable
 */

import { build } from "bun"

const result = await build({
	entrypoints: ["src/index.tsx"],
	outdir: "./dist",
	target: "bun", // or "node", "browser", "bun"
	format: "esm",
	minify: false,
	sourcemap: "inline",
})

console.log("Build result:", result)
console.log("Executable at: ./dist/index.mjs")
