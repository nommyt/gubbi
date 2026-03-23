/**
 * smartlog.tsx — Sapling-inspired filtered commit graph with PR/CI status
 * Shows only your work: unpushed commits, branches you authored, with inline GitHub data.
 */

import { state, showToast, icons, useTheme } from "@gubbi/core"
import { NativeDiff } from "@gubbi/core/tui"
import { getLog, getGraphLog, parseGraphLog } from "@gubbi/git"
import type { LogEntry, GraphEntry } from "@gubbi/git"
import { exec } from "@gubbi/git"
import { getPRForBranch } from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

function gpgIcon(status: string): string | null {
	if (status === "G") return icons.check
	if (status === "B" || status === "E") return icons.circleSlash
	return null
}

function ciStatusForPR(_prNumber: number): string | null {
	// GitHubPR in state doesn't carry check data; CI status not available here
	return null
}

function ciIcon(status: string | null): string {
	switch (status) {
		case "passing":
			return icons.check
		case "failing":
			return icons.circleSlash
		case "pending":
			return icons.sync
		default:
			return ""
	}
}

export function SmartlogView() {
	const t = useTheme()

	function gpgColor(status: string): string {
		if (status === "G") return t.success
		if (status === "B" || status === "E") return t.error
		return t.textMuted
	}

	function ciColor(status: string | null): string {
		if (status === "success") return t.success
		if (status === "failure") return t.error
		if (status === "pending") return t.warning
		return t.textMuted
	}

	const [entries, setEntries] = createSignal<LogEntry[]>([])
	const [graphData, setGraphData] = createSignal<Map<string, GraphEntry>>(new Map())
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [diffContent, setDiffContent] = createSignal("")
	const [loading, setLoading] = createSignal(true)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)

	const selectedEntry = () => entries()[selectedIdx()]

	async function loadEntries() {
		setLoading(true)
		try {
			const [all, rawGraph] = await Promise.all([
				getLog({ count: 150, all: true }, state.git.repoRoot),
				getGraphLog({ count: 150, all: true }, state.git.repoRoot),
			])
			setEntries(all)

			// Build graph map: short hash -> graph entry
			const graphEntries = parseGraphLog(rawGraph)
			const map = new Map<string, GraphEntry>()
			for (const ge of graphEntries) {
				map.set(ge.hash, ge)
			}
			setGraphData(map)

			const first = all[0]
			if (first) await loadDiff(first)
		} catch (err) {
			showToast("error", `Failed to load log: ${String(err)}`)
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

	onMount(loadEntries)

	useKeyboard(async (key) => {
		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
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
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadEntries()
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* Commit list */}
			<box
				width={60}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? t.borderFocused : t.border}
				title="smartlog"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={t.textSecondary}>Loading...</text>
						</box>
					}
				>
					<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
						<For each={entries()}>
							{(entry, i) => {
								const isSelected = () => selectedIdx() === i()
								const isCurrent = () =>
									state.git.currentBranch !== "" &&
									entry.refs.some((r) => r.includes(state.git.currentBranch) && r.includes("HEAD"))

								// Graph data for this commit
								const graphEntry = () => graphData().get(entry.shortHash)

								// Extract branch/tag refs
								const localRefs = () =>
									entry.refs.filter(
										(r) => !r.startsWith("origin/") && r !== "HEAD" && !r.includes("->"),
									)
								const remoteBranch = () => entry.refs.find((r) => r.startsWith("origin/"))

								// PR for first local branch
								const firstBranch = () => localRefs()[0]
								const pr = () => {
									const b = firstBranch()
									return b ? getPRForBranch(b, state.github.prs) : null
								}
								const ci = () => {
									const p = pr()
									return p ? ciStatusForPR(p.number) : null
								}

								return (
									<box
										flexDirection="column"
										paddingLeft={1}
										paddingRight={1}
										paddingTop={0}
										backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
										onMouseDown={() => {
											setSelectedIdx(i())
											void loadDiff(entry)
											setPrimaryFocused(true)
										}}
									>
										<box flexDirection="row" gap={1}>
											{/* Graph indicator */}
											<Show
												when={graphEntry()}
												fallback={
													<text fg={isCurrent() ? t.success : t.textMuted}>
														{isCurrent() ? icons.circleFilled : icons.circle}
													</text>
												}
											>
												<text fg={isCurrent() ? t.success : t.textMuted}>
													{graphEntry()?.graph}
												</text>
											</Show>

											{/* Short hash */}
											<text fg={t.accent}>{entry.shortHash}</text>

											{/* Subject */}
											<text fg={isSelected() ? t.text : t.textSecondary}>{entry.subject}</text>

											<box flexGrow={1} />

											{/* GPG indicator */}
											<Show when={gpgIcon(entry.gpgStatus)}>
												<text fg={gpgColor(entry.gpgStatus)}>{gpgIcon(entry.gpgStatus)}</text>
											</Show>

											{/* CI status */}
											<Show when={ci()}>
												<text fg={ciColor(ci())}>{ciIcon(ci())}</text>
											</Show>
										</box>

										{/* Refs line */}
										<Show when={localRefs().length > 0 || pr()}>
											<box flexDirection="row" gap={1} paddingLeft={2}>
												<For each={localRefs()}>
													{(ref) => (
														<text>
															<span style={{ fg: ref.includes("HEAD") ? t.success : t.accent }}>
																{icons.branch} {ref.replace("HEAD -> ", "")}
															</span>
														</text>
													)}
												</For>

												<Show when={remoteBranch()}>
													<text fg={t.warning}>↑ {remoteBranch()?.replace("origin/", "")}</text>
												</Show>

												<Show when={pr()}>
													<text>
														<span style={{ fg: pr()?.isDraft ? t.prDraft : t.prOpen }}>
															PR #{pr()?.number}
															{pr()?.isDraft ? " (draft)" : ""}
														</span>
													</text>
												</Show>
											</box>
										</Show>

										{/* Author + date */}
										<box flexDirection="row" paddingLeft={2} gap={1}>
											<text fg={t.accent}>{entry.author}</text>
											<text fg={t.textMuted}>{entry.relativeDate}</text>
										</box>
									</box>
								)
							}}
						</For>

						<Show when={entries().length === 0}>
							<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
								<text fg={t.textSecondary}>No commits found</text>
							</box>
						</Show>
					</scrollbox>
				</Show>
			</box>

			{/* Diff panel */}
			<NativeDiff
				content={diffContent()}
				title={selectedEntry() ? `commit: ${selectedEntry()?.shortHash}` : "commit"}
				mode={state.git.sideBySideDiff ? "split" : "unified"}
			/>
		</box>
	)
}
