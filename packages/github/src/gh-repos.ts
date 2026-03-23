/**
 * gh-repos.ts — Repository operations via the `gh` CLI.
 *
 * List the authenticated user's repos, search public repos, fetch
 * trending repositories, and retrieve metadata for the current repo.
 */

import { exec } from "@gubbi/git"

const GH = "gh"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A repository owned by or accessible to the authenticated user. */
export interface UserRepo {
	/** Short repository name (e.g. `"gubbi"`). */
	name: string
	/** Full `owner/repo` name. */
	fullName: string
	/** ISO-8601 timestamp of the last push. */
	pushedAt: string
	/** Whether the repository is private. */
	isPrivate: boolean
	/** Whether the repository is a fork. */
	isFork: boolean
	/** Total number of stargazers. */
	stargazerCount: number
	/** Web URL for the repository. */
	url: string
	/** Latest commit on the default branch, or `null` if unavailable. */
	latestCommit: {
		/** First line of the commit message. */
		message: string
		/** Commit author name. */
		author: string
		/** ISO-8601 commit date. */
		date: string
	} | null
}

/** Metadata for the current (local) repository. */
export interface RepoInfo {
	/** Short repository name. */
	name: string
	/** Owner login. */
	owner: string
	/** Full `owner/repo` name. */
	fullName: string
	/** Repository description. */
	description: string
	/** Name of the default branch (e.g. `"main"`). */
	defaultBranch: string
	/** Whether the repository is private. */
	isPrivate: boolean
	/** Total number of stargazers. */
	stargazerCount: number
	/** Total number of forks. */
	forkCount: number
	/** Web URL for the repository. */
	url: string
}

/** A repository returned by search/trending queries. */
export interface ExploreRepo {
	/** Full `owner/repo` name. */
	fullName: string
	/** Short repository name. */
	name: string
	/** Owner login. */
	owner: string
	/** Repository description. */
	description: string
	/** Primary programming language. */
	language: string
	/** Total number of stars. */
	stars: number
	/** Total number of forks. */
	forks: number
	/** Web URL for the repository. */
	url: string
	/** ISO-8601 last-update timestamp. */
	updatedAt: string
	/** Whether the repository is private. */
	isPrivate: boolean
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SEARCH_REPO_FIELDS = [
	"name",
	"fullName",
	"owner",
	"description",
	"language",
	"stargazersCount",
	"forksCount",
	"url",
	"updatedAt",
	"isPrivate",
].join(",")

function mapExploreRepo(raw: Record<string, unknown>): ExploreRepo {
	const lang = (raw.language as string | null | undefined) ?? ""
	const owner =
		typeof raw.owner === "object" && raw.owner !== null
			? (((raw.owner as Record<string, unknown>).login as string | null | undefined) ?? "")
			: ""

	return {
		fullName:
			(raw.fullName as string | null | undefined) ??
			(raw.nameWithOwner as string | null | undefined) ??
			"",
		name: (raw.name as string | null | undefined) ?? "",
		owner,
		description: (raw.description as string | null | undefined) ?? "",
		language: lang,
		stars: Number(raw.stargazersCount ?? 0),
		forks: Number(raw.forksCount ?? 0),
		url: (raw.url as string | null | undefined) ?? "",
		updatedAt: (raw.updatedAt as string | null | undefined) ?? "",
		isPrivate: Boolean(raw.isPrivate),
	}
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List the authenticated user's repositories, ordered by most recently pushed.
 *
 * Uses the GitHub GraphQL API to also fetch the latest commit on the default branch.
 *
 * @param opts.limit - Maximum results (default: 30).
 * @returns Array of {@link UserRepo}, or `[]` on failure.
 */
export async function listUserRepos(opts: { limit?: number } = {}): Promise<UserRepo[]> {
	const limit = opts.limit ?? 30
	const query = `{
		viewer {
			repositories(first: ${limit}, orderBy: {field: PUSHED_AT, direction: DESC}) {
				nodes {
					name
					nameWithOwner
					pushedAt
					isPrivate
					isFork
					stargazerCount
					url
					defaultBranchRef {
						target {
							... on Commit {
								message
								committedDate
								author { name }
							}
						}
					}
				}
			}
		}
	}`

	const r = await exec(GH, ["api", "graphql", "-f", `query=${query}`])
	if (r.exitCode !== 0) return []
	try {
		type GQLRepo = {
			name: string
			nameWithOwner: string
			pushedAt: string
			isPrivate: boolean
			isFork: boolean
			stargazerCount: number
			url: string
			defaultBranchRef: {
				target: { message: string; committedDate: string; author: { name: string } } | null
			} | null
		}
		const parsed = JSON.parse(r.stdout) as {
			data: { viewer: { repositories: { nodes: GQLRepo[] } } }
		}
		const nodes = parsed.data?.viewer?.repositories?.nodes ?? []
		return nodes.map((raw) => {
			const target = raw.defaultBranchRef?.target
			return {
				name: raw.name,
				fullName: raw.nameWithOwner,
				pushedAt: raw.pushedAt,
				isPrivate: raw.isPrivate,
				isFork: raw.isFork,
				stargazerCount: raw.stargazerCount,
				url: raw.url,
				latestCommit: target
					? {
							// Only the first line of the commit message
							message: target.message.split("\n")[0] ?? "",
							author: target.author?.name ?? "",
							date: target.committedDate,
						}
					: null,
			}
		})
	} catch {
		return []
	}
}

/**
 * Search public repositories by query string.
 *
 * @param query         - Free-text search query.
 * @param opts.sort     - Sort order (default: best-match).
 * @param opts.limit    - Maximum results (default: 30).
 * @param opts.language - Filter by primary language.
 * @param opts.stars    - Stars filter (e.g. `">100"`).
 * @returns Array of {@link ExploreRepo}, or `[]` on failure.
 */
export async function searchRepos(
	query: string,
	opts: {
		sort?: "stars" | "updated" | "forks" | "best-match"
		limit?: number
		language?: string
		stars?: string
	} = {},
): Promise<ExploreRepo[]> {
	const args = [
		"search",
		"repos",
		query,
		"--json",
		SEARCH_REPO_FIELDS,
		"--limit",
		String(opts.limit ?? 30),
	]
	if (opts.sort) args.push("--sort", opts.sort)
	if (opts.language) args.push("--language", opts.language)
	if (opts.stars) args.push("--stars", opts.stars)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapExploreRepo)
	} catch {
		return []
	}
}

/**
 * Fetch trending repositories using a star-count + date heuristic.
 *
 * Searches for repos with >100 stars that have been updated within
 * the given time window, sorted by stars descending.
 *
 * @param opts.since    - Time window: `"daily"`, `"weekly"` (default), or `"monthly"`.
 * @param opts.limit    - Maximum results (default: 30).
 * @param opts.language - Filter by primary language.
 * @returns Array of {@link ExploreRepo}, or `[]` on failure.
 */
export async function fetchTrendingRepos(
	opts: {
		since?: "daily" | "weekly" | "monthly"
		limit?: number
		language?: string
	} = {},
): Promise<ExploreRepo[]> {
	const since = opts.since ?? "weekly"
	const now = new Date()

	let daysBack: number
	switch (since) {
		case "daily":
			daysBack = 1
			break
		case "weekly":
			daysBack = 7
			break
		case "monthly":
			daysBack = 30
			break
	}

	const sinceDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
	const dateStr = sinceDate.toISOString().split("T")[0]

	const args = [
		"search",
		"repos",
		"",
		"--json",
		SEARCH_REPO_FIELDS,
		"--sort",
		"stars",
		"--limit",
		String(opts.limit ?? 30),
		"--stars",
		">100",
		"--updated",
		`>${dateStr}`,
	]
	if (opts.language) args.push("--language", opts.language)

	const r = await exec(GH, args)
	if (r.exitCode !== 0) return []
	try {
		const data = JSON.parse(r.stdout) as unknown[]
		return (data as Record<string, unknown>[]).map(mapExploreRepo)
	} catch {
		return []
	}
}

/**
 * Fetch metadata for the current (local) repository.
 * @returns A {@link RepoInfo} object, or `null` if the repo can't be resolved.
 */
export async function getRepoInfo(): Promise<RepoInfo | null> {
	const r = await exec(GH, [
		"repo",
		"view",
		"--json",
		"name,owner,nameWithOwner,description,defaultBranchRef,isPrivate,stargazerCount,forkCount,url",
	])
	if (r.exitCode !== 0) return null
	try {
		const raw = JSON.parse(r.stdout) as Record<string, unknown>
		return {
			name: (raw.name as string | null | undefined) ?? "",
			owner: ((raw.owner as Record<string, unknown>)?.login as string | null | undefined) ?? "",
			fullName: (raw.nameWithOwner as string | null | undefined) ?? "",
			description: (raw.description as string | null | undefined) ?? "",
			defaultBranch:
				((raw.defaultBranchRef as Record<string, unknown>)?.name as string | null | undefined) ??
				"main",
			isPrivate: Boolean(raw.isPrivate),
			stargazerCount: Number(raw.stargazerCount ?? 0),
			forkCount: Number(raw.forkCount ?? 0),
			url: (raw.url as string | null | undefined) ?? "",
		}
	} catch {
		return null
	}
}
