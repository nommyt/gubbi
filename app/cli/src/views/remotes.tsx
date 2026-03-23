/**
 * remotes.tsx — Remote management and worktrees
 */

import { state, showToast, useTheme } from "@gubbi/core"
import { InputDialog, ConfirmDialog, KeyHints } from "@gubbi/core/tui"
import {
	getRemotes,
	fetch,
	getWorktrees,
	addWorktree,
	removeWorktree,
	gitService,
	type WorktreeEntry,
} from "@gubbi/git"
import type { RemoteEntry } from "@gubbi/git"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

export function RemotesView() {
	const t = useTheme()
	const [remotes, setRemotes] = createSignal<RemoteEntry[]>([])
	const [worktrees, setWorktrees] = createSignal<WorktreeEntry[]>([])
	const [selectedSection, setSelectedSection] = createSignal<"remotes" | "worktrees">("remotes")
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [showAddWorktree, setShowAddWorktree] = createSignal(false)
	const [showRemoveWorktree, setShowRemoveWorktree] = createSignal(false)
	const [_loading, setLoading] = createSignal(false)

	async function loadData() {
		setLoading(true)
		try {
			const [r, w] = await Promise.all([
				getRemotes(state.git.repoRoot),
				getWorktrees(state.git.repoRoot),
			])
			setRemotes(r)
			setWorktrees(w)
		} catch (err) {
			showToast("error", `Failed to load remotes: ${String(err)}`)
		} finally {
			setLoading(false)
		}
	}

	onMount(() => void loadData())

	const items = () => (selectedSection() === "remotes" ? remotes() : worktrees())

	useKeyboard(async (key) => {
		if (showAddWorktree() || showRemoveWorktree()) return

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, items().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "tab") {
			key.preventDefault()
			setSelectedSection((s) => (s === "remotes" ? "worktrees" : "remotes"))
			setSelectedIdx(0)
		} else if (key.name === "f" && selectedSection() === "remotes") {
			key.preventDefault()
			const remote = remotes()[selectedIdx()]
			if (!remote) return
			try {
				await fetch(remote.name, { prune: true }, state.git.repoRoot)
				await gitService.refreshStatus()
				showToast("success", `Fetched from ${remote.name}`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "n" && selectedSection() === "worktrees") {
			key.preventDefault()
			setShowAddWorktree(true)
		} else if (key.name === "D" && key.shift && selectedSection() === "worktrees") {
			key.preventDefault()
			setShowRemoveWorktree(true)
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadData()
		}
	})

	return (
		<box flexGrow={1} flexDirection="column">
			<box flexGrow={1} flexDirection="row">
				{/* Remotes section */}
				<box
					width={50}
					flexDirection="column"
					border
					borderColor={selectedSection() === "remotes" ? t.borderFocused : t.border}
					title="remotes"
				>
					<scrollbox flexGrow={1}>
						<For each={remotes()}>
							{(remote, i) => {
								const isSelected = () => selectedSection() === "remotes" && selectedIdx() === i()
								return (
									<box
										flexDirection="column"
										paddingLeft={1}
										paddingTop={1}
										backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
										onMouseDown={() => {
											setSelectedSection("remotes")
											setSelectedIdx(i())
										}}
									>
										<text fg={t.accent}>{remote.name}</text>
										<text fg={t.textSecondary} paddingLeft={2}>
											{remote.fetchUrl}
										</text>
									</box>
								)
							}}
						</For>
						<Show when={remotes().length === 0}>
							<box paddingLeft={1} paddingTop={2}>
								<text fg={t.textSecondary}>No remotes configured</text>
							</box>
						</Show>
					</scrollbox>
					<KeyHints
						hints={[
							{ key: "f", label: "fetch" },
							{ key: "Tab", label: "worktrees" },
						]}
					/>
				</box>

				{/* Worktrees section */}
				<box
					flexGrow={1}
					flexDirection="column"
					border
					borderColor={selectedSection() === "worktrees" ? t.borderFocused : t.border}
					title="worktrees"
				>
					<scrollbox flexGrow={1}>
						<For each={worktrees()}>
							{(wt, i) => {
								const isSelected = () => selectedSection() === "worktrees" && selectedIdx() === i()
								const isCurrent = () => wt.path === state.git.repoRoot
								return (
									<box
										flexDirection="column"
										paddingLeft={1}
										paddingTop={1}
										backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
										onMouseDown={() => {
											setSelectedSection("worktrees")
											setSelectedIdx(i())
										}}
									>
										<text fg={isCurrent() ? t.success : t.accent}>
											{isCurrent() ? "* " : "  "}
											{wt.path.split("/").slice(-2).join("/")}
										</text>
										<box flexDirection="row" paddingLeft={2} gap={1}>
											<text fg={t.textSecondary}>{wt.branch || "(detached)"}</text>
											<text fg={t.textSecondary}>{wt.hash.slice(0, 7)}</text>
											<Show when={wt.locked}>
												<text fg={t.textSecondary}>locked</text>
											</Show>
										</box>
									</box>
								)
							}}
						</For>
						<Show when={worktrees().length === 0}>
							<box paddingLeft={1} paddingTop={2}>
								<text fg={t.textSecondary}>No additional worktrees</text>
								<text fg={t.textSecondary}>Press n to add one</text>
							</box>
						</Show>
					</scrollbox>
					<KeyHints
						hints={[
							{ key: "n", label: "add" },
							{ key: "D", label: "remove" },
						]}
					/>
				</box>
			</box>

			{/* Dialogs */}
			<Show when={showAddWorktree()}>
				<InputDialog
					title="Add worktree (path)"
					placeholder="../my-worktree"
					onSubmit={async (path) => {
						setShowAddWorktree(false)
						try {
							await addWorktree(path, state.git.currentBranch, state.git.repoRoot)
							await loadData()
							showToast("success", `Added worktree at ${path}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowAddWorktree(false)}
				/>
			</Show>

			<Show when={showRemoveWorktree()}>
				<ConfirmDialog
					title="Remove worktree"
					message={`Remove worktree at "${worktrees()[selectedIdx()]?.path}"?`}
					dangerous
					onConfirm={async () => {
						setShowRemoveWorktree(false)
						const wt = worktrees()[selectedIdx()]
						if (!wt) return
						try {
							await removeWorktree(wt.path, false, state.git.repoRoot)
							await loadData()
							showToast("success", "Worktree removed")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowRemoveWorktree(false)}
				/>
			</Show>
		</box>
	)
}
