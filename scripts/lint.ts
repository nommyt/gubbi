import { spawnSync } from "node:child_process"

import { Glob } from "bun"

const glob = new Glob("**/*.{ts,tsx,js,jsx}")
const files = [...glob.scanSync(".")]

const extraArgs = process.argv.slice(2)
const result = spawnSync("oxlint", [...extraArgs, ...files], { stdio: "inherit" })
process.exit(result.status ?? 1)
