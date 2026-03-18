#!/usr/bin/env bun
/**
 * scripts/symlink.ts — Create symlink in ~/.local/bin
 */

import { homedir } from "os"

const localBinDir = `${homedir()}/.local/bin`
const localBinPath = `${localBinDir}/gubbi`
const targetPath = `${process.cwd()}/dist/gubbi`

// Ensure local bin directory exists
await Bun.$`mkdir -p ${localBinDir}`.quiet()

// Remove existing symlink or file
await Bun.$`rm -f ${localBinPath}`.quiet()

// Create new symlink
try {
  await Bun.$`ln -s ${targetPath} ${localBinPath}`.quiet()
  console.log(`Symlinked: ${localBinPath} -> ${targetPath}`)
} catch (error) {
  console.error("Failed to create symlink:", error)
  process.exit(1)
}
