/**
 * actions.tsx — GitHub Actions workflow runs: list, status, logs, re-run
 */

import { useKeyboard } from "@opentui/solid"
import { createSignal, For, Show, onMount } from "solid-js"

import { listRuns, getRunLogs, rerunRun, type WorkflowRun } from "../lib/gh.ts"
import { exec } from "../lib/shell.ts"
import { state, showToast } from "../lib/store.ts"

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
	if (run.status === "in_progress") return "●"
	if (run.status === "queued") return "○"
	if (run.conclusion === "success") return "✓"
	if (run.conclusion === "failure" || run.conclusion === "timed_out") return "✗"
	if (run.conclusion === "cancelled") return "⊘"
	if (run.conclusion === "skipped") return "—"
	return "○"
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
			await exec("open", [run.url])
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
						when={state.isGhAuthenticated}
						fallback={
							<box flexGrow={1} alignItems="center" justifyContent="center" gap={1}>
								<text fg={C.dim}>GitHub not authenticated</text>
								<text fg={C.dim}>Run: gh auth login</text>
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
												<box flexGrow={1} />
												<text fg={C.dim}>{formatDate(run.updatedAt)}</text>
											</box>
											<box flexDirection="row" paddingLeft={2} gap={1}>
												<text fg={C.branch}>⎇ {run.branch}</text>
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
						<span style={{ fg: "#58a6ff" }}>r</span> re-run ·{" "}
						<span style={{ fg: "#58a6ff" }}>o</span> open
					</text>
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
		</box>
	)
}
