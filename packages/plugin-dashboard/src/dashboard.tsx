/**
 * dashboard.tsx — GitHub dashboard: my PRs, tagged items, repos, notifications
 *
 * Caching strategy:
 *   - Module-level `cache`  object persists across component remounts.
 *   - `loading` is only true on the very first render when there is no cached data.
 *   - Manual refresh (r) and background polling both update data silently — the
 *     cached values stay visible while the fetch is in-flight.
 *
 * Polling intervals — adjust POLL below to tune refresh cadence.
 */

import { state, showToast, useInterval, icons } from "@gubbi/core"
import {
	searchMyOpenPRs,
	listPRs,
	listIssues,
	listUserRepos,
	listNotifications,
	type SearchPR,
	type PullRequest,
	type Issue,
	type Notification,
	type UserRepo,
} from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

// ---------------------------------------------------------------------------
// Polling intervals (ms) — single source of truth
// ---------------------------------------------------------------------------

const POLL = {
	notifications: 120_000, // 2m
	tagged: 120_000, // 2m
	myPRs: 120_000, // 2m
	repos: 300_000, // 5m — rarely changes
}

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	prOpen: "#3fb950",
	prDraft: "#8b949e",
	prMerged: "#a371f7",
	prClosed: "#f78166",
	ciPass: "#3fb950",
	ciFail: "#f78166",
	ciPending: "#d29922",
	dim: "#8b949e",
	text: "#e6edf3",
	repo: "#58a6ff",
	author: "#58a6ff",
	private: "#d29922",
	public: "#3fb950",
	fork: "#8b949e",
	notifUnread: "#e6edf3",
	notifRead: "#8b949e",
	issueIcon: "#3fb950",
	prIcon: "#a371f7",
}

// ---------------------------------------------------------------------------
// Module-level cache — survives component remounts
// ---------------------------------------------------------------------------

type TaggedItem = { kind: "pr"; data: PullRequest } | { kind: "issue"; data: Issue }

interface DashboardCache {
	myPRs: SearchPR[]
	tagged: TaggedItem[]
	userRepos: UserRepo[]
	notifications: Notification[]
}

const cache: DashboardCache = {
	myPRs: [],
	tagged: [],
	userRepos: [],
	notifications: [],
}

const hasCached = () =>
	cache.myPRs.length > 0 ||
	cache.tagged.length > 0 ||
	cache.userRepos.length > 0 ||
	cache.notifications.length > 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
	if (!iso) return ""
	const ms = Date.now() - new Date(iso).getTime()
	const s = Math.floor(ms / 1000)
	if (s < 60) return `${s}s`
	const m = Math.floor(s / 60)
	if (m < 60) return `${m}m`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h`
	const d = Math.floor(h / 24)
	if (d < 30) return `${d}d`
	const mo = Math.floor(d / 30)
	if (mo < 12) return `${mo}mo`
	return `${Math.floor(mo / 12)}y`
}

function ciSummary(checks: Array<{ status: string; conclusion: string | null }>): {
	icon: string
	color: string
} {
	if (!checks.length) return { icon: "", color: C.dim }
	const hasFailure = checks.some(
		(c) =>
			c.conclusion === "FAILURE" ||
			c.conclusion === "TIMED_OUT" ||
			c.conclusion === "ACTION_REQUIRED",
	)
	if (hasFailure) return { icon: icons.circleSlash, color: C.ciFail }
	const hasPending = checks.some(
		(c) => c.status === "IN_PROGRESS" || c.status === "QUEUED" || c.conclusion === null,
	)
	if (hasPending) return { icon: icons.sync, color: C.ciPending }
	return { icon: icons.check, color: C.ciPass }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardView() {
	// Seed signals from cache so data is visible immediately on remount
	const [myPRs, setMyPRs] = createSignal<SearchPR[]>(cache.myPRs)
	const [tagged, setTagged] = createSignal<TaggedItem[]>(cache.tagged)
	const [userRepos, setUserRepos] = createSignal<UserRepo[]>(cache.userRepos)
	const [notifications, setNotifications] = createSignal<Notification[]>(cache.notifications)

	// loading = true only when there is genuinely nothing to show yet
	const [loading, setLoading] = createSignal(!hasCached())

	const [selectedColumn, setSelectedColumn] = createSignal<
		"prs" | "tagged" | "repos" | "notifications"
	>("prs")
	const [selectedIdx, setSelectedIdx] = createSignal(0)

	// ------------------------------------------------------------------
	// Fetch functions — each updates its own slice, never touches loading
	// ------------------------------------------------------------------

	async function fetchMyPRs() {
		try {
			const data = await searchMyOpenPRs({ limit: 50 })
			cache.myPRs = data
			setMyPRs(data)
		} catch (err) {
			showToast("error", `PRs: ${err}`)
		}
	}

	async function fetchTagged() {
		try {
			const currentUser = state.github.user
			const [allPRs, mentionedIssues] = await Promise.all([
				listPRs({ state: "open", limit: 100 }),
				listIssues({ state: "open", mention: "@me", limit: 50 }),
			])
			const reviewRequested = allPRs.filter((pr) =>
				pr.reviewers.some((r) => r.login === currentUser && r.state === "PENDING"),
			)
			const data: TaggedItem[] = [
				...reviewRequested.map((pr): TaggedItem => ({ kind: "pr", data: pr })),
				...mentionedIssues.map((issue): TaggedItem => ({ kind: "issue", data: issue })),
			]
			cache.tagged = data
			setTagged(data)
		} catch (err) {
			showToast("error", `Tagged: ${err}`)
		}
	}

	async function fetchRepos() {
		try {
			const data = await listUserRepos({ limit: 30 })
			cache.userRepos = data
			setUserRepos(data)
		} catch (err) {
			showToast("error", `Repos: ${err}`)
		}
	}

	async function fetchNotifications() {
		try {
			const data = await listNotifications({ limit: 50 })
			cache.notifications = data
			setNotifications(data)
		} catch (err) {
			showToast("error", `Notifications: ${err}`)
		}
	}

	// Initial load — runs all fetches in parallel, clears loading when done
	async function initialLoad() {
		await Promise.all([fetchMyPRs(), fetchTagged(), fetchRepos(), fetchNotifications()])
		setLoading(false)
	}

	// Manual refresh — silent (no loading state reset, cache stays visible)
	async function refresh() {
		await Promise.all([fetchMyPRs(), fetchTagged(), fetchRepos(), fetchNotifications()])
	}

	onMount(() => {
		if (!hasCached()) {
			void initialLoad()
		}
		// Data is already in signals from cache seed — no load needed
	})

	// ------------------------------------------------------------------
	// Background polling — cleans up automatically when component unmounts
	// ------------------------------------------------------------------
	useInterval(fetchNotifications, POLL.notifications)
	useInterval(fetchTagged, POLL.tagged)
	useInterval(fetchMyPRs, POLL.myPRs)
	useInterval(fetchRepos, POLL.repos)

	// ------------------------------------------------------------------
	// Keyboard
	// ------------------------------------------------------------------

	const cols = ["prs", "tagged", "repos", "notifications"] as const

	useKeyboard((key) => {
		if (key.name === "r" && !key.ctrl) {
			key.preventDefault()
			void refresh()
			return
		}
		if (key.name === "h" || key.name === "left") {
			key.preventDefault()
			const idx = cols.indexOf(selectedColumn())
			if (idx > 0) {
				setSelectedColumn(cols[idx - 1]!)
				setSelectedIdx(0)
			}
			return
		}
		if (key.name === "l" || key.name === "right") {
			key.preventDefault()
			const idx = cols.indexOf(selectedColumn())
			if (idx < cols.length - 1) {
				setSelectedColumn(cols[idx + 1]!)
				setSelectedIdx(0)
			}
			return
		}
		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			const len = currentColLength()
			if (len > 0) setSelectedIdx((i) => (i + 1) % len)
			return
		}
		if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const len = currentColLength()
			if (len > 0) setSelectedIdx((i) => (i - 1 + len) % len)
			return
		}
		if (key.name === "enter") {
			key.preventDefault()
			const url = getSelectedUrl()
			if (url) Bun.$`open ${url}`.catch(() => {})
			return
		}
	})

	function getSelectedUrl(): string {
		const idx = selectedIdx()
		switch (selectedColumn()) {
			case "prs":
				return myPRs()[idx]?.url ?? ""
			case "tagged":
				return tagged()[idx]?.data.url ?? ""
			case "repos":
				return userRepos()[idx]?.url ?? ""
			case "notifications": {
				const n = notifications()[idx]
				if (!n) return ""
				return n.subject.url
					.replace("api.github.com/repos", "github.com")
					.replace("/pulls/", "/pull/")
			}
		}
	}

	function count(col: (typeof cols)[number]) {
		switch (col) {
			case "prs":
				return myPRs().length
			case "tagged":
				return tagged().length
			case "repos":
				return userRepos().length
			case "notifications":
				return notifications().length
		}
	}

	function currentColLength() {
		return count(selectedColumn())
	}

	// ------------------------------------------------------------------
	// Render
	// ------------------------------------------------------------------

	return (
		<box flexGrow={1} flexDirection="row">
			{/* ── My PRs ── */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "prs" ? C.activeBorder : C.border}
				title="my prs"
			>
				<box padding={1}>
					<text fg={C.text}>My PRs ({count("prs")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={loading()}>
						<box alignItems="center" justifyContent="center" flexGrow={1}>
							<text fg={C.dim}>Loading...</text>
						</box>
					</Show>
					<Show when={!loading()}>
						<For each={myPRs()}>
							{(pr, idx) => {
								const ci = () => ciSummary(pr.checks)
								const isSelected = () => selectedColumn() === "prs" && selectedIdx() === idx()
								return (
									<box
										padding={1}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										flexDirection="column"
									>
										<box flexDirection="row" gap={1}>
											<text fg={pr.isDraft ? C.prDraft : C.prOpen}>
												{pr.isDraft ? icons.circle : icons.check}
											</text>
											<text fg={C.repo}>{pr.repository}</text>
											<box flexGrow={1} />
											<Show when={pr.checks.length > 0}>
												<text fg={ci().color}>{ci().icon}</text>
											</Show>
										</box>
										<box paddingLeft={2}>
											<text fg={C.dim}>#{pr.number} </text>
											<text fg={C.text}>{pr.title}</text>
										</box>
									</box>
								)
							}}
						</For>
						<Show when={myPRs().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No open PRs</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* ── Tagged ── */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "tagged" ? C.activeBorder : C.border}
				title="tagged in"
			>
				<box padding={1}>
					<text fg={C.text}>Tagged ({count("tagged")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={tagged()}>
							{(item, idx) => {
								const isSelected = () => selectedColumn() === "tagged" && selectedIdx() === idx()
								return (
									<box
										padding={1}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										flexDirection="row"
										gap={1}
									>
										<text fg={item.kind === "pr" ? C.prIcon : C.issueIcon}>
											{item.kind === "pr" ? "PR" : "IS"}
										</text>
										<text fg={C.dim}>#{item.data.number}</text>
										<text fg={C.text} flexGrow={1}>
											{item.data.title}
										</text>
									</box>
								)
							}}
						</For>
						<Show when={tagged().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>Nothing tagged</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* ── My Repos ── */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "repos" ? C.activeBorder : C.border}
				title="my repos"
			>
				<box padding={1}>
					<text fg={C.text}>Repos ({count("repos")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={userRepos()}>
							{(repo, idx) => {
								const isSelected = () => selectedColumn() === "repos" && selectedIdx() === idx()
								return (
									<box
										paddingLeft={1}
										paddingRight={1}
										paddingTop={1}
										height={3}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										flexDirection="column"
									>
										<box flexDirection="row" gap={1}>
											<text fg={C.text}>{repo.name}</text>
											<Show when={repo.stargazerCount > 0}>
												<text fg={C.dim}>★{repo.stargazerCount}</text>
											</Show>
											<box flexGrow={1} />
											<Show when={repo.isFork}>
												<text fg={C.fork}>fork</text>
											</Show>
											<text fg={repo.isPrivate ? C.private : C.public}>
												{repo.isPrivate ? "priv" : "pub"}
											</text>
											<text fg={C.dim}>{relativeTime(repo.pushedAt)}</text>
										</box>
										<box flexDirection="row">
											<text fg={C.dim} flexGrow={1}>
												{repo.latestCommit
													? repo.latestCommit.message.length > 24
														? repo.latestCommit.message.slice(0, 24) + "…"
														: repo.latestCommit.message
													: ""}
											</text>
											<Show when={repo.latestCommit}>
												<text fg={C.author}>{repo.latestCommit!.author}</text>
											</Show>
										</box>
									</box>
								)
							}}
						</For>
						<Show when={userRepos().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No repos found</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* ── Notifications ── */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "notifications" ? C.activeBorder : C.border}
				title="notifications"
			>
				<box padding={1}>
					<text fg={C.text}>Notifications ({count("notifications")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={notifications()}>
							{(notif, idx) => {
								const isSelected = () =>
									selectedColumn() === "notifications" && selectedIdx() === idx()
								return (
									<box
										padding={1}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										flexDirection="column"
									>
										<box flexDirection="row" gap={1}>
											<text fg={notif.unread ? C.prOpen : C.dim}>
												{notif.unread ? icons.circleFilled : icons.circle}
											</text>
											<text fg={C.dim}>{notif.subject.type}</text>
											<box flexGrow={1} />
											<text fg={C.dim}>{relativeTime(notif.updatedAt)}</text>
										</box>
										<box paddingLeft={2}>
											<text fg={notif.unread ? C.notifUnread : C.notifRead}>
												{notif.subject.title}
											</text>
										</box>
									</box>
								)
							}}
						</For>
						<Show when={notifications().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No notifications</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>
		</box>
	)
}
