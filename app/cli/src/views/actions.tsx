/**
 * actions.tsx — GitHub Actions workflow runs: list, status, logs, re-run
 */

import { state, showToast, icons, useInterval } from "@gubbi/core"
import { openURL } from "@gubbi/git"
import {
	listRuns,
	getRunLogs,
	rerunRun,
	listWorkflows,
	triggerWorkflow,
	type WorkflowRun,
} from "@gubbi/github"
import { SelectDialog, InputDialog } from "@gubbi/tui"
import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount, onCleanup } from "solid-js"

const C = {
	border: "#30363d",
	activeBorder: "#388bfd",
	selected: "#1f2937",
	success: "#3fb950",
	failure: "#f78166",
	running: "#d29922",
	cancelled: "#8b949e",
	dim: "#8b949e",
	text: "#e6edf3",
	branch: "#58a6ff",
}

function statusColor(run: WorkflowRun): string {
	if (run.status === "in_progress") return C.running
	if (run.conclusion === "success") return C.success
	if (run.conclusion === "failure" || run.conclusion === "timed_out") return C.failure
	if (run.conclusion === "cancelled") return C.cancelled
	return C.dim
}

function statusIcon(run: WorkflowRun): string {
	if (run.status === "in_progress") return icons.sync
	if (run.status === "queued") return icons.clock
	if (run.conclusion === "success") return icons.check
	if (run.conclusion === "failure" || run.conclusion === "timed_out") return icons.circleSlash
	if (run.conclusion === "cancelled") return icons.circleSlash
	if (run.conclusion === "skipped") return "—"
	return icons.circle
}

function formatDate(iso: string): string {
	try {
		const d = new Date(iso)
		const now = new Date()
		const diff = (now.getTime() - d.getTime()) / 1000
		if (diff < 60) return `${Math.floor(diff)}s ago`
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
		return `${Math.floor(diff / 86400)}d ago`
	} catch {
		return iso
	}
}

export function ActionsView() {
	const [runs, setRuns] = createSignal<WorkflowRun[]>([])
	const [selectedIdx, setSelectedIdx] = createSignal(0)
	const [logs, setLogs] = createSignal("")
	const [loading, setLoading] = createSignal(true)
	const [loadingLogs, setLoadingLogs] = createSignal(false)
	const [primaryFocused, setPrimaryFocused] = createSignal(true)
	const [watchingRunId, setWatchingRunId] = createSignal<number | null>(null)
	const [autoRefresh, setAutoRefresh] = createSignal(false)
	const [showTrigger, setShowTrigger] = createSignal(false)
	const [workflows, setWorkflows] = createSignal<Array<{ label: string; value: string }>>([])

	const selectedRun = () => runs()[selectedIdx()]

	async function loadRuns() {
		setLoading(true)
		try {
			const list = await listRuns({ limit: 30 })
			setRuns(list)
		} catch (err) {
			showToast("error", `Failed to load runs: ${err}`)
		} finally {
			setLoading(false)
		}
	}

	async function loadLogs(run: WorkflowRun) {
		setLoadingLogs(true)
		try {
			const log = await getRunLogs(run.id)
			setLogs(log.slice(0, 50_000)) // Limit for display
		} catch {
			setLogs("(failed to load logs)")
		} finally {
			setLoadingLogs(false)
		}
	}

	onMount(() => void loadRuns())

	// Watch: poll every 5s until the watched run completes
	let watchInterval: ReturnType<typeof setInterval> | null = null

	function startWatching(runId: number) {
		setWatchingRunId(runId)
		watchInterval = setInterval(async () => {
			await loadRuns()
			const run = runs().find((r) => r.id === runId)
			if (!run || run.status !== "in_progress") {
				stopWatching()
				if (run) showToast("success", `${run.workflowName}: ${run.conclusion ?? run.status}`)
			}
		}, 5000)
	}

	function stopWatching() {
		if (watchInterval) {
			clearInterval(watchInterval)
			watchInterval = null
		}
		setWatchingRunId(null)
	}

	onCleanup(() => stopWatching())

	// Auto-refresh: poll every 15s
	useInterval(async () => {
		if (autoRefresh()) await loadRuns()
	}, 15000)

	useKeyboard(async (key) => {
		if (key.name === "tab") {
			key.preventDefault()
			setPrimaryFocused((p) => !p)
			return
		}
		if (!primaryFocused()) return

		const run = selectedRun()

		if (key.name === "j" || key.name === "down") {
			key.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, runs().length - 1))
		} else if (key.name === "k" || key.name === "up") {
			key.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (key.name === "enter" && run) {
			key.preventDefault()
			await loadLogs(run)
		} else if (key.name === "r" && run) {
			key.preventDefault()
			try {
				await rerunRun(run.id, true)
				showToast("success", `Re-running workflow: ${run.name}`)
				await loadRuns()
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.name === "o" && run) {
			key.preventDefault()
			await openURL(run.url)
		} else if (key.name === "w" && run) {
			key.preventDefault()
			if (watchingRunId() === run.id) {
				stopWatching()
				showToast("info", "Stopped watching")
			} else {
				startWatching(run.id)
				showToast("info", `Watching ${run.workflowName}...`)
			}
		} else if (key.ctrl && key.name === "l") {
			key.preventDefault()
			setAutoRefresh((v) => !v)
			showToast("info", autoRefresh() ? "Auto-refresh on (15s)" : "Auto-refresh off")
		} else if (key.name === "t") {
			key.preventDefault()
			try {
				const wfs = await listWorkflows()
				if (wfs.length === 0) {
					showToast("info", "No workflows found")
					return
				}
				setWorkflows(wfs.map((w) => ({ label: w.name, value: w.path })))
				setShowTrigger(true)
			} catch (err) {
				showToast("error", String(err))
			}
		} else if (key.ctrl && key.name === "r") {
			key.preventDefault()
			await loadRuns()
		}
	})

	return (
		<box flexGrow={1} flexDirection="row">
			{/* Run list */}
			<box
				width={55}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.activeBorder : C.border}
				title="github actions"
			>
				<Show
					when={!loading()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading runs...</text>
						</box>
					}
				>
					<Show
						when={state.github.isAuthenticated}
						fallback={
							<box flexGrow={1} alignItems="center" justifyContent="center" gap={1}>
								<text fg={C.dim}>GitHub not authenticated</text>
								<text fg={C.dim}>Install gh and ensure you are logged in</text>
							</box>
						}
					>
						<scrollbox flexGrow={1} scrollbarOptions={{ visible: true }}>
							<For each={runs()}>
								{(run, i) => {
									const isSelected = () => selectedIdx() === i()
									return (
										<box
											flexDirection="column"
											paddingLeft={1}
											paddingRight={1}
											paddingTop={1}
											backgroundColor={isSelected() ? C.selected : "transparent"}
											onMouseDown={() => {
												setSelectedIdx(i())
												setPrimaryFocused(true)
											}}
										>
											<box flexDirection="row" gap={1}>
												<text fg={statusColor(run)}>{statusIcon(run)}</text>
												<text fg={isSelected() ? "#e6edf3" : C.text}>{run.workflowName}</text>
												<Show when={watchingRunId() === run.id}>
													<text fg={C.running}> {icons.circleFilled} watching</text>
												</Show>
												<box flexGrow={1} />
												<text fg={C.dim}>{formatDate(run.updatedAt)}</text>
											</box>
											<box flexDirection="row" paddingLeft={2} gap={1}>
												<text fg={C.branch}>
													{icons.branch} {run.branch}
												</text>
												<text fg={C.dim}>{run.event}</text>
												<text fg={C.dim}>{run.headSha.slice(0, 7)}</text>
											</box>
										</box>
									)
								}}
							</For>

							<Show when={runs().length === 0 && !loading()}>
								<box flexGrow={1} alignItems="center" justifyContent="center" paddingTop={4}>
									<text fg={C.dim}>No workflow runs</text>
								</box>
							</Show>
						</scrollbox>
					</Show>
				</Show>

				<box height={1} paddingLeft={1} border={["top"]} borderColor={C.border}>
					<text fg={C.dim}>
						<span style={{ fg: "#58a6ff" }}>Enter</span> logs ·{" "}
						<span style={{ fg: "#58a6ff" }}>t</span> trigger ·{" "}
						<span style={{ fg: "#58a6ff" }}>r</span> re-run ·{" "}
						<span style={{ fg: "#58a6ff" }}>w</span> watch ·{" "}
						<span style={{ fg: "#58a6ff" }}>^l</span> auto-refresh ·{" "}
						<span style={{ fg: "#58a6ff" }}>o</span> open
					</text>
					<Show when={autoRefresh()}>
						<text fg={C.running}> {icons.sync} auto</text>
					</Show>
				</box>
			</box>

			{/* Logs panel */}
			<box
				flexGrow={1}
				flexDirection="column"
				border
				borderColor={primaryFocused() ? C.border : C.activeBorder}
				title={selectedRun() ? `logs: ${selectedRun()!.workflowName}` : "logs"}
			>
				<Show
					when={!loadingLogs()}
					fallback={
						<box flexGrow={1} alignItems="center" justifyContent="center">
							<text fg={C.dim}>Loading logs...</text>
						</box>
					}
				>
					<Show
						when={logs()}
						fallback={
							<box flexGrow={1} alignItems="center" justifyContent="center">
								<text fg={C.dim}>Press Enter to load logs</text>
							</box>
						}
					>
						<scrollbox
							flexGrow={1}
							scrollbarOptions={{ visible: true }}
							stickyScroll={false}
							paddingLeft={1}
							paddingRight={1}
							paddingTop={1}
						>
							<text fg={C.text}>{logs()}</text>
						</scrollbox>
					</Show>
				</Show>
			</box>

			{/* Trigger workflow dialog */}
			<Show when={showTrigger()}>
				<SelectDialog
					title="Trigger workflow"
					options={workflows()}
					onSelect={async (wfPath: string) => {
						setShowTrigger(false)
						const branch = state.git.currentBranch
						try {
							showToast("info", "Triggering workflow...")
							const ok = await triggerWorkflow(wfPath, branch)
							if (ok) {
								showToast("success", "Workflow triggered")
								await loadRuns()
							} else {
								showToast("error", "Failed to trigger workflow")
							}
						} catch (err) {
							showToast("error", String(err))
						}
					}}
					onCancel={() => setShowTrigger(false)}
				/>
			</Show>
		</box>
	)
}
