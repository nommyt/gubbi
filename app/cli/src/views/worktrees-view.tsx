/**
 * worktrees-view.tsx — Git worktree management
 */

import { state, showToast, icons, useTheme } from "@gubbi/core"
import { InputDialog, ConfirmDialog, KeyHints } from "@gubbi/core/tui"
import {
	getWorktrees,
	addWorktree,
	removeWorktree,
	pruneWorktrees,
	repairWorktree,
	exec,
	type WorktreeEntry,
} from "@gubbi/git"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

function statusIcon(wt: WorktreeEntry): string {
	if (wt.locked) return icons.bookmark
	if (wt.prunable) return icons.circleSlash
	return icons.folder
}

export function WorktreesView() {
	const t = useTheme()

	function statusColor(wt: WorktreeEntry): string {
		if (wt.locked) return t.warning
		if (wt.prunable) return t.error
		return t.textSecondary
	}

	const [worktrees, setWorktrees] = createSignal<WorktreeEntry[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [loading, setLoading] = createSignal(true)
	const [showAdd, setShowAdd] = createSignal(false)
	const [showRemove, setShowRemove] = createSignal(false)
	const [showPrune, setShowPrune] = createSignal(false)

	const selectedWT = () => worktrees()[selectedIdx()]

	async function refresh() {
		setLoading(true)
		try {
			const list = await getWorktrees(state.git.repoRoot)
			setWorktrees(list)
		} catch (err) {
			showToast("error", `Failed to load worktrees: ${String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	onMount(() => void refresh())

	useKeyboard(async (key) => {
		if (showAdd() || showRemove() || showPrune()) return

		const wt = selectedWT()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, worktrees().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "n" || key.name === "a") {
			key.preventDefault()
			setShowAdd(true)
		} else if (key.name === "d" && wt && !wt.isMain) {
			key.preventDefault()
			setShowRemove(true)
		} else if (key.name === "p") {
			key.preventDefault()
			setShowPrune(true)
		} else if (key.name === "r" && wt) {
			key.preventDefault()
			try {
				await repairWorktree(wt.path, state.git.repoRoot)
				await refresh()
				showToast("success", `Repaired ${wt.path}`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "o" && wt) {
			key.preventDefault()
			try {
				// Open worktree in new terminal window
				const cmd = process.platform === "darwin" ? "open" : "xdg-open"
				await exec(cmd, ["-a", "Terminal", wt.path])
			} catch {
				showToast("info", `Path: ${wt.path}`)
			}
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await refresh()
		}
	})

	return (
		<box flexGrow={1} flexDirection="column">
			<box
				flexGrow={1}
				flexDirection="column"
				border
				borderColor={t.borderFocused}
				title="worktrees"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={t.textSecondary}>Loading worktrees...</text>
						</box>
					}
				>
					<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
						<For each={worktrees()}>
							{(wt, i) => {
								const isSelected = () => selectedIdx() === i()
								const shortPath = () => {
									const parts = wt.path.split("/")
									return parts.length > 3 ? `.../${parts.slice(-2).join("/")}` : wt.path
								}

								return (
									<box
										flexDirection="column"
										paddingLeft={1}
										paddingRight={1}
										paddingTop={1}
										backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
										onMouseDown={() => setSelectedIdx(i())}
									>
										<box flexDirection="row" gap={1}>
											<text fg={statusColor(wt)}>{statusIcon(wt)}</text>
											<text fg={wt.isMain ? t.success : t.accent}>{wt.branch || "(detached)"}</text>
											<Show when={wt.isMain}>
												<text fg={t.textSecondary}>(main)</text>
											</Show>
											<Show when={wt.locked}>
												<text fg={t.warning}>locked</text>
											</Show>
											<Show when={wt.prunable}>
												<text fg={t.error}>prunable</text>
											</Show>
										</box>
										<box flexDirection="row" paddingLeft={2} gap={1}>
											<text fg={t.textSecondary}>{shortPath()}</text>
											<Show when={wt.hash}>
												<text fg={t.textSecondary}>{wt.hash.slice(0, 7)}</text>
											</Show>
										</box>
									</box>
								)
							}}
						</For>

						<Show when={worktrees().length === 0 && !loading()}>
							<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
								<text fg={t.textSecondary}>No worktrees found</text>
							</box>
						</Show>
					</scrollbox>
				</Show>

				<KeyHints
					hints={[
						{ key: "n", label: "new" },
						{ key: "d", label: "remove" },
						{ key: "p", label: "prune" },
						{ key: "r", label: "repair" },
						{ key: "o", label: "open" },
					]}
				/>
			</box>

			{/* Add worktree dialog */}
			<Show when={showAdd()}>
				<InputDialog
					title="Create worktree"
					placeholder="feature/new-branch"
					onSubmit={async (name) => {
						setShowAdd(false)
						if (!name.trim()) return
						try {
							const path = `${state.git.repoRoot}/../${state.git.repoName}-${name.trim()}`
							await addWorktree(path, name.trim(), state.git.repoRoot)
							await refresh()
							showToast("success", `Created worktree at ${path}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowAdd(false)}
				/>
			</Show>

			{/* Remove worktree confirm */}
			<Show when={showRemove() && selectedWT()}>
				<ConfirmDialog
					title="Remove worktree"
					message={`Remove worktree "${selectedWT()?.branch}" at ${selectedWT()?.path}?`}
					dangerous
					onConfirm={async () => {
						setShowRemove(false)
						const wt = selectedWT()
						if (!wt) return
						try {
							await removeWorktree(wt.path, false, state.git.repoRoot)
							await refresh()
							showToast("success", `Removed worktree ${wt.branch}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowRemove(false)}
				/>
			</Show>

			{/* Prune worktrees confirm */}
			<Show when={showPrune()}>
				<ConfirmDialog
					title="Prune worktrees"
					message="Remove stale worktree administrative files?"
					onConfirm={async () => {
						setShowPrune(false)
						try {
							await pruneWorktrees(state.git.repoRoot)
							await refresh()
							showToast("success", "Pruned stale worktrees")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowPrune(false)}
				/>
			</Show>
		</box>
	)
}
