/**
 * issues.tsx — GitHub issues: list, detail, create, comment
 */

import { state, showToast } from "@gubbi/core"
import { exec } from "@gubbi/git"
import {
	listIssues,
	getIssueComments,
	commentOnIssue,
	closeIssue,
	reopenIssue,
	type Issue,
	type IssueComment,
} from "@gubbi/github"
import { InputDialog, ConfirmDialog } from "@gubbi/ui"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	open: "#3fb950",
	closed: "#f78166",
	author: "#58a6ff",
	label: "#d29922",
	dim: "#8b949e",
	text: "#e6edf3",
	comment: "#e6edf3",
	commentBorder: "#30363d",
}

export function IssuesView() {
	const [issues, setIssues] = createSignal<Issue[]>([])
	const [comments, setComments] = createSignal<IssueComment[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [loading, setLoading] = createSignal(true)
	const [showCreate, setShowCreate] = createSignal(false)
	const [showComment, setShowComment] = createSignal(false)
	const [showClose, setShowClose] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)

	const selectedIssue = () => issues()[selectedIdx()]

	async function loadIssues() {
		setLoading(true)
		try {
			const list = await listIssues({ state: "open", limit: 50 })
			setIssues(list)
			const first = list[0]
			if (first) await loadComments(first)
		} catch (err) {
			showToast("error", `Failed to load issues: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadComments(issue: Issue) {
		try {
			const c = await getIssueComments(issue.number)
			setComments(c)
		} catch {
			setComments([])
		}
	}

	onMount(() => void loadIssues())

	useKeyboard(async (key) => {
		if (showCreate() || showComment() || showClose()) return

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			return
		}
		if (!primaryFocused()) return

		const issue = selectedIssue()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			const next = Math.min(selectedIdx() + 1, issues().length - 1)
			setSelectedIdx(next)
			const i = issues()[next]
			if (i) await loadComments(i)
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const prev = Math.max(selectedIdx() - 1, 0)
			setSelectedIdx(prev)
			const i = issues()[prev]
			if (i) await loadComments(i)
		} else if (key.name === "n") {
			key.preventDefault()
			setShowCreate(true)
		} else if (key.name === "c" && issue) {
			key.preventDefault()
			setShowComment(true)
		} else if (key.name === "x" && issue) {
			key.preventDefault()
			setShowClose(true)
		} else if (key.name === "o" && issue) {
			key.preventDefault()
			await exec("open", [issue.url])
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadIssues()
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* Issues list */}
			<box
				width={48}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.activeBorder : C.border}
				title="issues"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading issues...</text>
						</box>
					}
				>
					<Show
						when={state.github.isAuthenticated}
						fallback={
							<box flexGrow={1} alignItems="center" justifyContent="center" gap={1}>
								<text fg={C.dim}>GitHub not authenticated</text>
								<text fg={C.dim}>Run: gh auth login</text>
							</box>
						}
					>
						<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
							<For each={issues()}>
								{(issue, i) => {
									const isSelected = () => selectedIdx() === i()
									return (
										<box
											flexDirection="column"
											paddingLeft={1}
											paddingRight={1}
											paddingTop={1}
											backgroundColor={isSelected() ? C.selected : "transparent"}
											onMouseDown={() => {
												setSelectedIdx(i())
												void loadComments(issue)
												setPrimaryFocused(true)
											}}
										>
											<box flexDirection="row" gap={1}>
												<text fg={issue.state === "OPEN" ? C.open : C.closed}>
													{issue.state === "OPEN" ? "○" : "●"}
												</text>
												<text fg={C.dim}>#{issue.number}</text>
												<text fg={isSelected() ? "#e6edf3" : C.text}>{issue.title}</text>
												<box flexGrow={1} />
												<Show when={issue.comments > 0}>
													<text fg={C.dim}>💬{issue.comments}</text>
												</Show>
											</box>
											<box flexDirection="row" paddingLeft={2} gap={1}>
												<text fg={C.author}>{issue.author}</text>
												<For each={issue.labels.slice(0, 3)}>
													{(label) => <text fg={C.label}>[{label}]</text>}
												</For>
											</box>
										</box>
									)
								}}
							</For>
							<Show when={issues().length === 0 && !loading()}>
								<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
									<text fg={C.dim}>No open issues</text>
								</box>
							</Show>
						</scrollbox>
					</Show>
				</Show>

				<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
					<text fg={C.dim}>
						<span style={{ fg: "#58a6ff" }}>n</span> new · <span style={{ fg: "#58a6ff" }}>c</span>{" "}
						comment · <span style={{ fg: "#58a6ff" }}>x</span> close ·{" "}
						<span style={{ fg: "#58a6ff" }}>o</span> open
					</text>
				</box>
			</box>

			{/* Issue detail */}
			<box
				flexGrow={1}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.border : C.activeBorder}
				title={
					selectedIssue()
						? `#${selectedIssue()!.number}: ${selectedIssue()!.title}`
						: "issue detail"
				}
			>
				<Show when={selectedIssue()}>
					<scrollbox
						flexGrow={1}
						scrollbarOptions={{ visible: true }}
						paddingLeft={1}
						paddingRight={1}
						paddingTop={1}
					>
						{/* Issue body */}
						<text fg={C.text}>{selectedIssue()?.body || "(no description)"}</text>

						{/* Comments */}
						<Show when={comments().length > 0}>
							<box paddingTop={1}>
								<text fg={C.dim}>
									── {comments().length} comment{comments().length !== 1 ? "s" : ""} ──
								</text>
							</box>
							<For each={comments()}>
								{(comment) => (
									<box
										flexDirection="column"
										paddingTop={1}
										paddingLeft={1}
										border={["left"]}
										borderColor={C.commentBorder}
										marginTop={1}
									>
										<text fg={C.author}>{comment.author}</text>
										<text fg={C.comment}>{comment.body}</text>
									</box>
								)}
							</For>
						</Show>
					</scrollbox>
				</Show>
			</box>

			{/* Dialogs */}
			<Show when={showComment()}>
				<InputDialog
					title={`Comment on #${selectedIssue()?.number}`}
					placeholder="Leave a comment..."
					multiline
					onSubmit={async (body) => {
						setShowComment(false)
						const issue = selectedIssue()
						if (!issue) return
						try {
							await commentOnIssue(issue.number, body)
							await loadComments(issue)
							showToast("success", "Comment posted")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowComment(false)}
				/>
			</Show>

			<Show when={showClose()}>
				<ConfirmDialog
					title={`Close issue #${selectedIssue()?.number}`}
					message={`Close "${selectedIssue()?.title}"?`}
					onConfirm={async () => {
						setShowClose(false)
						const issue = selectedIssue()
						if (!issue) return
						try {
							await closeIssue(issue.number)
							await loadIssues()
							showToast("success", `Closed issue #${issue.number}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowClose(false)}
				/>
			</Show>
		</box>
	)
}
