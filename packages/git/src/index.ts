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
export { parseDiff, hunkToPatch } from "./hunk-parser.ts"
export type { DiffHunk, ParsedDiff } from "./hunk-parser.ts"

// Stack management
export * from "./stack.ts"

// Services
export { createGitService, gitService } from "./service.ts"
export type { GitService } from "./service.ts"
