/**
 * @gubbi/git — Git operations and utilities
 */

// Shell execution
export { exec, execOrThrow, execInteractive, commandExists, openURL, ShellError } from "./shell.ts"
export type { ExecResult, ExecOptions } from "./shell.ts"

// Git command wrappers
export * from "./git.ts"

// Parsers
export * from "./parser.ts"
export { parseDiff, hunkToPatch, lineToPatch } from "./hunk-parser.ts"
export type { DiffHunk, ParsedDiff } from "./hunk-parser.ts"

// Stack management
export * from "./stack.ts"

// Repo scanning
export {
	scanRepos,
	findLocalClone,
	getOrScanRepoMap,
	saveRepoMap,
	loadRepoMap,
	normalizeRemoteToFullName,
} from "./repo-scan.ts"
export type { RepoMap } from "./repo-scan.ts"

// Services
export { createGitService, gitService } from "./service.ts"
export type { GitService } from "./service.ts"
