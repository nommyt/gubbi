/**
 * dashboard.tsx — GitHub dashboard: PRs, issues, notifications
 * Shows a column view of PRs user was tagged in, user's open PRs, assigned issues, and notifications
 */

import { state, setState, showToast } from "@gubbi/core"
// import { refreshGhData } from "@gubbi/github"
import {
	listPRs,
	listIssues,
	listNotifications,
	type PullRequest,
	type Issue,
	type Notification,
} from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	prOpen: "#3fb950",
	prDraft: "#8b949e",
	prMerged: "#a371f7",
	prClosed: "#f78166",
	open: "#3fb950",
	closed: "#f78166",
	author: "#58a6ff",
	dim: "#8b949e",
	text: "#e6edf3",
	label: "#d29922",
}

export function DashboardView() {
	const [myPRs, setMyPRs] = createSignal<PullRequest[]>([])
	const [reviewRequestedPRs, setReviewRequestedPRs] = createSignal<PullRequest[]>([])
	const [myIssues, setMyIssues] = createSignal<Issue[]>([])
	const [notifications, setNotifications] = createSignal<Notification[]>([])
	const [loading, setLoading] = createSignal(true)
	const [selectedColumn, setSelectedColumn] = createSignal<
		"prs" | "review" | "issues" | "notifications"
	>("prs")
	const [selectedIdx, setSelectedIdx] = createSignal(0)

	async function loadDashboard() {
		setLoading(true)
		try {
			const [allPRs, allIssues, allNotifications] = await Promise.all([
				listPRs({ state: "open", limit: 100 }),
				listIssues({ state: "open", limit: 100 }),
				listNotifications({ limit: 50 }),
			])

			const currentUser = state.github.user

			// Filter PRs where user is author
			const myPRsList = allPRs.filter((pr) => pr.author === currentUser)
			setMyPRs(myPRsList)

			// Filter PRs where user is requested as reviewer
			const reviewRequested = allPRs.filter((pr) =>
				pr.reviewers.some((r) => r.login === currentUser && r.state === "PENDING"),
			)
			setReviewRequestedPRs(reviewRequested)

			// Filter issues assigned to user
			// Note: Issue type doesn't have assignees field in current schema, will filter later if needed
			setMyIssues(allIssues)

			// Set notifications
			setNotifications(allNotifications)
		} catch (err) {
			showToast("error", `Failed to load dashboard: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	onMount(() => void loadDashboard())

	useKeyboard((key) => {
		if (key.name === "r" && !key.ctrl) {
			key.preventDefault()
			void loadDashboard()
			return
		}

		// Column navigation
		if (key.name === "h" || key.name === "left") {
			key.preventDefault()
			const cols: ("prs" | "review" | "issues" | "notifications")[] = [
				"prs",
				"review",
				"issues",
				"notifications",
			]
			const idx = cols.indexOf(selectedColumn())
			if (idx > 0) {
				const newCol = cols[idx - 1]
				if (newCol) {
					setSelectedColumn(newCol)
					setSelectedIdx(0)
				}
			}
			return
		}

		if (key.name === "l" || key.name === "right") {
			key.preventDefault()
			const cols: ("prs" | "review" | "issues" | "notifications")[] = [
				"prs",
				"review",
				"issues",
				"notifications",
			]
			const idx = cols.indexOf(selectedColumn())
			if (idx < cols.length - 1) {
				const newCol = cols[idx + 1]
				if (newCol) {
					setSelectedColumn(newCol)
					setSelectedIdx(0)
				}
			}
			return
		}

		// Item navigation
		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			const currentList = getCurrentList()
			if (currentList.length > 0) {
				setSelectedIdx((idx) => (idx + 1) % currentList.length)
			}
			return
		}

		if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const currentList = getCurrentList()
			if (currentList.length > 0) {
				setSelectedIdx((idx) => (idx - 1 + currentList.length) % currentList.length)
			}
			return
		}

		// Open item
		if (key.name === "enter") {
			key.preventDefault()
			const currentList = getCurrentList()
			const item = currentList[selectedIdx()]
			if (item) {
				if ("url" in item) {
					// Open in browser
					Bun.$`open ${item.url}`.catch(() => {})
				}
			}
			return
		}
	})

	function getCurrentList() {
		switch (selectedColumn()) {
			case "prs":
				return myPRs()
			case "review":
				return reviewRequestedPRs()
			case "issues":
				return myIssues()
			case "notifications":
				return notifications()
		}
	}

	function getColumnCount(column: "prs" | "review" | "issues" | "notifications") {
		switch (column) {
			case "prs":
				return myPRs().length
			case "review":
				return reviewRequestedPRs().length
			case "issues":
				return myIssues().length
			case "notifications":
				return notifications().length
		}
	}

	return (
		<box flexGrow={1} flexDirection="row">
			{/* PRs Column */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "prs" ? C.activeBorder : C.border}
				title="my prs"
			>
				<box padding={1}>
					<text fg={C.text}>My PRs ({getColumnCount("prs")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={loading()}>
						<box alignItems="center" justifyContent="center" flexGrow={1}>
							<text fg={C.dim}>Loading...</text>
						</box>
					</Show>
					<Show when={!loading()}>
						<For each={myPRs()}>
							{(pr, idx) => (
								<box
									padding={1}
									backgroundColor={
										selectedColumn() === "prs" && selectedIdx() === idx()
											? C.selected
											: "transparent"
									}
									flexDirection="row"
								>
									<text fg={pr.isDraft ? C.prDraft : C.prOpen} marginRight={1}>
										{pr.isDraft ? "◌" : "○"}
									</text>
									<text fg={C.text} flexGrow={1}>
										#{pr.number} {pr.title}
									</text>
								</box>
							)}
						</For>
						<Show when={myPRs().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No open PRs</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* Review Requested Column */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "review" ? C.activeBorder : C.border}
				title="review requested"
			>
				<box padding={1}>
					<text fg={C.text}>Review Requested ({getColumnCount("review")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={reviewRequestedPRs()}>
							{(pr, idx) => (
								<box
									padding={1}
									backgroundColor={
										selectedColumn() === "review" && selectedIdx() === idx()
											? C.selected
											: "transparent"
									}
									flexDirection="row"
								>
									<text fg={pr.isDraft ? C.prDraft : C.prOpen} marginRight={1}>
										{pr.isDraft ? "◌" : "○"}
									</text>
									<text fg={C.text} flexGrow={1}>
										#{pr.number} {pr.title}
									</text>
								</box>
							)}
						</For>
						<Show when={reviewRequestedPRs().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No review requests</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* Issues Column */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "issues" ? C.activeBorder : C.border}
				title="open issues"
			>
				<box padding={1}>
					<text fg={C.text}>Open Issues ({getColumnCount("issues")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={myIssues()}>
							{(issue, idx) => (
								<box
									padding={1}
									backgroundColor={
										selectedColumn() === "issues" && selectedIdx() === idx()
											? C.selected
											: "transparent"
									}
									flexDirection="row"
								>
									<text fg={C.open} marginRight={1}>
										○
									</text>
									<text fg={C.text} flexGrow={1}>
										#{issue.number} {issue.title}
									</text>
								</box>
							)}
						</For>
						<Show when={myIssues().length === 0}>
							<box padding={1}>
								<text fg={C.dim}>No open issues</text>
							</box>
						</Show>
					</Show>
				</box>
			</box>

			{/* Notifications Column */}
			<box
				width="25%"
				flexDirection="column"
				border
				borderColor={selectedColumn() === "notifications" ? C.activeBorder : C.border}
				title="notifications"
			>
				<box padding={1}>
					<text fg={C.text}>Notifications ({getColumnCount("notifications")})</text>
				</box>
				<box flexGrow={1} overflow="hidden">
					<Show when={!loading()}>
						<For each={notifications()}>
							{(notif, idx) => (
								<box
									padding={1}
									backgroundColor={
										selectedColumn() === "notifications" && selectedIdx() === idx()
											? C.selected
											: "transparent"
									}
									flexDirection="row"
								>
									<text fg={notif.unread ? C.text : C.dim} marginRight={1}>
										{notif.unread ? "●" : "○"}
									</text>
									<text fg={C.text} flexGrow={1}>
										{notif.subject.title}
									</text>
								</box>
							)}
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
