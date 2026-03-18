/**
 * log.tsx — Full commit history with graph visualization and search
 */

import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

import { InputDialog, SelectDialog, ConfirmDialog } from "../components/dialog.tsx"
import { DiffViewer } from "../components/diff-viewer.tsx"
import { refreshStatus, refreshBranches } from "../hooks/use-git.ts"
import { getLog, checkout, cherryPick, createBranch } from "../lib/git.ts"
import type { LogEntry } from "../lib/parser.ts"
import { exec } from "../lib/shell.ts"
import { state, showToast } from "../lib/store.ts"

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
}

function gpgIcon(status: string): string {
	if (status === "G") return " ✓"
	if (status === "B" || status === "E") return " ✗"
	return ""
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

	const selectedEntry = () => entries()[selectedIdx()]

	async function loadEntries(grep?: string) {
		setLoading(true)
		try {
			const all = await getLog({ count: 500, all: true, grep }, state.repoRoot)
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
				cwd: state.repoRoot,
			})
			setDiffContent(r.stdout)
		} catch {
			setDiffContent("")
		}
	}

	onMount(() => void loadEntries())

	useKeyboard(async (key) => {
		if (showSearch() || showBranchInput() || showCherryPickConfirm()) return

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
		} else if (key.name === "b" && entry) {
			key.preventDefault()
			setShowBranchInput(true)
		} else if (key.name === "y" && entry) {
			key.preventDefault()
			setShowCherryPickConfirm(true)
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
				borderColor={primaryFocused() ? C.activeBorder : C.border}
				title={searchQuery() ? `log: "${searchQuery()}"` : "log"}
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
						<text fg={C.dim}>
							<span style={{ fg: "#58a6ff" }}>/</span> search ·{" "}
							<span style={{ fg: "#58a6ff" }}>b</span> branch here ·{" "}
							<span style={{ fg: "#58a6ff" }}>y</span> cherry-pick
						</text>
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
							await createBranch(name, entry.hash, true, state.repoRoot)
							await refreshBranches()
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
							await cherryPick(entry.hash, state.repoRoot)
							await refreshStatus()
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
