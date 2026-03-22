/**
 * status.tsx — Git status view: working tree, staging area, and diff preview
 */

import type { GitStatusEntry } from "@gubbi/core"
import {
	state,
	setState,
	setFocus,
	showToast,
	updateToast,
	removeToast,
	toggleFullscreen,
	setView,
	icons,
	recordOperation,
} from "@gubbi/core"
import {
	stageFile,
	unstageFile,
	stageAll,
	unstageAll,
	discardFile,
	getDiff,
	stageHunk,
	unstageHunk,
	parseDiff,
	hunkToPatch,
	lineToPatch,
	gitService,
	getHeadHash,
} from "@gubbi/git"
import { getCurrentBranchPR, pushAndCreatePR, githubService } from "@gubbi/github"
import { ConfirmDialog, InputDialog, DiffViewer, BlameView } from "@gubbi/tui"
import { useKeyboard } from "@opentui/solid"
import { createSignal, Show, For, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	selectedText: "#e6edf3",
	staged: "#3fb950",
	modified: "#d29922",
	deleted: "#f78166",
	untracked: "#8b949e",
	conflict: "#ff7b72",
	dim: "#8b949e",
	text: "#e6edf3",
}

function fileStatusIcon(entry: GitStatusEntry): string {
	switch (entry.type) {
		case "added":
			return "A"
		case "modified":
			return "M"
		case "deleted":
			return "D"
		case "renamed":
			return "R"
		case "copied":
			return "C"
		case "untracked":
			return "?"
		case "unmerged":
			return "U"
		default:
			return "?"
	}
}

function fileStatusColor(entry: GitStatusEntry): string {
	switch (entry.type) {
		case "added":
			return C.staged
		case "modified":
			return entry.staged ? C.staged : C.modified
		case "deleted":
			return C.deleted
		case "renamed":
			return C.staged
		case "copied":
			return C.staged
		case "untracked":
			return C.untracked
		case "unmerged":
			return C.conflict
		default:
			return C.dim
	}
}

export function StatusView() {
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [showDiscard, setShowDiscard] = createSignal(false)
	const [showCommit, setShowCommit] = createSignal(false)
	const [showStash, setShowStash] = createSignal(false)
	const [showPushPR, setShowPushPR] = createSignal(false)
	const [showBlame, setShowBlame] = createSignal(false)
	const [pendingCommitMessage, setPendingCommitMessage] = createSignal("")
	const [diffContent, setDiffContent] = createSignal("")
	const [diffStaged, setDiffStaged] = createSignal(false)
	const [selectedHunk, setSelectedHunk] = createSignal(0)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)

	const entries = () => state.git.status
	const selectedEntry = () => entries()[selectedIdx()]
	const currentBranchPR = () =>
		state.github.prs.find(
			(pr) => pr.headRefName === state.git.currentBranch && pr.state === "OPEN",
		) ?? null
	const currentBranchEntry = () =>
		state.git.branches.find((b) => b.name === state.git.currentBranch && !b.remote) ?? null

	const parsedDiff = () => parseDiff(diffContent())
	const hunks = () => parsedDiff().hunks
	const hunkCount = () => hunks().length

	async function loadDiff(entry: GitStatusEntry) {
		const staged = entry.staged && !entry.unstaged
		const diff = await getDiff(entry.path, staged, state.git.repoRoot)
		setDiffContent(diff)
		setDiffStaged(staged)
		setSelectedHunk(0)
	}

	onMount(async () => {
		await gitService.refreshStatus()
		if (state.github.isAuthenticated) void githubService.refreshPRs()
		const first = entries()[0]
		if (first) await loadDiff(first)
	})

	useKeyboard(async (key) => {
		if (showDiscard() || showCommit() || showStash() || showPushPR() || showBlame()) return

		const entry = selectedEntry()

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			setFocus(primaryFocused() ? "primary" : "detail")
			return
		}

		if (!primaryFocused()) {
			// Diff panel focused — hunk navigation and staging
			if (key.name === "[" || key.name === "]") {
				key.preventDefault()
				const count = hunkCount()
				if (count === 0) return
				const current = selectedHunk()
				const next = key.name === "]" ? (current + 1) % count : (current - 1 + count) % count
				setSelectedHunk(next)
				showToast("info", `Hunk ${next + 1}/${count}`)
			} else if (key.name === "s" && !key.shift) {
				key.preventDefault()
				const hunk = hunks()[selectedHunk()]
				if (!hunk) return
				try {
					const patch = hunkToPatch(hunk, parsedDiff().fileHeaders)
					await stageHunk(patch, state.git.repoRoot)
					await gitService.refreshStatus()
					const entry = selectedEntry()
					if (entry) await loadDiff(entry)
					showToast("success", `Staged hunk ${selectedHunk() + 1}`)
				} catch (err) {
					showToast("error", String(err))
				}
			} else if (key.name === "u") {
				key.preventDefault()
				const hunk = hunks()[selectedHunk()]
				if (!hunk) return
				try {
					const patch = hunkToPatch(hunk, parsedDiff().fileHeaders)
					await unstageHunk(patch, state.git.repoRoot)
					await gitService.refreshStatus()
					const entry = selectedEntry()
					if (entry) await loadDiff(entry)
					showToast("success", `Unstaged hunk ${selectedHunk() + 1}`)
				} catch (err) {
					showToast("error", String(err))
				}
			} else if (key.name === "S" && key.shift) {
				key.preventDefault()
				const hunk = hunks()[selectedHunk()]
				if (!hunk) return
				// Find first change line in the selected hunk
				const changeIdx = hunk.lines.findIndex((l) => l.startsWith("+") || l.startsWith("-"))
				if (changeIdx < 0) return
				try {
					const patch = lineToPatch(hunk, parsedDiff().fileHeaders, changeIdx)
					await stageHunk(patch, state.git.repoRoot)
					await gitService.refreshStatus()
					const entry = selectedEntry()
					if (entry) await loadDiff(entry)
					showToast("success", "Staged line")
				} catch (err) {
					showToast("error", String(err))
				}
			}
			return
		}

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			const next = Math.min(selectedIdx() + 1, entries().length - 1)
			setSelectedIdx(next)
			const e = entries()[next]
			if (e) await loadDiff(e)
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const prev = Math.max(selectedIdx() - 1, 0)
			setSelectedIdx(prev)
			const e = entries()[prev]
			if (e) await loadDiff(e)
		} else if (key.name === "g") {
			key.preventDefault()
			setSelectedIdx(0)
			const e = entries()[0]
			if (e) await loadDiff(e)
		} else if (key.name === "G") {
			key.preventDefault()
			const last = Math.max(entries().length - 1, 0)
			setSelectedIdx(last)
			const e = entries()[last]
			if (e) await loadDiff(e)
		} else if (key.name === " ") {
			key.preventDefault()
			if (!entry) return
			try {
				if (entry.staged) await unstageFile(entry.path, state.git.repoRoot)
				else await stageFile(entry.path, state.git.repoRoot)
				await gitService.refreshStatus()
				const updated = entries()[selectedIdx()]
				if (updated) await loadDiff(updated)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a" && !key.shift) {
			key.preventDefault()
			try {
				await stageAll(state.git.repoRoot)
				await gitService.refreshStatus()
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a" && key.shift) {
			// A = unstage all
			key.preventDefault()
			try {
				await unstageAll(state.git.repoRoot)
				await gitService.refreshStatus()
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "d" && !key.shift) {
			key.preventDefault()
			if (entry) setShowDiscard(true)
		} else if (key.name === "c" && !key.shift) {
			key.preventDefault()
			setShowCommit(true)
		} else if (key.name === "f") {
			key.preventDefault()
			toggleFullscreen("detail")
		} else if (key.name === "s" && !key.shift) {
			key.preventDefault()
			setShowStash(true)
		} else if (key.name === "b" && entry) {
			key.preventDefault()
			setShowBlame((v) => !v)
		} else if (key.name === "r" || (key.ctrl && key.name === "r")) {
			key.preventDefault()
			await gitService.refreshStatus()
		} else if (key.name === "P" && key.shift) {
			key.preventDefault()
			const toastId = showToast("info", `Pushing ${state.git.currentBranch}...`, 0)
			try {
				const existingPR = currentBranchPR()
				if (existingPR) {
					const result = await pushAndCreatePR(state.git.currentBranch)
					if (result.pushed) {
						updateToast(toastId, "success", `Pushed ${state.git.currentBranch}`)
					}
				} else {
					const result = await pushAndCreatePR(state.git.currentBranch)
					if (result.pr) {
						updateToast(toastId, "info", "Updating PR list...", 0)
						await githubService.refreshPRs()
						updateToast(toastId, "success", `Pushed and created PR #${result.pr.number}`)
					} else if (result.pushed) {
						updateToast(toastId, "success", `Pushed ${state.git.currentBranch}`)
					}
				}
			} catch (err) {
				updateToast(toastId, "error", String(err))
			}
		} else if (key.name === "V" && key.shift) {
			key.preventDefault()
			if (currentBranchPR()) setView("prs")
			else showToast("info", "No open PR for current branch")
		}
	})

	const stagedEntries = () => entries().filter((e) => e.staged)
	const unstagedEntries = () => entries().filter((e) => e.unstaged && !e.staged)
	const untrackedEntries = () => entries().filter((e) => e.type === "untracked")

	const isFullscreen = () => state.ui.fullscreenPanel === "detail"

	return (
		<box flexGrow={1} flexDirection="column">
			{/* PR context banner */}
			<Show when={currentBranchPR() !== null && state.github.isAuthenticated}>
				<box height={1} paddingLeft={2} border={["bottom"]} borderColor={C.border}>
					<text fg={C.dim}>
						{state.git.currentBranch} •{" "}
						<span style={{ fg: "#58a6ff" }}>PR #{currentBranchPR()!.number}</span>{" "}
						<span style={{ fg: currentBranchPR()!.isDraft ? C.dim : C.staged }}>
							{currentBranchPR()!.isDraft ? `${icons.circle} draft` : `${icons.check} open`}
						</span>
						{currentBranchPR()!.mergeable === "MERGEABLE" ? (
							<span style={{ fg: C.staged }}> • mergeable</span>
						) : null}
					</text>
				</box>
			</Show>

			{/* Main split: file list + diff */}
			<box flexGrow={1} flexDirection="row">
				{/* File list — hidden in fullscreen diff mode */}
				<Show when={!isFullscreen()}>
					<box
						width={36}
						flexDirection="column"
						border
						borderColor={primaryFocused() ? C.activeBorder : C.border}
						title="changes"
					>
						<scrollbox flexGrow={1}>
							{/* Staged changes */}
							<Show when={stagedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={C.staged}>Staged ({stagedEntries().length})</text>
								</box>
								<For each={stagedEntries()}>
									{(entry) => {
										const myIdx = () => entries().indexOf(entry)
										const isSelected = () => selectedIdx() === myIdx()
										return (
											<box
												flexDirection="row"
												paddingLeft={2}
												paddingRight={1}
												backgroundColor={isSelected() ? C.selected : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={C.staged}>{fileStatusIcon(entry)} </text>
												<text fg={isSelected() ? C.selectedText : C.text}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Unstaged changes */}
							<Show when={unstagedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={C.modified}>Unstaged ({unstagedEntries().length})</text>
								</box>
								<For each={unstagedEntries()}>
									{(entry) => {
										const myIdx = () => entries().indexOf(entry)
										const isSelected = () => selectedIdx() === myIdx()
										return (
											<box
												flexDirection="row"
												paddingLeft={2}
												paddingRight={1}
												backgroundColor={isSelected() ? C.selected : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={fileStatusColor(entry)}>{fileStatusIcon(entry)} </text>
												<text fg={isSelected() ? C.selectedText : C.text}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Untracked files */}
							<Show when={untrackedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={C.untracked}>Untracked ({untrackedEntries().length})</text>
								</box>
								<For each={untrackedEntries()}>
									{(entry) => {
										const myIdx = () => entries().indexOf(entry)
										const isSelected = () => selectedIdx() === myIdx()
										return (
											<box
												flexDirection="row"
												paddingLeft={2}
												paddingRight={1}
												backgroundColor={isSelected() ? C.selected : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={C.untracked}>? </text>
												<text fg={isSelected() ? C.selectedText : C.dim}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Empty state */}
							<Show when={entries().length === 0}>
								<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
									<text fg={C.dim}>Nothing to commit</text>
									<text fg={C.dim}>working tree clean</text>
								</box>
							</Show>
						</scrollbox>

						{/* File list footer hints */}
						<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
							<text fg={C.dim}>
								<span style={{ fg: "#58a6ff" }}>Space</span> stage ·{" "}
								<span style={{ fg: "#58a6ff" }}>a</span> all ·{" "}
								<span style={{ fg: "#58a6ff" }}>d</span> discard ·{" "}
								<span style={{ fg: "#58a6ff" }}>c</span> commit ·{" "}
								<span style={{ fg: "#58a6ff" }}>b</span> blame ·{" "}
								<span style={{ fg: "#58a6ff" }}>P</span> push·PR ·{" "}
								<span style={{ fg: "#58a6ff" }}>V</span> view PR
							</text>
						</box>
					</box>
				</Show>

				{/* Diff panel */}
				<Show when={!showBlame()}>
					<DiffViewer
						content={diffContent()}
						title={selectedEntry() ? `diff: ${selectedEntry()!.path}` : "diff"}
						staged={diffStaged()}
						fullscreen={isFullscreen()}
						onToggleFullscreen={() => toggleFullscreen("detail")}
						selectedHunk={selectedHunk()}
						hunkCount={hunkCount()}
					/>
				</Show>

				{/* Blame overlay */}
				<Show when={showBlame() && selectedEntry()}>
					<BlameView filePath={selectedEntry()!.path} onClose={() => setShowBlame(false)} />
				</Show>
			</box>

			{/* Dialogs */}
			<Show when={showDiscard()}>
				<ConfirmDialog
					title="Discard changes"
					message={`Discard changes to "${selectedEntry()?.path}"? This cannot be undone.`}
					dangerous
					onConfirm={async () => {
						setShowDiscard(false)
						const entry = selectedEntry()
						if (!entry) return
						try {
							await discardFile(entry.path, state.git.repoRoot)
							await gitService.refreshStatus()
							showToast("success", `Discarded changes to ${entry.path}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowDiscard(false)}
				/>
			</Show>

			<Show when={showCommit()}>
				<InputDialog
					title="Commit message"
					placeholder="feat: add new feature"
					multiline
					onSubmit={async (message) => {
						setShowCommit(false)
						try {
							const beforeHash = await getHeadHash(state.git.repoRoot)
							const { commit } = await import("@gubbi/git")
							await commit(message, {}, state.git.repoRoot)
							const afterHash = await getHeadHash(state.git.repoRoot)
							recordOperation("commit", `commit: ${message.slice(0, 50)}`, beforeHash, afterHash)
							await gitService.refreshStatus()
							showToast("success", "Committed successfully")
							if (state.github.isAuthenticated) {
								setPendingCommitMessage(message)
								setShowPushPR(true)
							}
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowCommit(false)}
				/>
			</Show>

			<Show when={showStash()}>
				<InputDialog
					title="Stash message (optional)"
					placeholder="WIP: in-progress work"
					onSubmit={async (message) => {
						setShowStash(false)
						try {
							const { stash } = await import("@gubbi/git")
							await stash(message || undefined, { includeUntracked: true }, state.git.repoRoot)
							await gitService.refreshStatus()
							showToast("success", "Changes stashed")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowStash(false)}
				/>
			</Show>

			<Show when={showPushPR()}>
				<ConfirmDialog
					title="Push and create PR?"
					message={
						currentBranchPR()
							? `Push ${state.git.currentBranch}? (PR #${currentBranchPR()!.number} already exists)`
							: `Push ${state.git.currentBranch} and create a PR?`
					}
					confirmLabel="Push"
					onConfirm={async () => {
						setShowPushPR(false)
						const toastId = showToast("info", `Pushing ${state.git.currentBranch}...`, 0)
						try {
							const result = await pushAndCreatePR(state.git.currentBranch, pendingCommitMessage())
							if (result.pr && !currentBranchPR()) {
								updateToast(toastId, "info", "Updating PR list...", 0)
								await githubService.refreshPRs()
								updateToast(toastId, "success", `Pushed and created PR #${result.pr.number}`)
							} else if (result.pushed) {
								updateToast(toastId, "success", `Pushed ${state.git.currentBranch}`)
							}
						} catch (err) {
							updateToast(toastId, "error", String(err))
						}
					}}
					onCancel={() => setShowPushPR(false)}
				/>
			</Show>
		</box>
	)
}
