/**
 * stacks.tsx — Stacked diffs management
 * Visualize, create, navigate, sync, and submit stacks of dependent branches.
 */

import { state, showToast } from "@gubbi/core"
import { getDiffBetween, gitService } from "@gubbi/git"
import {
	getStacks,
	stackCreate,
	stackUp,
	stackDown,
	stackSync,
	stackSubmit,
	stackFold,
	stackAbsorb,
	type Stack,
	type StackBranch,
} from "@gubbi/git"
import { InputDialog, ConfirmDialog, SelectDialog } from "@gubbi/ui"
import { DiffViewer } from "@gubbi/ui"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	trunk: "#8b949e",
	current: "#58a6ff",
	branch: "#3fb950",
	prOpen: "#3fb950",
	prDraft: "#8b949e",
	prMerged: "#a371f7",
	prClosed: "#f78166",
	ciPass: "#3fb950",
	ciFail: "#f78166",
	ciPending: "#d29922",
	dim: "#8b949e",
	text: "#e6edf3",
}

function prStatusColor(status?: string): string {
	switch (status) {
		case "open":
			return C.prOpen
		case "draft":
			return C.prDraft
		case "merged":
			return C.prMerged
		case "closed":
			return C.prClosed
		default:
			return C.dim
	}
}

function prStatusIcon(status?: string): string {
	switch (status) {
		case "open":
			return "○"
		case "draft":
			return "◌"
		case "merged":
			return "●"
		case "closed":
			return "✗"
		default:
			return "○"
	}
}

export function StacksView() {
	const [stacks, setStacks] = createSignal<Stack[]>([])
	const [selectedStack, setSelectedStack] = createSignal(0)
	const [selectedBranch, setSelectedBranch] = createSignal(0)
	const [diffContent, setDiffContent] = createSignal("")
	const [showCreate, setShowCreate] = createSignal(false)
	const [showSync, setShowSync] = createSignal(false)
	const [showSubmit, setShowSubmit] = createSignal(false)
	const [showFold, setShowFold] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)
	const [loading, setLoading] = createSignal(false)

	async function loadStacks() {
		setLoading(true)
		try {
			const s = await getStacks(state.git.repoRoot)
			setStacks(s)
			// Load diff for first branch
			const firstStack = s[0]
			const firstBranch = firstStack?.branches[0]
			if (firstBranch && firstStack) {
				const parent = firstBranch.parent ?? firstStack.trunk
				const diff = await getDiffBetween(parent, firstBranch.name, state.git.repoRoot)
				setDiffContent(diff)
			}
		} catch (err) {
			showToast("error", `Failed to load stacks: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadBranchDiff(stack: Stack, branch: StackBranch) {
		try {
			const parent = branch.parent ?? stack.trunk
			const diff = await getDiffBetween(parent, branch.name, state.git.repoRoot)
			setDiffContent(diff)
		} catch {
			setDiffContent("")
		}
	}

	onMount(() => void loadStacks())

	const currentStack = () => stacks()[selectedStack()]
	const currentBranch = () => currentStack()?.branches[selectedBranch()]

	useKeyboard(async (key) => {
		if (showCreate() || showSync() || showSubmit() || showFold()) return

		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			return
		}
		if (!primaryFocused()) return

		const stack = currentStack()
		const branch = currentBranch()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			if (stack) {
				const next = Math.min(selectedBranch() + 1, stack.branches.length - 1)
				setSelectedBranch(next)
				const b = stack.branches[next]
				if (b) await loadBranchDiff(stack, b)
			}
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			const prev = Math.max(selectedBranch() - 1, 0)
			setSelectedBranch(prev)
			if (stack) {
				const b = stack.branches[prev]
				if (b) await loadBranchDiff(stack, b)
			}
		} else if (key.name === "h" || key.name === "left") {
			// Previous stack
			key.preventDefault()
			const prev = Math.max(selectedStack() - 1, 0)
			setSelectedStack(prev)
			setSelectedBranch(0)
		} else if (key.name === "l" || key.name === "right") {
			// Next stack
			key.preventDefault()
			const next = Math.min(selectedStack() + 1, stacks().length - 1)
			setSelectedStack(next)
			setSelectedBranch(0)
		} else if (key.name === "n") {
			key.preventDefault()
			setShowCreate(true)
		} else if (key.name === "u" && branch) {
			// Navigate up in stack (checkout child)
			key.preventDefault()
			try {
				const target = await stackUp(state.git.repoRoot)
				if (target) {
					showToast("info", `Moved to ${target}`)
					await loadStacks()
				}
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "d" && !key.shift && branch) {
			// Navigate down in stack (checkout parent)
			key.preventDefault()
			try {
				const target = await stackDown(state.git.repoRoot)
				if (target) {
					showToast("info", `Moved to ${target}`)
					await loadStacks()
				}
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "s" && stack) {
			key.preventDefault()
			setShowSync(true)
		} else if (key.name === "p" && stack) {
			key.preventDefault()
			setShowSubmit(true)
		} else if (key.name === "a" && stack) {
			key.preventDefault()
			try {
				const ok = await stackAbsorb(state.git.repoRoot)
				if (ok) {
					showToast("success", "Absorbed staged changes")
					await loadStacks()
				} else {
					showToast("warning", "git-absorb not installed. Install with: brew install git-absorb")
				}
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "F" && key.shift && branch) {
			key.preventDefault()
			setShowFold(true)
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadStacks()
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* Stack panel */}
			<box
				width={50}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.activeBorder : C.border}
				title="stacks"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading stacks...</text>
						</box>
					}
				>
					<Show
						when={stacks().length > 0}
						fallback={
							<box
								flexGrow={1}
								flexDirection="column"
								alignItems="center"
								justifyContent="center"
								gap={1}
							>
								<text fg={C.dim}>No stacks tracked yet</text>
								<text fg={C.dim}>Press n to create a new stacked branch</text>
								<text fg={C.dim}>or start working on a branch and gubbi will</text>
								<text fg={C.dim}>track it automatically</text>
							</box>
						}
					>
						<scrollbox flexGrow={1}>
							<For each={stacks()}>
								{(stack, si) => (
									<box flexDirection="column" paddingTop={1} paddingLeft={1}>
										{/* Stack header */}
										<text fg={C.dim}>
											Stack {si() + 1}: {stack.trunk} → {stack.branches.at(-1)?.name ?? ""}
										</text>

										{/* Branches from top to bottom (visual: top of stack at top) */}
										<For each={[...stack.branches].reverse()}>
											{(branch) => {
												const branchIdx = stack.branches.indexOf(branch)
												const isSelected = () =>
													selectedStack() === si() && selectedBranch() === branchIdx
												const isCurrent = () => branch.name === state.git.currentBranch

												// Find linked PR
												const pr = () => state.github.prs.find((p) => p.headRefName === branch.name)
												// CI status not available on GitHubPR (no checks field)
												const ci = () => null

												return (
													<box
														flexDirection="column"
														paddingLeft={2}
														backgroundColor={isSelected() ? C.selected : "transparent"}
														onMouseDown={() => {
															setSelectedStack(si())
															setSelectedBranch(branchIdx)
															void loadBranchDiff(stack, branch)
															setPrimaryFocused(true)
														}}
													>
														<box flexDirection="row" gap={1}>
															{/* Stack graph */}
															<text fg={isCurrent() ? C.current : C.branch}>
																{isCurrent() ? "⬡" : "○"}
															</text>

															{/* Branch name */}
															<text fg={isCurrent() ? C.current : C.branch}>{branch.name}</text>

															<box flexGrow={1} />

															{/* PR status */}
															<Show when={pr()}>
																<text fg={prStatusColor(branch.prStatus)}>
																	PR #{pr()!.number}
																	{pr()!.isDraft ? " (draft)" : ""}
																</text>
															</Show>

															{/* CI status */}
															<Show when={ci()}>
																<text
																	fg={
																		ci() === "passing"
																			? C.ciPass
																			: ci() === "failing"
																				? C.ciFail
																				: C.ciPending
																	}
																>
																	{ci() === "passing" ? "✓" : ci() === "failing" ? "✗" : "●"}
																</text>
															</Show>
														</box>

														{/* Commits */}
														<For each={branch.commits.slice(0, 3)}>
															{(c) => (
																<box flexDirection="row" paddingLeft={2}>
																	<text fg={C.dim}>· </text>
																	<text fg={C.dim}>{c.subject.slice(0, 50)}</text>
																</box>
															)}
														</For>
														<Show when={branch.commitCount > 3}>
															<box paddingLeft={2}>
																<text fg={C.dim}> ...and {branch.commitCount - 3} more</text>
															</box>
														</Show>
													</box>
												)
											}}
										</For>

										{/* Trunk base */}
										<box paddingLeft={2}>
											<text fg={C.trunk}>○ {stack.trunk} (base)</text>
										</box>
									</box>
								)}
							</For>
						</scrollbox>
					</Show>
				</Show>

				{/* Footer */}
				<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
					<text fg={C.dim}>
						<span style={{ fg: "#58a6ff" }}>n</span> new ·{" "}
						<span style={{ fg: "#58a6ff" }}>u/d</span> navigate ·{" "}
						<span style={{ fg: "#58a6ff" }}>s</span> sync · <span style={{ fg: "#58a6ff" }}>p</span>{" "}
						submit · <span style={{ fg: "#58a6ff" }}>a</span> absorb ·{" "}
						<span style={{ fg: "#58a6ff" }}>F</span> fold
					</text>
				</box>
			</box>

			{/* Diff panel */}
			<DiffViewer
				content={diffContent()}
				title={currentBranch() ? `diff: ${currentBranch()!.name}` : "branch diff"}
			/>

			{/* Create branch in stack */}
			<Show when={showCreate()}>
				<InputDialog
					title="Create stacked branch"
					placeholder="feature/my-feature"
					onSubmit={async (name) => {
						setShowCreate(false)
						try {
							await stackCreate(name, undefined, state.git.repoRoot)
							await Promise.all([loadStacks(), gitService.refreshBranches()])
							showToast("success", `Created stacked branch "${name}"`)
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowCreate(false)}
				/>
			</Show>

			{/* Sync confirm */}
			<Show when={showSync()}>
				<ConfirmDialog
					title="Sync stack"
					message="Pull trunk, clean merged branches, and restack all branches? This will rebase all stack branches."
					onConfirm={async () => {
						setShowSync(false)
						try {
							await stackSync(state.git.repoRoot)
							await Promise.all([loadStacks(), gitService.refreshStatus()])
							showToast("success", "Stack synced")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowSync(false)}
				/>
			</Show>

			{/* Submit stack */}
			<Show when={showSubmit() && currentStack()}>
				<SelectDialog
					title={`Submit stack: ${currentStack()?.id}`}
					options={[
						{
							label: "Submit as ready PRs",
							description: "Create/update PRs for all branches",
							value: "submit",
						},
						{
							label: "Submit as draft PRs",
							description: "Create draft PRs (not ready for review)",
							value: "draft",
						},
					]}
					onSelect={async (mode: string) => {
						setShowSubmit(false)
						const stack = currentStack()
						if (!stack) return
						try {
							await stackSubmit(stack.id, { draft: mode === "draft" }, state.git.repoRoot)
							await loadStacks()
							showToast("success", "Stack submitted")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowSubmit(false)}
				/>
			</Show>

			{/* Fold confirm */}
			<Show when={showFold() && currentBranch()}>
				<ConfirmDialog
					title="Fold branch"
					message={`Fold "${currentBranch()?.name}" into its parent? This merges the branch and removes it.`}
					onConfirm={async () => {
						setShowFold(false)
						try {
							await stackFold(state.git.repoRoot)
							await Promise.all([loadStacks(), gitService.refreshBranches()])
							showToast("success", "Branch folded into parent")
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowFold(false)}
				/>
			</Show>
		</box>
	)
}
