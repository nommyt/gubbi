/**
 * explore.tsx — Explore view: My Repos, Trending, Search
 */

import { setView, showToast, setInputActive, useTheme, relativeTime } from "@gubbi/core"
import { InputDialog, SelectDialog, KeyHints } from "@gubbi/core/tui"
import { openURL, findLocalClone, getOrScanRepoMap, saveRepoMap, gitService } from "@gubbi/git"
import { exec } from "@gubbi/git"
import {
	listUserRepos,
	fetchTrendingRepos,
	searchRepos,
	type ExploreRepo,
	type UserRepo,
} from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "my-repos" | "trending" | "search"
type TrendingSince = "daily" | "weekly" | "monthly"

interface FlatRepo {
	fullName: string
	name: string
	description: string
	language: string
	stars: number
	url: string
	updatedAt: string
	isPrivate: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStars(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const exploreCache: Record<Tab, { data: FlatRepo[]; ts: number }> = {
	"my-repos": { data: [], ts: 0 },
	trending: { data: [], ts: 0 },
	search: { data: [], ts: 0 },
}

const trendingCache: Record<TrendingSince, { data: FlatRepo[]; ts: number }> = {
	daily: { data: [], ts: 0 },
	weekly: { data: [], ts: 0 },
	monthly: { data: [], ts: 0 },
}

function getCached(cache: { data: FlatRepo[]; ts: number }): FlatRepo[] | null {
	if (cache.data.length > 0 && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data
	return null
}

function setCache(cache: { data: FlatRepo[]; ts: number }, data: FlatRepo[]) {
	cache.data = data
	cache.ts = Date.now()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExploreView() {
	const t = useTheme()
	const [activeTab, setActiveTab] = createSignal<Tab>("my-repos")
	const [repos, setRepos] = createSignal<FlatRepo[]>(getCached(exploreCache["my-repos"]) ?? [])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [loading, setLoading] = createSignal(false)
	const [repoMap, setRepoMap] = createSignal<Record<string, string>>({})
	const [showCloneDialog, setShowCloneDialog] = createSignal(false)
	const [cloneTargetPath, setCloneTargetPath] = createSignal("")
	const [cloneRepoFullName, setCloneRepoFullName] = createSignal("")
	const [cloneRepoUrl, setCloneRepoUrl] = createSignal("")
	const [searchQuery, setSearchQuery] = createSignal("")
	const [searchActive, setSearchActive] = createSignal(false)
	const [trendingSince, setTrendingSince] = createSignal<TrendingSince>("weekly")
	const [focusPanel, setFocusPanel] = createSignal<"list" | "detail">("list")
	const [showLanguageFilter, setShowLanguageFilter] = createSignal(false)

	const selectedRepo = () => repos()[selectedIdx()]

	// -------------------------------------------------------------------------
	// Data loading
	// -------------------------------------------------------------------------

	function toFlatExplore(repos: UserRepo[]): FlatRepo[] {
		return repos.map((r) => ({
			fullName: r.fullName,
			name: r.name,
			description: r.latestCommit?.message ?? "",
			language: "",
			stars: r.stargazerCount,
			url: r.url,
			updatedAt: r.pushedAt,
			isPrivate: r.isPrivate,
		}))
	}

	function toFlat(exploreRepos: ExploreRepo[]): FlatRepo[] {
		return exploreRepos.map((r) => ({
			fullName: r.fullName,
			name: r.name,
			description: r.description,
			language: r.language,
			stars: r.stars,
			url: r.url,
			updatedAt: r.updatedAt,
			isPrivate: r.isPrivate,
		}))
	}

	async function loadMyRepos() {
		const cached = getCached(exploreCache["my-repos"])
		if (cached) {
			setRepos(cached)
			return
		}
		setLoading(true)
		try {
			const data = await listUserRepos({ limit: 50 })
			const flat = toFlatExplore(data)
			setCache(exploreCache["my-repos"], flat)
			setRepos(flat)
		} catch (err) {
			showToast("error", `Failed to load repos: ${String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadTrending(since: TrendingSince = trendingSince()) {
		const cached = getCached(trendingCache[since])
		if (cached) {
			setRepos(cached)
			return
		}
		setLoading(true)
		try {
			const data = await fetchTrendingRepos({ since, limit: 30 })
			const flat = toFlat(data)
			setCache(trendingCache[since], flat)
			setRepos(flat)
		} catch (err) {
			showToast("error", `Failed to load trending: ${String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	async function doSearch(query: string) {
		if (!query.trim()) return
		setLoading(true)
		try {
			const data = await searchRepos(query, { sort: "best-match", limit: 30 })
			const flat = toFlat(data)
			setCache(exploreCache.search, flat)
			setRepos(flat)
		} catch (err) {
			showToast("error", `Search failed: ${String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	async function switchTab(tab: Tab) {
		setActiveTab(tab)
		setSelectedIdx(0)
		switch (tab) {
			case "my-repos":
				await loadMyRepos()
				break
			case "trending":
				await loadTrending()
				break
			case "search":
				const cached = getCached(exploreCache.search)
				if (cached) setRepos(cached)
				else setRepos([])
				break
		}
	}

	// -------------------------------------------------------------------------
	// Mount
	// -------------------------------------------------------------------------

	onMount(() => {
		void loadMyRepos()
		void (async () => {
			const map = await getOrScanRepoMap()
			setRepoMap(map)
		})()
	})

	// -------------------------------------------------------------------------
	// Clone handler
	// -------------------------------------------------------------------------

	function handleCloneOrSwitch() {
		const repo = selectedRepo()
		if (!repo) return

		const localPath = findLocalClone(repo.fullName, repoMap())

		if (localPath) {
			void (async () => {
				showToast("info", `Opening ${repo.name}...`)
				await gitService.initializeWithRoot(localPath)
				await gitService.refreshStatus()
				await gitService.refreshLog()
				await gitService.refreshBranches()
				setView("status")
				showToast("success", `Switched to ${repo.name}`)
			})()
		} else {
			setCloneRepoFullName(repo.fullName)
			setCloneRepoUrl(repo.url)
			setCloneTargetPath(process.cwd())
			setShowCloneDialog(true)
		}
	}

	async function handleCloneSubmit(path: string) {
		const fullName = cloneRepoFullName()
		const url = cloneRepoUrl()
		if (!path || !fullName) return

		setShowCloneDialog(false)
		showToast("info", `Cloning ${fullName}...`)

		try {
			const expandedPath = path.startsWith("~") ? process.env.HOME + path.slice(1) : path
			const cloneDir = `${expandedPath}/${fullName.split("/").pop()}`

			const result = await exec("git", ["clone", url, cloneDir], { timeout: 120_000 })
			if (result.exitCode !== 0) {
				throw new Error(result.stderr)
			}

			// Update repo map
			const map = { ...repoMap() }
			map[fullName] = cloneDir
			saveRepoMap(map)
			setRepoMap(map)

			await gitService.initializeWithRoot(cloneDir)
			await gitService.refreshStatus()
			await gitService.refreshLog()
			await gitService.refreshBranches()
			setView("status")
			showToast("success", `Cloned and switched to ${fullName}`)
		} catch (err) {
			showToast("error", `Clone failed: ${String(err)}`)
		}
	}

	// -------------------------------------------------------------------------
	// Keyboard
	// -------------------------------------------------------------------------

	useKeyboard((key) => {
		if (showCloneDialog() || showLanguageFilter()) return

		if (searchActive()) {
			// When search input is focused, handle Esc to close
			if (key.name === "escape") {
				key.preventDefault()
				setSearchActive(false)
				setInputActive(false)
			}
			return
		}

		if (key.name === "m") {
			key.preventDefault()
			void switchTab("my-repos")
			return
		}
		if (key.name === "t") {
			key.preventDefault()
			void switchTab("trending")
			return
		}
		if (key.name === "/" || key.name === "slash") {
			key.preventDefault()
			setSearchActive(true)
			setInputActive(true)
			return
		}

		const len = repos().length

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			if (len > 0) setSelectedIdx((i) => (i + 1) % len)
			return
		}
		if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			if (len > 0) setSelectedIdx((i) => (i - 1 + len) % len)
			return
		}

		if (key.name === "c") {
			key.preventDefault()
			handleCloneOrSwitch()
			return
		}
		if (key.name === "o" || key.name === "return") {
			key.preventDefault()
			const repo = selectedRepo()
			if (repo) void openURL(repo.url)
			return
		}
		if (key.name === "f") {
			key.preventDefault()
			setShowLanguageFilter(true)
			return
		}

		// Trending sub-filters: d/w/m
		if (activeTab() === "trending") {
			if (key.name === "d") {
				key.preventDefault()
				setTrendingSince("daily")
				setSelectedIdx(0)
				void loadTrending("daily")
				return
			}
			if (key.name === "w") {
				key.preventDefault()
				setTrendingSince("weekly")
				setSelectedIdx(0)
				void loadTrending("weekly")
				return
			}
			if (key.name === "m") {
				key.preventDefault()
				setTrendingSince("monthly")
				setSelectedIdx(0)
				void loadTrending("monthly")
				return
			}
		}

		if (key.ctrl && key.name === "r") {
			key.preventDefault()
			// Clear current tab cache and reload
			if (activeTab() === "my-repos") {
				exploreCache["my-repos"] = { data: [], ts: 0 }
				void loadMyRepos()
			} else if (activeTab() === "trending") {
				const since = trendingSince()
				trendingCache[since] = { data: [], ts: 0 }
				void loadTrending(since)
			} else {
				exploreCache.search = { data: [], ts: 0 }
				if (searchQuery()) void doSearch(searchQuery())
			}
			return
		}

		if (key.name === "tab") {
			key.preventDefault()
			setFocusPanel((p) => (p === "list" ? "detail" : "list"))
			return
		}
	})

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	const languages = ["JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "C++", "Ruby"]

	const tabLabel = () => {
		switch (activeTab()) {
			case "my-repos":
				return "My Repos"
			case "trending":
				return `Trending (${trendingSince()})`
			case "search":
				return searchQuery() ? `Search: ${searchQuery()}` : "Search"
		}
	}

	const hasLocalClone = (fullName: string) => !!findLocalClone(fullName, repoMap())

	return (
		<box flexGrow={1} flexDirection="row">
			{/* ── List panel ── */}
			<box
				width="45%"
				flexDirection="column"
				border
				borderColor={focusPanel() === "list" ? t.borderFocused : t.border}
				title={tabLabel()}
			>
				{/* Tab indicators */}
				<box flexDirection="row" height={1} paddingLeft={1} gap={2}>
					<text fg={activeTab() === "my-repos" ? t.text : t.textSecondary}>
						<span style={{ fg: t.accent }}>m</span>y repos
					</text>
					<text fg={activeTab() === "trending" ? t.text : t.textSecondary}>
						<span style={{ fg: t.accent }}>t</span>rending
					</text>
					<text fg={activeTab() === "search" ? t.text : t.textSecondary}>
						<span style={{ fg: t.accent }}>/</span>search
					</text>
					{/* Trending sub-filter indicator */}
					<Show when={activeTab() === "trending"}>
						<text fg={t.textSecondary}>
							{trendingSince() === "daily"
								? "[d]aily"
								: trendingSince() === "weekly"
									? "[w]eekly"
									: "[m]onthly"}
						</text>
					</Show>
				</box>

				{/* Search input (shown when search tab is active) */}
				<Show when={searchActive()}>
					<box border borderColor={t.borderFocused} height={3} paddingLeft={1}>
						<text fg={t.text}>Search: </text>
						<input
							focused
							placeholder="Type to search repos..."
							onSubmit={
								((v: string) => {
									setSearchActive(false)
									setInputActive(false)
									if (v.trim()) {
										setSearchQuery(v.trim())
										setActiveTab("search")
										setSelectedIdx(0)
										void doSearch(v.trim())
									}
								}) as unknown as () => void
							}
						/>
					</box>
				</Show>

				{/* Repo list */}
				<box flexGrow={1} overflow="hidden">
					<Show
						when={!loading()}
						fallback={
							<box flexGrow={1} alignItems="center" justifyContent="center">
								<text fg={t.textSecondary}>Loading...</text>
							</box>
						}
					>
						<For each={repos()}>
							{(repo, idx) => {
								const isSelected = () => selectedIdx() === idx()
								return (
									<box
										paddingLeft={1}
										paddingRight={1}
										paddingTop={1}
										backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
										flexDirection="column"
									>
										<box flexDirection="row" gap={1}>
											<text fg={t.warning}>★</text>
											<text fg={isSelected() ? t.text : t.accent}>{repo.fullName}</text>
											<Show when={repo.stars > 0}>
												<text fg={t.textSecondary}>{formatStars(repo.stars)}</text>
											</Show>
											<box flexGrow={1} />
											<Show when={repo.language}>
												<text fg={t.accent}>{repo.language}</text>
											</Show>
											<text fg={t.textSecondary}>
												{relativeTime(repo.updatedAt, { compact: true })}
											</text>
										</box>
										<box flexDirection="row" paddingLeft={2} gap={1}>
											<text fg={t.textSecondary} flexGrow={1}>
												{repo.description.length > 40
													? repo.description.slice(0, 40) + "…"
													: repo.description}
											</text>
											<Show when={hasLocalClone(repo.fullName)}>
												<text fg={t.success}>local</text>
											</Show>
										</box>
									</box>
								)
							}}
						</For>
						<Show when={repos().length === 0 && !loading()}>
							<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
								<text fg={t.textSecondary}>
									{activeTab() === "search" ? "Press / to search" : "No repos found"}
								</text>
							</box>
						</Show>
					</Show>
				</box>

				{/* Keybinding hint bar */}
				<KeyHints
					hints={[
						{ key: "c", label: "clone" },
						{ key: "o", label: "open" },
						{ key: "f", label: "filter" },
						{ key: "/", label: "search" },
					]}
				/>
			</box>

			{/* ── Detail panel ── */}
			<box
				flexGrow={1}
				flexDirection="column"
				border
				borderColor={focusPanel() === "detail" ? t.borderFocused : t.border}
				title={selectedRepo()?.fullName ?? "select a repo"}
			>
				<Show when={selectedRepo()}>
					<box flexDirection="column" padding={1} gap={1}>
						<text fg={t.text}>{selectedRepo()?.fullName}</text>
						<text fg={t.textSecondary}>{selectedRepo()?.description || "(no description)"}</text>

						{/* Stats */}
						<box flexDirection="row" gap={2} paddingTop={1}>
							<text>
								<span style={{ fg: t.warning }}>★ </span>
								<span style={{ fg: t.text }}>{formatStars(selectedRepo()?.stars ?? 0)}</span>
							</text>
							<Show when={selectedRepo()?.language}>
								<text>
									<span style={{ fg: t.accent }}>{selectedRepo()?.language}</span>
								</text>
							</Show>
							<text>
								<span style={{ fg: t.textSecondary }}>updated </span>
								<span style={{ fg: t.text }}>
									{relativeTime(selectedRepo()?.updatedAt ?? "", { compact: true })}
								</span>
							</text>
						</box>

						{/* Local clone status */}
						<box paddingTop={1}>
							{(() => {
								const localPath = findLocalClone(selectedRepo()?.fullName ?? "", repoMap())
								if (localPath) {
									return (
										<text>
											<span style={{ fg: t.success }}>Local clone: </span>
											<span style={{ fg: t.text }}>{localPath}</span>
										</text>
									)
								}
								return <text fg={t.textSecondary}>Not cloned locally</text>
							})()}
						</box>
					</box>
				</Show>
			</box>

			{/* ── Clone dialog ── */}
			<Show when={showCloneDialog()}>
				<InputDialog
					title={`Clone ${cloneRepoFullName()} to:`}
					initialValue={cloneTargetPath()}
					onSubmit={handleCloneSubmit}
					onCancel={() => setShowCloneDialog(false)}
				/>
			</Show>

			{/* ── Language filter dialog ── */}
			<Show when={showLanguageFilter()}>
				<SelectDialog
					title="Filter by language"
					options={languages.map((l) => ({ label: l, value: l }))}
					onSelect={async (lang) => {
						setShowLanguageFilter(false)
						if (activeTab() === "trending") {
							setLoading(true)
							try {
								const data = await fetchTrendingRepos({
									since: trendingSince(),
									limit: 30,
									language: lang,
								})
								const flat = toFlat(data)
								setRepos(flat)
								setSelectedIdx(0)
							} catch (err) {
								showToast("error", String(err))
							} finally {
								setLoading(false)
							}
						} else if (activeTab() === "search" && searchQuery()) {
							setLoading(true)
							try {
								const data = await searchRepos(searchQuery(), {
									sort: "best-match",
									limit: 30,
									language: lang,
								})
								const flat = toFlat(data)
								setRepos(flat)
								setSelectedIdx(0)
							} catch (err) {
								showToast("error", String(err))
							} finally {
								setLoading(false)
							}
						}
					}}
					onCancel={() => setShowLanguageFilter(false)}
				/>
			</Show>
		</box>
	)
}
