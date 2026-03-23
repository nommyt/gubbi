/**
 * branches.tsx — Branch management: list, checkout, create, delete, merge, rebase, push
 */

import { state, showToast, updateToast, setView, icons, useTheme } from "@gubbi/core"
import type { GitHubPR } from "@gubbi/core"
import { InputDialog, SelectDialog, ConfirmDialog, KeyHints } from "@gubbi/core/tui"
import {
	getBranches,
	checkout,
	createBranch,
	deleteBranch,
	mergeBranch,
	rebaseBranch,
	push,
	gitService,
	openURL,
} from "@gubbi/git"
import type { BranchEntry } from "@gubbi/git"
import { createPR, mergePR, githubService } from "@gubbi/github"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

export function BranchesView() {
	const t = useTheme()
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [showCreate, setShowCreate] = createSignal(false)
	const [showDelete, setShowDelete] = createSignal(false)
	const [showMerge, setShowMerge] = createSignal(false)
	const [showRebase, setShowRebase] = createSignal(false)
	const [showMergePR, setShowMergePR] = createSignal(false)
	const [_showAction, _setShowAction] = createSignal(false)
	const [filter, _setFilter] = createSignal("")

	const [allBranches, setAllBranches] = createSignal<BranchEntry[]>([])

	const branches = () => {
		const q = filter().toLowerCase()
		if (!q) return allBranches()
		return allBranches().filter((b) => b.name.toLowerCase().includes(q))
	}
	const selectedBranch = () => branches()[selectedIdx()]

	const branchPRs = () => {
		const map = new Map<string, GitHubPR>()
		for (const pr of state.github.prs) {
			if (pr.state === "OPEN") map.set(pr.headRefName, pr)
		}
		return map
	}

	async function refreshBranches() {
		const list = await getBranches(state.git.repoRoot)
		setAllBranches(list)
	}

	onMount(() => {
		void refreshBranches()
		if (state.github.isAuthenticated) void githubService.refreshPRs()
	})

	useKeyboard(async (key) => {
		if (showCreate() || showDelete() || showMerge() || showRebase() || showMergePR()) return

		const branch = selectedBranch()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, branches().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "g") {
			key.preventDefault()
			setSelectedIdx(0)
		} else if (key.name === "G") {
			key.preventDefault()
			setSelectedIdx(Math.max(branches().length - 1, 0))
		} else if (key.name === "enter" && branch && !branch.current) {
			key.preventDefault()
			try {
				await checkout(branch.name, state.git.repoRoot)
				await Promise.all([refreshBranches(), gitService.refreshStatus()])
				showToast("success", `Switched to ${branch.name}`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "n") {
			key.preventDefault()
			setShowCreate(true)
		} else if (key.name === "D" && key.shift && branch && !branch.current) {
			key.preventDefault()
			setShowDelete(true)
		} else if (key.name === "m" && branch) {
			key.preventDefault()
			setShowMerge(true)
		} else if (key.name === "r" && branch) {
			key.preventDefault()
			setShowRebase(true)
		} else if (key.name === "p" && branch && !branch.remote) {
			key.preventDefault()
			try {
				await push({ branch: branch.name, setUpstream: !branch.upstream }, state.git.repoRoot)
				await refreshBranches()
				showToast("success", `Pushed ${branch.name}`)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "P" && key.shift && branch && !branch.remote) {
			// Push + create PR if none exists
			key.preventDefault()
			const toastId = showToast("info", `Pushing ${branch.name}...`, 0)
			try {
				await push({ branch: branch.name, setUpstream: !branch.upstream }, state.git.repoRoot)
				const existingPR = branchPRs().get(branch.name)
				if (!existingPR && state.github.isAuthenticated) {
					updateToast(toastId, "info", "Creating PR...", 0)
					const created = await createPR({
						title: branch.name,
						body: "",
						base: state.git.defaultBranch,
					})
					if (created) {
						updateToast(toastId, "info", "Updating PR list...", 0)
						await githubService.refreshPRs()
						updateToast(toastId, "success", `Pushed and created PR #${created.number}`)
					} else {
						updateToast(toastId, "error", "Push succeeded but PR creation failed")
					}
				} else {
					await refreshBranches()
					updateToast(toastId, "success", `Pushed ${branch.name}`)
				}
			} catch (err) {
				updateToast(toastId, "error", String(err))
			}
		} else if (key.name === "v" && branch) {
			// Open PR in browser
			key.preventDefault()
			const pr = branchPRs().get(branch.name)
			if (pr) await openURL(pr.url)
			else showToast("info", "No open PR for this branch")
		} else if (key.name === "M" && key.shift && branch) {
			// Merge PR for selected branch
			key.preventDefault()
			const pr = branchPRs().get(branch.name)
			if (!pr) showToast("info", "No open PR for this branch")
			else setShowMergePR(true)
		} else if (key.name === "V" && key.shift && branch) {
			// Jump to PR view
			key.preventDefault()
			const pr = branchPRs().get(branch.name)
			if (pr) setView("prs")
			else showToast("info", "No open PR for this branch")
		} else if (key.name === "/" || key.name === "f") {
			key.preventDefault()
			_setShowAction(true)
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await refreshBranches()
		}
	})

	const localBranches = () => branches().filter((b) => !b.remote)
	const remoteBranches = () => branches().filter((b) => b.remote)

	function BranchRow(props: { branch: BranchEntry; idx: number }) {
		const isSelected = () => {
			const globalIdx = branches().indexOf(props.branch)
			return selectedIdx() === globalIdx
		}
		const pr = () => branchPRs().get(props.branch.name)

		return (
			<box
				flexDirection="row"
				paddingLeft={2}
				paddingRight={1}
				gap={1}
				backgroundColor={isSelected() ? t.bgTertiary : "transparent"}
				onMouseDown={() => {
					const idx = branches().indexOf(props.branch)
					setSelectedIdx(idx)
				}}
			>
				{/* Current indicator */}
				<text fg={props.branch.current ? t.success : t.textSecondary}>
					{props.branch.current ? "*" : " "}
				</text>

				{/* Branch name */}
				<text fg={props.branch.current ? t.success : props.branch.remote ? t.warning : t.text}>
					{props.branch.name}
				</text>

				{/* PR badge */}
				<Show when={pr()}>
					<text fg={pr()?.isDraft ? t.textSecondary : t.success}>
						PR #{pr()?.number} {pr()?.isDraft ? "" : ""}
					</text>
					<Show when={(pr()?.checks.length ?? 0) > 0}>
						{(() => {
							const checks = pr()?.checks ?? []
							const fail = checks.some(
								(c) => c.conclusion === "FAILURE" || c.conclusion === "TIMED_OUT",
							)
							const pending = checks.some(
								(c) => c.status === "IN_PROGRESS" || c.status === "QUEUED",
							)
							if (fail) return <text fg={t.error}>{icons.circleSlash}</text>
							if (pending) return <text fg={t.textSecondary}>{icons.sync}</text>
							return <text fg={t.success}>{icons.check}</text>
						})()}
					</Show>
				</Show>

				<box flexGrow={1} />

				{/* Ahead/behind */}
				<Show when={props.branch.ahead > 0}>
					<text fg={t.success}>↑{props.branch.ahead}</text>
				</Show>
				<Show when={props.branch.behind > 0}>
					<text fg={t.error}>↓{props.branch.behind}</text>
				</Show>

				{/* Last commit */}
				<text fg={t.textSecondary}>{props.branch.lastCommitDate}</text>

				{/* Short subject */}
				<text fg={t.textSecondary}>{props.branch.lastCommitSubject.slice(0, 30)}</text>
			</box>
		)
	}

	return (
		<box flexGrow={1} flexDirection="column">
			<box
				flexGrow={1}
				flexDirection="column"
				border
				borderColor={t.borderFocused}
				title="branches"
			>
				<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
					{/* Local branches */}
					<box paddingLeft={1} paddingTop={1}>
						<text fg={t.accent}>Local branches ({localBranches().length})</text>
					</box>
					<For each={localBranches()}>{(branch, i) => <BranchRow branch={branch} idx={i()} />}</For>

					{/* Remote branches */}
					<Show when={remoteBranches().length > 0}>
						<box paddingLeft={1} paddingTop={1}>
							<text fg={t.warning}>Remote branches ({remoteBranches().length})</text>
						</box>
						<For each={remoteBranches()}>
							{(branch, i) => <BranchRow branch={branch} idx={localBranches().length + i()} />}
						</For>
					</Show>
				</scrollbox>

				{/* Footer */}
				<KeyHints
					hints={[
						{ key: "Enter", label: "checkout" },
						{ key: "n", label: "new" },
						{ key: "D", label: "delete" },
						{ key: "m", label: "merge" },
						{ key: "r", label: "rebase" },
						{ key: "p", label: "push" },
						{ key: "P", label: "push·PR" },
						{ key: "v", label: "open PR" },
						{ key: "M", label: "merge PR" },
					]}
				/>
			</box>

			{/* Create branch */}
			<Show when={showCreate()}>
				<InputDialog
					title="Create new branch"
					placeholder="feature/my-branch"
					onSubmit={async (name) => {
						setShowCreate(false)
						try {
							await createBranch(name, undefined, true, state.git.repoRoot)
							await refreshBranches()
							showToast("success", `Created and switched to "${name}"`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowCreate(false)}
				/>
			</Show>

			{/* Delete branch */}
			<Show when={showDelete() && selectedBranch()}>
				<ConfirmDialog
					title="Delete branch"
					message={`Delete branch "${selectedBranch()?.name}"?`}
					dangerous
					onConfirm={async () => {
						setShowDelete(false)
						const branch = selectedBranch()
						if (!branch) return
						try {
							await deleteBranch(branch.name, false, state.git.repoRoot)
							await refreshBranches()
							showToast("success", `Deleted branch "${branch.name}"`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowDelete(false)}
				/>
			</Show>

			{/* Merge branch */}
			<Show when={showMerge() && selectedBranch()}>
				<SelectDialog
					title={`Merge "${selectedBranch()?.name}" into current branch`}
					options={[
						{
							label: "Merge commit",
							description: "Create a merge commit (--no-ff)",
							value: "merge",
						},
						{ label: "Squash merge", description: "Squash all commits into one", value: "squash" },
					]}
					onSelect={async (method) => {
						setShowMerge(false)
						const branch = selectedBranch()
						if (!branch) return
						try {
							await mergeBranch(
								branch.name,
								{ noFF: method === "merge", squash: method === "squash" },
								state.git.repoRoot,
							)
							await gitService.refreshStatus()
							showToast("success", `Merged ${branch.name}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowMerge(false)}
				/>
			</Show>

			{/* Rebase */}
			<Show when={showRebase() && selectedBranch()}>
				<ConfirmDialog
					title="Rebase onto branch"
					message={`Rebase current branch onto "${selectedBranch()?.name}"?`}
					onConfirm={async () => {
						setShowRebase(false)
						const branch = selectedBranch()
						if (!branch) return
						try {
							await rebaseBranch(branch.name, {}, state.git.repoRoot)
							await gitService.refreshStatus()
							showToast("success", `Rebased onto ${branch.name}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowRebase(false)}
				/>
			</Show>
			{/* Merge PR */}
			<Show when={showMergePR() && selectedBranch()}>
				<SelectDialog
					title={`Merge PR for "${selectedBranch()?.name}"`}
					options={[
						{ label: "Squash and merge", description: "Squash commits and merge", value: "squash" },
						{ label: "Merge commit", description: "Create a merge commit", value: "merge" },
						{ label: "Rebase and merge", description: "Rebase commits and merge", value: "rebase" },
					]}
					onSelect={async (method) => {
						setShowMergePR(false)
						const branch = selectedBranch()
						if (!branch) return
						const pr = branchPRs().get(branch.name)
						if (!pr) return
						try {
							await mergePR(pr.number, method as "merge" | "squash" | "rebase", {
								deleteAfterMerge: true,
							})
							await Promise.all([refreshBranches(), githubService.refreshPRs()])
							showToast("success", `Merged PR #${pr.number}`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowMergePR(false)}
				/>
			</Show>
		</box>
	)
}
