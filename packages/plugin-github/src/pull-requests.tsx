/**
 * pull-requests.tsx — GitHub PRs: list, detail, create, review, merge, diff
 */

import { state, setState, showToast, setView } from "@gubbi/core"
import { openURL } from "@gubbi/git"
import {
	listPRs,
	getPRDiff,
	mergePR,
	reviewPR,
	closePR,
	checkoutPR,
	githubService,
	type PullRequest,
} from "@gubbi/github"
import { SelectDialog, InputDialog, ConfirmDialog } from "@gubbi/tui"
import { DiffViewer } from "@gubbi/tui"
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
	ciPass: "#3fb950",
	ciFail: "#f78166",
	ciPending: "#d29922",
	author: "#58a6ff",
	dim: "#8b949e",
	text: "#e6edf3",
	label: "#d29922",
}

function prStateColor(pr: PullRequest): string {
	if (pr.isDraft) return C.prDraft
	if (pr.state === "MERGED") return C.prMerged
	if (pr.state === "CLOSED") return C.prClosed
	return C.prOpen
}

function prStateIcon(pr: PullRequest): string {
	if (pr.isDraft) return "◌"
	if (pr.state === "MERGED") return "●"
	if (pr.state === "CLOSED") return "✗"
	return "○"
}

function checksIcon(pr: PullRequest): { icon: string; color: string } {
	const checks = pr.checks
	if (checks.length === 0) return { icon: "", color: C.dim }
	if (checks.some((c) => c.conclusion === "FAILURE")) return { icon: "✗", color: C.ciFail }
	if (checks.some((c) => c.status === "IN_PROGRESS" || c.status === "QUEUED"))
		return { icon: "●", color: C.ciPending }
	if (checks.every((c) => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED"))
		return { icon: "✓", color: C.ciPass }
	return { icon: "○", color: C.dim }
}

export function PullRequestsView() {
	const [prs, setPRs] = createSignal<PullRequest[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [diffContent, setDiffContent] = createSignal("")
	const [loading, setLoading] = createSignal(true)
	const [showMerge, setShowMerge] = createSignal(false)
	const [showReview, setShowReview] = createSignal(false)
	const [showComment, setShowComment] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)
	const [viewMode, setViewMode] = createSignal<"list" | "diff">("list")

	const selectedPR = () => prs()[selectedIdx()]

	async function loadPRs() {
		setLoading(true)
		try {
			const list = await listPRs({ state: "open", limit: 50 })
			setPRs(list)
			const first = list[0]
			if (first) await loadDiff(first)
		} catch (err) {
			showToast("error", `Failed to load PRs: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadDiff(pr: PullRequest) {
		try {
			const diff = await getPRDiff(pr.number)
			setDiffContent(diff)
		} catch {
			setDiffContent("")
		}
	}

	onMount(() => void loadPRs())

	useKeyboard(async (key) => {
		if (showMerge() || showReview() || showComment()) return

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			return
		}
		if (!primaryFocused()) return

		const pr = selectedPR()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			const next = Math.min(selectedIdx() + 1, prs().length - 1)
			setSelectedIdx(next)
			const p = prs()[next]
			if (p) await loadDiff(p)
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const prev = Math.max(selectedIdx() - 1, 0)
			setSelectedIdx(prev)
			const p = prs()[prev]
			if (p) await loadDiff(p)
		} else if (key.name === "enter" && pr) {
			key.preventDefault()
			setViewMode((m) => (m === "list" ? "diff" : "list"))
		} else if (key.name === "m" && pr && pr.state === "OPEN") {
			key.preventDefault()
			setShowMerge(true)
		} else if (key.name === "a" && pr) {
			key.preventDefault()
			setShowReview(true)
		} else if (key.name === "c" && pr) {
			key.preventDefault()
			setShowComment(true)
		} else if (key.name === "o" && pr) {
			key.preventDefault()
			await openURL(pr.url)
		} else if (key.name === "C" && key.shift && pr) {
			// Checkout PR branch
			key.preventDefault()
			try {
				await checkoutPR(pr.number)
				showToast("success", `Checked out ${pr.headRefName} → Switch to Status (2)`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "b" && pr) {
			// Jump to branches view
			key.preventDefault()
			setView("branches")
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadPRs()
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* PR list */}
			<box
				width={50}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.activeBorder : C.border}
				title="pull requests"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading PRs...</text>
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
							<For each={prs()}>
								{(pr, i) => {
									const isSelected = () => selectedIdx() === i()
									const ci = checksIcon(pr)

									return (
										<box
											flexDirection="column"
											paddingLeft={1}
											paddingRight={1}
											paddingTop={1}
											backgroundColor={isSelected() ? C.selected : "transparent"}
											onMouseDown={() => {
												setSelectedIdx(i())
												void loadDiff(pr)
												setPrimaryFocused(true)
											}}
										>
											<box flexDirection="row" gap={1}>
												<text fg={prStateColor(pr)}>{prStateIcon(pr)}</text>
												<text fg={C.dim}>#{pr.number}</text>
												<text fg={isSelected() ? "#e6edf3" : C.text}>{pr.title}</text>
												<box flexGrow={1} />
												<Show when={ci.icon}>
													<text fg={ci.color}>{ci.icon}</text>
												</Show>
											</box>

											<box flexDirection="row" gap={1} paddingLeft={2}>
												<text fg={C.author}>{pr.author}</text>
												<text fg={C.dim}>→ {pr.baseRefName}</text>
												<text fg={C.dim}>
													+{pr.additions} -{pr.deletions}
												</text>
												<Show when={state.git.branches.some((b) => b.name === pr.headRefName)}>
													<text fg={C.dim}>⎇ local</text>
												</Show>
												<For each={pr.labels.slice(0, 3)}>
													{(label) => <text fg={C.label}>[{label}]</text>}
												</For>
											</box>
										</box>
									)
								}}
							</For>

							<Show when={prs().length === 0 && !loading()}>
								<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
									<text fg={C.dim}>No open pull requests</text>
								</box>
							</Show>
						</scrollbox>
					</Show>
				</Show>

				{/* Footer */}
				<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
					<text fg={C.dim}>
						<span style={{ fg: "#58a6ff" }}>m</span> merge ·{" "}
						<span style={{ fg: "#58a6ff" }}>a</span> approve ·{" "}
						<span style={{ fg: "#58a6ff" }}>c</span> comment ·{" "}
						<span style={{ fg: "#58a6ff" }}>C</span> checkout ·{" "}
						<span style={{ fg: "#58a6ff" }}>b</span> branches ·{" "}
						<span style={{ fg: "#58a6ff" }}>o</span> open
					</text>
				</box>
			</box>

			{/* PR diff */}
			<DiffViewer
				content={diffContent()}
				title={selectedPR() ? `PR #${selectedPR()!.number}: ${selectedPR()!.title}` : "pr diff"}
			/>

			{/* Merge dialog */}
			<Show when={showMerge() && selectedPR()}>
				<SelectDialog
					title={`Merge PR #${selectedPR()?.number}`}
					options={[
						{ label: "Merge commit", description: "Create a merge commit", value: "merge" },
						{ label: "Squash and merge", description: "Squash commits and merge", value: "squash" },
						{ label: "Rebase and merge", description: "Rebase commits and merge", value: "rebase" },
					]}
					onSelect={async (method: string) => {
						setShowMerge(false)
						const pr = selectedPR()
						if (!pr) return
						try {
							await mergePR(pr.number, method as "merge" | "squash" | "rebase", {
								deleteAfterMerge: true,
							})
							await loadPRs()
							showToast("success", `Merged PR #${pr.number}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowMerge(false)}
				/>
			</Show>

			{/* Review dialog */}
			<Show when={showReview()}>
				<SelectDialog
					title="Submit review"
					options={[
						{ label: "Approve", description: "Approve the PR", value: "approve" },
						{
							label: "Request changes",
							description: "Request changes to the PR",
							value: "request-changes",
						},
						{ label: "Comment", description: "Leave a general comment", value: "comment" },
					]}
					onSelect={async (action: string) => {
						setShowReview(false)
						const pr = selectedPR()
						if (!pr) return
						try {
							await reviewPR(pr.number, action as "approve" | "request-changes" | "comment")
							showToast("success", `Review submitted for PR #${pr.number}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowReview(false)}
				/>
			</Show>

			{/* Comment dialog */}
			<Show when={showComment()}>
				<InputDialog
					title={`Comment on PR #${selectedPR()?.number}`}
					placeholder="Leave a comment..."
					multiline
					onSubmit={async (body) => {
						setShowComment(false)
						const pr = selectedPR()
						if (!pr) return
						try {
							const { commentOnPR } = await import("@gubbi/github")
							await commentOnPR(pr.number, body)
							showToast("success", "Comment posted")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowComment(false)}
				/>
			</Show>
		</box>
	)
}
