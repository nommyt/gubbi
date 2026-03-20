/**
 * @gubbi/github — GitHub CLI operations and API wrappers
 */

export * from "./gh.ts"
export { createGitHubService, githubService } from "./service.ts"
export type { GitHubService } from "./service.ts"
export {
	getCurrentBranchPR,
	getPRForBranch,
	canMergePR,
	pushAndCreatePR,
	checkoutPRBranch,
} from "./bridge.ts"
