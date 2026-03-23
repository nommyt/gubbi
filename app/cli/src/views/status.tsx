/**
 * status.tsx — Git status view: working tree, staging area, and diff preview
 */

import type { GitStatusEntry } from "@gubbi/core"
import {
	state,
	setFocus,
	showToast,
	updateToast,
	toggleFullscreen,
	setView,
	icons,
	recordOperation,
	useTheme,
} from "@gubbi/core"
import { ConfirmDialog, InputDialog, NativeDiff, BlameView, KeyHints } from "@gubbi/core/tui"
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
	commit,
	stash,
} from "@gubbi/git"
import { pushAndCreatePR, githubService } from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, Show, For, onMount, onCleanup } from "solid-js"

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

export function StatusView() {
	const t = useTheme()

	function fileStatusColor(entry: GitStatusEntry): string {
		switch (entry.type) {
			case "added":
				return t.gitAdded
			case "modified":
				return entry.staged ? t.gitAdded : t.gitModified
			case "deleted":
				return t.gitDeleted
			case "renamed":
				return t.gitRenamed
			case "copied":
				return t.gitAdded
			case "untracked":
				return t.gitUntracked
			case "unmerged":
				return t.gitConflict
			default:
				return t.textSecondary
		}
	}

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

	// Diff cache: key = "path:staged" → diff content
	const diffCache = new Map<string, string>()

	function getDiffCacheKey(path: string, staged: boolean): string {
		return `${path}:${staged}`
	}

	function invalidateDiffCache() {
		diffCache.clear()
	}

	const entries = () => state.git.status
	const selectedEntry = () => entries()[selectedIdx()]
	const currentBranchPR = () =>
		state.github.prs.find(
			(pr) => pr.headRefName === state.git.currentBranch && pr.state === "OPEN",
		) ?? null
	const parsedDiff = () => parseDiff(diffContent())
	const hunks = () => parsedDiff().hunks
	const hunkCount = () => hunks().length

	async function loadDiff(entry: GitStatusEntry) {
		const staged = entry.staged && !entry.unstaged
		const cacheKey = getDiffCacheKey(entry.path, staged)

		// Check cache first
		const cached = diffCache.get(cacheKey)
		if (cached !== undefined) {
			setDiffContent(cached)
			setDiffStaged(staged)
			setSelectedHunk(0)
			return
		}

		const diff = await getDiff(entry.path, staged, state.git.repoRoot)
		diffCache.set(cacheKey, diff)
		setDiffContent(diff)
		setDiffStaged(staged)
		setSelectedHunk(0)
	}

	onMount(async () => {
		await gitService.refreshStatus()
		if (state.github.isAuthenticated) void githubService.refreshPRs()
		const first = entries()[0]
		if (first) await loadDiff(first)

		const timer = setInterval(async () => {
			await gitService.refreshStatus()
		}, 5000)
		onCleanup(() => clearInterval(timer))
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
				// Invalidate diff cache for this file
				diffCache.delete(getDiffCacheKey(entry.path, true))
				diffCache.delete(getDiffCacheKey(entry.path, false))
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
				invalidateDiffCache()
				await gitService.refreshStatus()
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a" && key.shift) {
			// A = unstage all
			key.preventDefault()
			try {
				await unstageAll(state.git.repoRoot)
				invalidateDiffCache()
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
				<box height={1} paddingLeft={2} border={["bottom"]} borderColor={t.border}>
					<text fg={t.textSecondary}>
						{state.git.currentBranch} •{" "}
						<span style={{ fg: t.accent }}>PR #{currentBranchPR()?.number}</span>{" "}
						<span style={{ fg: currentBranchPR()?.isDraft ? t.textSecondary : t.gitAdded }}>
							{currentBranchPR()?.isDraft ? `${icons.circle} draft` : `${icons.check} open`}
						</span>
						{currentBranchPR()?.mergeable === "MERGEABLE" ? (
							<span style={{ fg: t.gitAdded }}> • mergeable</span>
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
						borderColor={primaryFocused() ? t.borderFocused : t.border}
						title="changes"
					>
						<scrollbox flexGrow={1}>
							{/* Staged changes */}
							<Show when={stagedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={t.gitAdded}>Staged ({stagedEntries().length})</text>
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
												backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={t.gitAdded}>{fileStatusIcon(entry)} </text>
												<text fg={isSelected() ? t.text : t.text}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Unstaged changes */}
							<Show when={unstagedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={t.gitModified}>Unstaged ({unstagedEntries().length})</text>
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
												backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={fileStatusColor(entry)}>{fileStatusIcon(entry)} </text>
												<text fg={isSelected() ? t.text : t.text}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Untracked files */}
							<Show when={untrackedEntries().length > 0}>
								<box paddingLeft={1} paddingTop={1}>
									<text fg={t.gitUntracked}>Untracked ({untrackedEntries().length})</text>
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
												backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
												onMouseDown={() => {
													setSelectedIdx(myIdx())
													void loadDiff(entry)
													setPrimaryFocused(true)
												}}
											>
												<text fg={t.gitUntracked}>? </text>
												<text fg={isSelected() ? t.text : t.textSecondary}>{entry.path}</text>
											</box>
										)
									}}
								</For>
							</Show>

							{/* Empty state */}
							<Show when={entries().length === 0}>
								<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
									<text fg={t.textSecondary}>Nothing to commit</text>
									<text fg={t.textSecondary}>working tree clean</text>
								</box>
							</Show>
						</scrollbox>

						{/* File list footer hints */}
						<KeyHints
							hints={[
								{ key: "Space", label: "stage" },
								{ key: "a", label: "all" },
								{ key: "d", label: "discard" },
								{ key: "c", label: "commit" },
								{ key: "b", label: "blame" },
								{ key: "P", label: "push·PR" },
								{ key: "V", label: "view PR" },
							]}
						/>
					</box>
				</Show>

				{/* Diff panel */}
				<Show when={!showBlame()}>
					<NativeDiff
						content={diffContent()}
						title={selectedEntry() ? `diff: ${selectedEntry()?.path}` : "diff"}
						filepath={selectedEntry()?.path}
						mode={state.git.sideBySideDiff ? "split" : "unified"}
						staged={diffStaged()}
						fullscreen={isFullscreen()}
						onToggleFullscreen={() => toggleFullscreen("detail")}
						selectedHunk={selectedHunk()}
						hunkCount={hunkCount()}
					/>
				</Show>

				{/* Blame overlay */}
				<Show when={showBlame() && selectedEntry()}>
					<BlameView
						filePath={selectedEntry()?.path ?? ""}
						onClose={() => setShowBlame(false)}
						onJumpToCommit={(hash) => {
							setShowBlame(false)
							state.git.selectedLogEntry = null
							setView("log")
							// Store the hash to jump to in state for the log view to pick up
							;(state as unknown as Record<string, unknown>)._pendingCommitHash = hash
						}}
					/>
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
							diffCache.delete(getDiffCacheKey(entry.path, true))
							diffCache.delete(getDiffCacheKey(entry.path, false))
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
							? `Push ${state.git.currentBranch}? (PR #${currentBranchPR()?.number} already exists)`
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
