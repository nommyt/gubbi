/**
 * @gubbi/git — Git operations and utilities
 */

// Shell execution
export { exec, execOrThrow, commandExists, ShellError } from "./shell.ts"
export type { ExecResult, ExecOptions } from "./shell.ts"

// Git command wrappers
export * from "./git.ts"

// Parsers
export * from "./parser.ts"

// Stack management
export * from "./stack.ts"

// Services
export { createGitService, gitService } from "./service.ts"
export type { GitService } from "./service.ts"
