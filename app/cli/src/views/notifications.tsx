/**
 * notifications.tsx — GitHub notifications: triage, filter, mark read, batch ops
 */

import { state, showToast, icons, createQuery } from "@gubbi/core"
import { openURL } from "@gubbi/git"
import {
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	type Notification,
} from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	unread: "#e6edf3",
	read: "#8b949e",
	pr: "#3fb950",
	issue: "#f78166",
	release: "#a371f7",
	other: "#58a6ff",
	dim: "#8b949e",
	repo: "#58a6ff",
}

function typeIcon(type: string): string {
	switch (type) {
		case "PullRequest":
			return icons.pullRequest
		case "Issue":
			return icons.lightbulb
		case "Release":
			return icons.flame
		case "Commit":
			return icons.commit
		default:
			return icons.bell
	}
}

function typeColor(type: string): string {
	switch (type) {
		case "PullRequest":
			return C.pr
		case "Issue":
			return C.issue
		case "Release":
			return C.release
		default:
			return C.other
	}
}

function reasonLabel(reason: string): string {
	switch (reason) {
		case "mention":
			return "mentioned"
		case "review_requested":
			return "review req"
		case "assign":
			return "assigned"
		case "author":
			return "author"
		case "subscribed":
			return "subscribed"
		case "team_mention":
			return "team mention"
		case "comment":
			return "commented"
		case "ci_activity":
			return "CI"
		default:
			return reason
	}
}

export function NotificationsView() {
	const [notifications, setNotifications] = createSignal<Notification[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [showAll, setShowAll] = createSignal(false)

	// Query for notifications with caching and polling
	const notifsQuery = createQuery({
		queryKey: () => ["notifications", { all: showAll() }],
		queryFn: () => listNotifications({ all: showAll(), limit: 50 }),
		staleTime: 60_000,
		refetchInterval: 120_000,
	})

	const selectedNotif = () => notifications()[selectedIdx()]

	async function loadNotifications() {
		try {
			const list = await listNotifications({ all: showAll(), limit: 50 })
			setNotifications(list)
		} catch (err) {
			showToast("error", `Failed to load notifications: ${String(err)}`)
		}
	}

	onMount(() => void loadNotifications())

	useKeyboard(async (key) => {
		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, notifications().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "m") {
			key.preventDefault()
			const notif = selectedNotif()
			if (!notif) return
			try {
				await markNotificationRead(notif.id)
				await loadNotifications()
				showToast("success", "Marked as read")
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "M" && key.shift) {
			key.preventDefault()
			try {
				await markAllNotificationsRead()
				await loadNotifications()
				showToast("success", "All notifications marked as read")
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a") {
			key.preventDefault()
			setShowAll((v) => !v)
			await loadNotifications()
		} else if (key.name === "o") {
			key.preventDefault()
			const notif = selectedNotif()
			if (!notif?.subject.url) return
			// Convert API URL to web URL
			const webUrl = notif.subject.url
				.replace("api.github.com/repos", "github.com")
				.replace("/pulls/", "/pull/")
				.replace("/issues/", "/issues/")
				.replace("/commits/", "/commit/")
			await openURL(webUrl)
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadNotifications()
		}
	})

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			border
			borderColor={C.activeBorder}
			title={showAll() ? "notifications (all)" : "notifications (unread)"}
		>
			<Show
				when={!notifsQuery.isLoading()}
				fallback={
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={C.dim}>Loading notifications...</text>
					</box>
				}
			>
				<Show
					when={state.github.isAuthenticated}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center" gap={1}>
							<text fg={C.dim}>GitHub not authenticated</text>
							<text fg={C.dim}>Install gh and ensure you are logged in</text>
						</box>
					}
				>
					<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
						<For each={notifications()}>
							{(notif, i) => {
								const isSelected = () => selectedIdx() === i()
								return (
									<box
										flexDirection="row"
										paddingLeft={1}
										paddingRight={1}
										paddingTop={1}
										gap={1}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										onMouseDown={() => setSelectedIdx(i())}
									>
										{/* Unread dot */}
										<text fg={notif.unread ? C.unread : C.dim}>
											{notif.unread ? icons.circleFilled : icons.circle}
										</text>

										{/* Type icon */}
										<text fg={typeColor(notif.subject.type)}>{typeIcon(notif.subject.type)}</text>

										{/* Title */}
										<text fg={notif.unread ? C.unread : C.read}>{notif.subject.title}</text>

										<box flexGrow={1} />

										{/* Reason */}
										<text fg={C.dim}>{reasonLabel(notif.reason)}</text>

										{/* Repo */}
										<text fg={C.repo}>{notif.repository.split("/").at(-1)}</text>
									</box>
								)
							}}
						</For>

						<Show when={notifications().length === 0 && !notifsQuery.isLoading()}>
							<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
								<text fg={C.dim}>{showAll() ? "No notifications" : "No unread notifications"}</text>
								<Show when={!showAll()}>
									<text fg={C.dim}>Press a to show all</text>
								</Show>
							</box>
						</Show>
					</scrollbox>
				</Show>
			</Show>

			<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
				<text fg={C.dim}>
					<span style={{ fg: "#58a6ff" }}>m</span> mark read ·{" "}
					<span style={{ fg: "#58a6ff" }}>M</span> mark all ·{" "}
					<span style={{ fg: "#58a6ff" }}>a</span> toggle all ·{" "}
					<span style={{ fg: "#58a6ff" }}>o</span> open
				</text>
			</box>
		</box>
	)
}
