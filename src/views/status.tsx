/**
 * status.tsx — Git status view: working tree, staging area, and diff preview
 */

import { useKeyboard } from "@opentui/solid"
import { createSignal, Show, For, onMount } from "solid-js"

import { ConfirmDialog, InputDialog } from "../components/dialog.tsx"
import { DiffViewer } from "../components/diff-viewer.tsx"
import { refreshStatus } from "../hooks/use-git.ts"
import { stageFile, unstageFile, stageAll, unstageAll, discardFile, getDiff } from "../lib/git.ts"
import type { StatusEntry } from "../lib/parser.ts"
import { state, setState, setFocus, showToast, toggleFullscreen } from "../lib/store.ts"

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

function fileStatusIcon(entry: StatusEntry): string {
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

function fileStatusColor(entry: StatusEntry): string {
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
	const [diffContent, setDiffContent] = createSignal("")
	const [diffStaged, setDiffStaged] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)

	const entries = () => state.statusEntries
	const selectedEntry = () => entries()[selectedIdx()]

	async function loadDiff(entry: StatusEntry) {
		const staged = entry.staged && !entry.unstaged
		const diff = await getDiff(entry.path, staged, state.repoRoot)
		setDiffContent(diff)
		setDiffStaged(staged)
	}

	onMount(async () => {
		await refreshStatus()
		const first = entries()[0]
		if (first) await loadDiff(first)
	})

	useKeyboard(async (key) => {
		if (showDiscard() || showCommit() || showStash()) return

		const entry = selectedEntry()

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			setFocus(primaryFocused() ? "primary" : "detail")
			return
		}

		if (!primaryFocused()) return

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
				if (entry.staged) await unstageFile(entry.path, state.repoRoot)
				else await stageFile(entry.path, state.repoRoot)
				await refreshStatus()
				const updated = entries()[selectedIdx()]
				if (updated) await loadDiff(updated)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a" && !key.shift) {
			key.preventDefault()
			try {
				await stageAll(state.repoRoot)
				await refreshStatus()
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "a" && key.shift) {
			// A = unstage all
			key.preventDefault()
			try {
				await unstageAll(state.repoRoot)
				await refreshStatus()
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
		} else if (key.name === "r" || (key.ctrl && key.name === "r")) {
			key.preventDefault()
			await refreshStatus()
		}
	})

	const stagedEntries = () => entries().filter((e) => e.staged)
	const unstagedEntries = () => entries().filter((e) => e.unstaged && !e.staged)
	const untrackedEntries = () => entries().filter((e) => e.type === "untracked")

	const isFullscreen = () => state.fullscreenPanel === "detail"

	return (
		<box flexGrow={1} flexDirection="column">
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
								<span style={{ fg: "#58a6ff" }}>c</span> commit
							</text>
						</box>
					</box>
				</Show>

				{/* Diff panel */}
				<DiffViewer
					content={diffContent()}
					title={selectedEntry() ? `diff: ${selectedEntry()!.path}` : "diff"}
					staged={diffStaged()}
					fullscreen={isFullscreen()}
					onToggleFullscreen={() => toggleFullscreen("detail")}
				/>
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
							await discardFile(entry.path, state.repoRoot)
							await refreshStatus()
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
							const { commit } = await import("../lib/git.ts")
							await commit(message, {}, state.repoRoot)
							await refreshStatus()
							showToast("success", "Committed successfully")
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
							const { stash } = await import("../lib/git.ts")
							await stash(message || undefined, { includeUntracked: true }, state.repoRoot)
							await refreshStatus()
							showToast("success", "Changes stashed")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowStash(false)}
				/>
			</Show>
		</box>
	)
}
