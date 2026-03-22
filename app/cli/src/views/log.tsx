/**
 * log.tsx — Full commit history with graph visualization and search
 */

import { state, showToast, updateToast, icons } from "@gubbi/core"
import {
	getLog,
	checkout,
	cherryPick,
	createBranch,
	gitService,
	openURL,
	interactiveRebase,
} from "@gubbi/git"
import type { LogEntry, RebaseAction, RebaseTodo } from "@gubbi/git"
import { exec } from "@gubbi/git"
import { InputDialog, SelectDialog, ConfirmDialog } from "@gubbi/tui"
import { DiffViewer } from "@gubbi/tui"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	hash: "#8b949e",
	author: "#58a6ff",
	date: "#484f58",
	subject: "#e6edf3",
	branch: "#3fb950",
	tag: "#a371f7",
	remote: "#d29922",
	dim: "#8b949e",
	graph: "#484f58",
	current: "#58a6ff",
	gpgGood: "#3fb950",
	gpgBad: "#f78166",
	prOpen: "#3fb950",
	prMerged: "#a371f7",
	rebasePick: "#3fb950",
	rebaseSquash: "#a371f7",
	rebaseFixup: "#58a6ff",
	rebaseDrop: "#f78166",
	rebaseEdit: "#d29922",
	rebaseReword: "#58a6ff",
}

function gpgIcon(status: string): string {
	if (status === "G") return ` ${icons.check}`
	if (status === "B" || status === "E") return ` ${icons.circleSlash}`
	return ""
}

function getPRForEntry(entry: LogEntry) {
	for (const pr of state.github.prs) {
		for (const ref of entry.refs) {
			const cleaned = ref.replace("HEAD -> ", "").replace(/^origin\//, "")
			if (cleaned === pr.headRefName) return pr
		}
	}
	return null
}

export function LogView() {
	const [entries, setEntries] = createSignal<LogEntry[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [diffContent, setDiffContent] = createSignal("")
	const [loading, setLoading] = createSignal(true)
	const [searchQuery, setSearchQuery] = createSignal("")
	const [showSearch, setShowSearch] = createSignal(false)
	const [showBranchInput, setShowBranchInput] = createSignal(false)
	const [showCherryPickConfirm, setShowCherryPickConfirm] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)
	const [clipboardHashes, setClipboardHashes] = createSignal<string[]>([])

	// Rebase mode state
	const [rebaseMode, setRebaseMode] = createSignal(false)
	const [rebaseActions, setRebaseActions] = createSignal<Map<string, RebaseAction>>(new Map())
	const [rebaseStartIdx, setRebaseStartIdx] = createSignal(0)

	const selectedEntry = () => entries()[selectedIdx()]

	const REBASE_ACTION_ORDER: RebaseAction[] = ["pick", "squash", "fixup", "drop", "edit", "reword"]

	function rebaseActionColor(action: RebaseAction): string {
		switch (action) {
			case "pick":
				return C.rebasePick
			case "squash":
				return C.rebaseSquash
			case "fixup":
				return C.rebaseFixup
			case "drop":
				return C.rebaseDrop
			case "edit":
				return C.rebaseEdit
			case "reword":
				return C.rebaseReword
		}
	}

	function getAction(hash: string): RebaseAction {
		return rebaseActions().get(hash) ?? "pick"
	}

	function cycleAction(hash: string) {
		const current = getAction(hash)
		const idx = REBASE_ACTION_ORDER.indexOf(current)
		const next = REBASE_ACTION_ORDER[(idx + 1) % REBASE_ACTION_ORDER.length]!
		const map = new Map(rebaseActions())
		map.set(hash, next)
		setRebaseActions(map)
	}

	function toggleAction(hash: string, action: RebaseAction) {
		const current = getAction(hash)
		const map = new Map(rebaseActions())
		if (current === action) {
			map.set(hash, "pick")
		} else {
			map.set(hash, action)
		}
		setRebaseActions(map)
	}

	function enterRebaseMode() {
		const idx = selectedIdx()
		if (idx >= entries().length - 1) {
			showToast("info", "Cannot rebase from the oldest commit")
			return
		}
		setRebaseStartIdx(idx)
		setRebaseActions(new Map())
		setRebaseMode(true)
		showToast("info", "Rebase mode — s: squash, f: fixup, d: drop, e: edit, r: reword")
	}

	function exitRebaseMode() {
		setRebaseMode(false)
		setRebaseActions(new Map())
	}

	async function executeRebase() {
		const startIdx = rebaseStartIdx()
		const allEntries = entries()
		const startEntry = allEntries[startIdx]
		if (!startEntry) return

		// Build todo list from startIdx to 0 (newest commits first in log, but rebase needs oldest first)
		const todos: RebaseTodo[] = []
		for (let i = startIdx; i >= 0; i--) {
			const e = allEntries[i]!
			const action = getAction(e.hash)
			todos.push({ hash: e.hash, action, subject: e.subject })
		}

		exitRebaseMode()
		const toastId = showToast("info", "Rebasing...", 0)
		try {
			await interactiveRebase(`${startEntry.hash}^`, todos, state.git.repoRoot)
			await gitService.refreshStatus()
			await loadEntries(searchQuery() || undefined)
			showToast("success", "Rebase complete")
		} catch (err) {
			updateToast(toastId, "error", `Rebase failed: ${err}`)
		}
	}

	async function loadEntries(grep?: string) {
		setLoading(true)
		try {
			const all = await getLog({ count: 500, all: true, grep }, state.git.repoRoot)
			setEntries(all)
			const first = all[0]
			if (first) await loadDiff(first)
		} catch (err) {
			showToast("error", `Failed to load log: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadDiff(entry: LogEntry) {
		try {
			// Get diff for the commit (changes introduced by this commit)
			const r = await exec("git", ["diff", "--no-color", `${entry.hash}^..${entry.hash}`], {
				cwd: state.git.repoRoot,
			})
			setDiffContent(r.stdout)
		} catch {
			setDiffContent("")
		}
	}

	onMount(() => void loadEntries())

	useKeyboard(async (key) => {
		if (showSearch() || showBranchInput() || showCherryPickConfirm()) return

		// Rebase mode keyboard handling
		if (rebaseMode()) {
			const entry = selectedEntry()
			if (!entry) return

			// Only allow actions on commits within the rebase range (from startIdx down to 0)
			const idx = selectedIdx()
			const inRange = idx <= rebaseStartIdx()

			if (key.name === "escape") {
				key.preventDefault()
				exitRebaseMode()
				showToast("info", "Rebase cancelled")
			} else if (key.name === "return") {
				key.preventDefault()
				await executeRebase()
			} else if (key.name === "j" || key.name === "down") {
				key.preventDefault()
				const next = Math.min(idx + 1, entries().length - 1)
				setSelectedIdx(next)
				const e = entries()[next]
				if (e) await loadDiff(e)
			} else if (key.name === "k" || key.name === "up") {
				key.preventDefault()
				const prev = Math.max(idx - 1, 0)
				setSelectedIdx(prev)
				const e = entries()[prev]
				if (e) await loadDiff(e)
			} else if (inRange) {
				if (key.name === " " || key.name === "s") {
					key.preventDefault()
					toggleAction(entry.hash, "squash")
				} else if (key.name === "f") {
					key.preventDefault()
					toggleAction(entry.hash, "fixup")
				} else if (key.name === "d") {
					key.preventDefault()
					toggleAction(entry.hash, "drop")
				} else if (key.name === "e") {
					key.preventDefault()
					toggleAction(entry.hash, "edit")
				} else if (key.name === "r") {
					key.preventDefault()
					toggleAction(entry.hash, "reword")
				} else if (key.name === "p") {
					key.preventDefault()
					const map = new Map(rebaseActions())
					map.set(entry.hash, "pick")
					setRebaseActions(map)
				}
			}
			return
		}

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			return
		}
		if (!primaryFocused()) return

		const entry = selectedEntry()

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
		} else if (key.name === "/") {
			key.preventDefault()
			setShowSearch(true)
		} else if (key.name === "escape") {
			key.preventDefault()
			if (searchQuery()) {
				setSearchQuery("")
				await loadEntries()
				showToast("info", "Filter cleared")
			}
		} else if (key.name === "b" && entry) {
			key.preventDefault()
			setShowBranchInput(true)
		} else if (key.name === "y" && entry) {
			key.preventDefault()
			setShowCherryPickConfirm(true)
		} else if (key.name === "v" && entry) {
			key.preventDefault()
			const pr = getPRForEntry(entry)
			if (pr) await openURL(pr.url)
			else showToast("info", "No PR found for this commit")
		} else if (key.name === "C" && key.shift && entry) {
			key.preventDefault()
			const hashes = clipboardHashes()
			if (hashes.includes(entry.hash)) {
				// Remove if already copied
				setClipboardHashes(hashes.filter((h) => h !== entry.hash))
				showToast("info", `Removed ${entry.shortHash} from clipboard`)
			} else {
				setClipboardHashes([...hashes, entry.hash])
				showToast(
					"success",
					`Copied ${entry.shortHash} (${hashes.length + 1} commit(s) in clipboard)`,
				)
			}
		} else if (key.name === "V" && key.shift) {
			key.preventDefault()
			const hashes = clipboardHashes()
			if (hashes.length === 0) {
				showToast("info", "Clipboard empty — use Shift+C to copy commits")
				return
			}
			try {
				for (const hash of hashes) {
					await cherryPick(hash, state.git.repoRoot)
				}
				await gitService.refreshStatus()
				await loadEntries(searchQuery() || undefined)
				setClipboardHashes([])
				showToast("success", `Cherry-picked ${hashes.length} commit(s)`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "i" && entry) {
			key.preventDefault()
			enterRebaseMode()
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadEntries(searchQuery() || undefined)
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* Commit list */}
			<box
				width={65}
				flexDirection="column"
				border
				borderColor={rebaseMode() ? C.rebasePick : primaryFocused() ? C.activeBorder : C.border}
				title={
					rebaseMode()
						? `rebase: interactive (${selectedEntry()?.shortHash ?? ""})`
						: searchQuery()
							? `log: "${searchQuery()}"`
							: "log"
				}
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading...</text>
						</box>
					}
				>
					<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
						<For each={entries()}>
							{(entry, i) => {
								const isSelected = () => selectedIdx() === i()
								const localRefs = () =>
									entry.refs.filter(
										(r) => !r.startsWith("origin/") && r !== "HEAD" && !r.includes("->"),
									)

								return (
									<box
										flexDirection="row"
										paddingLeft={1}
										paddingRight={1}
										gap={1}
										backgroundColor={isSelected() ? C.selected : "transparent"}
										onMouseDown={() => {
											setSelectedIdx(i())
											void loadDiff(entry)
											setPrimaryFocused(true)
										}}
									>
										{/* Rebase action label */}
										<Show when={rebaseMode() && i() <= rebaseStartIdx()}>
											<text fg={rebaseActionColor(getAction(entry.hash))}>
												{getAction(entry.hash).padEnd(6)}
											</text>
										</Show>

										{/* Hash */}
										<text fg={C.hash}>{entry.shortHash}</text>

										{/* Branch/tag refs */}
										<For each={localRefs().slice(0, 2)}>
											{(ref) => (
												<text>
													<span style={{ fg: ref.startsWith("tag:") ? C.tag : C.branch }}>
														[{ref.replace("HEAD -> ", "").replace("tag: ", "")}]
													</span>
												</text>
											)}
										</For>

										{/* Subject */}
										<text fg={isSelected() ? "#e6edf3" : C.subject}>{entry.subject}</text>

										{/* PR badge */}
										{(() => {
											const pr = getPRForEntry(entry)
											if (!pr) return null
											const merged = pr.state === "MERGED"
											return (
												<text fg={merged ? C.prMerged : C.prOpen}>
													[PR #{pr.number} {merged ? icons.merge : icons.pullRequest}]
												</text>
											)
										})()}

										<box flexGrow={1} />

										{/* Author */}
										<text fg={C.author}>{entry.author.split(" ")[0]}</text>

										{/* Date */}
										<text fg={C.date}>{entry.relativeDate}</text>

										{/* GPG */}
										<Show when={entry.gpgStatus !== "N"}>
											<text fg={entry.gpgStatus === "G" ? C.gpgGood : C.gpgBad}>
												{gpgIcon(entry.gpgStatus)}
											</text>
										</Show>
									</box>
								)
							}}
						</For>

						<Show when={entries().length === 0 && !loading()}>
							<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
								<text fg={C.dim}>No commits found</text>
								<Show when={searchQuery()}>
									<text fg={C.dim}>for "{searchQuery()}"</text>
								</Show>
							</box>
						</Show>
					</scrollbox>

					{/* Footer hints */}
					<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
						<Show
							when={rebaseMode()}
							fallback={
								<text fg={C.dim}>
									<span style={{ fg: "#58a6ff" }}>/</span> search ·{" "}
									<span style={{ fg: "#58a6ff" }}>i</span> rebase ·{" "}
									<span style={{ fg: "#58a6ff" }}>b</span> branch ·{" "}
									<span style={{ fg: "#58a6ff" }}>y</span> cherry-pick ·{" "}
									<span style={{ fg: "#58a6ff" }}>C</span> copy ·{" "}
									<span style={{ fg: "#58a6ff" }}>V</span> paste ·{" "}
									<span style={{ fg: "#58a6ff" }}>v</span> open PR
								</text>
							}
						>
							<text fg={C.dim}>
								<span style={{ fg: C.rebasePick }}>REBASE</span> ·{" "}
								<span style={{ fg: "#58a6ff" }}>s</span> squash ·{" "}
								<span style={{ fg: "#58a6ff" }}>f</span> fixup ·{" "}
								<span style={{ fg: "#58a6ff" }}>d</span> drop ·{" "}
								<span style={{ fg: "#58a6ff" }}>e</span> edit ·{" "}
								<span style={{ fg: "#58a6ff" }}>r</span> reword ·{" "}
								<span style={{ fg: "#58a6ff" }}>Enter</span> execute ·{" "}
								<span style={{ fg: "#58a6ff" }}>Esc</span> cancel
							</text>
						</Show>
						<Show when={clipboardHashes().length > 0}>
							<text fg={C.prMerged}>
								{" "}
								{icons.clipboard} {clipboardHashes().length}
							</text>
						</Show>
					</box>
				</Show>
			</box>

			{/* Diff / commit detail */}
			<DiffViewer
				content={diffContent()}
				title={
					selectedEntry() ? `${selectedEntry()!.shortHash}: ${selectedEntry()!.subject}` : "commit"
				}
			/>

			{/* Search dialog */}
			<Show when={showSearch()}>
				<InputDialog
					title="Search commits"
					placeholder="Search by message, author, or content..."
					onSubmit={(q) => {
						setShowSearch(false)
						setSearchQuery(q)
						void loadEntries(q)
					}}
					onCancel={() => setShowSearch(false)}
				/>
			</Show>

			{/* Branch creation dialog */}
			<Show when={showBranchInput()}>
				<InputDialog
					title={`Create branch at ${selectedEntry()?.shortHash}`}
					placeholder="feature/new-branch"
					onSubmit={async (name) => {
						setShowBranchInput(false)
						const entry = selectedEntry()
						if (!entry) return
						try {
							await createBranch(name, entry.hash, true, state.git.repoRoot)
							await gitService.refreshBranches()
							showToast("success", `Created branch "${name}"`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowBranchInput(false)}
				/>
			</Show>

			{/* Cherry-pick confirm */}
			<Show when={showCherryPickConfirm()}>
				<ConfirmDialog
					title="Cherry-pick commit"
					message={`Cherry-pick "${selectedEntry()?.subject}" (${selectedEntry()?.shortHash}) onto current branch?`}
					onConfirm={async () => {
						setShowCherryPickConfirm(false)
						const entry = selectedEntry()
						if (!entry) return
						try {
							await cherryPick(entry.hash, state.git.repoRoot)
							await gitService.refreshStatus()
							showToast("success", `Cherry-picked ${entry.shortHash}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowCherryPickConfirm(false)}
				/>
			</Show>
		</box>
	)
}
