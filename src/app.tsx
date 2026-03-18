/**
 * app.tsx — Root application component
 *
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ Header                                       │
 * ├────────┬────────────────────────────────────┤
 * │Sidebar │ Active View                         │
 * ├────────┴────────────────────────────────────┤
 * │ Status Bar                                   │
 * └─────────────────────────────────────────────┘
 */

import { Switch, Match, Show, onMount } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { state, setState, setView, setFocus, VIEWS } from "./lib/store.ts"
import { useGitInit, useGitAutoRefresh, refreshAll } from "./hooks/use-git.ts"
import { useGhInit, useGhAutoRefresh } from "./hooks/use-gh.ts"

import { Header } from "./components/header.tsx"
import { Sidebar } from "./components/sidebar.tsx"
import { StatusBar } from "./components/status-bar.tsx"
import { HelpOverlay } from "./components/dialog.tsx"

import { SmartlogView } from "./views/smartlog.tsx"
import { StatusView } from "./views/status.tsx"
import { LogView } from "./views/log.tsx"
import { BranchesView } from "./views/branches.tsx"
import { StacksView } from "./views/stacks.tsx"
import { StashView } from "./views/stash.tsx"
import { PullRequestsView } from "./views/pull-requests.tsx"
import { IssuesView } from "./views/issues.tsx"
import { ActionsView } from "./views/actions.tsx"
import { NotificationsView } from "./views/notifications.tsx"
import { RemotesView } from "./views/remotes.tsx"

export function App() {
  const renderer = useRenderer()

  // Initialize git + gh state
  useGitInit()
  useGhInit()

  // Set up auto-refresh
  useGitAutoRefresh()
  useGhAutoRefresh()

  // Global keybindings
  useKeyboard((key) => {
    // View switching by number key
    if (!key.ctrl && !key.shift) {
      const viewByKey = VIEWS.find(v => v.key === key.name)
      if (viewByKey) {
        key.preventDefault()
        setView(viewByKey.id)
        setFocus("primary")
        return
      }
    }

    // Help overlay
    if (key.name === "?") {
      key.preventDefault()
      setState("helpVisible", v => !v)
      return
    }

    // Quit
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      renderer.destroy()
      return
    }

    // Global refresh
    if (key.ctrl && key.name === "r") {
      key.preventDefault()
      void refreshAll()
      return
    }

    // Tab to cycle panel focus
    if (key.name === "tab" && !key.ctrl) {
      key.preventDefault()
      setState("focusedPanel", p => {
        if (p === "sidebar") return "primary"
        if (p === "primary") return "detail"
        return "sidebar"
      })
      return
    }

    // Sidebar focus: h goes to sidebar
    if (key.name === "escape" || key.name === "q") {
      if (state.helpVisible) {
        setState("helpVisible", false)
        return
      }
    }
  })

  return (
    <box flexDirection="column" height="100%">
      {/* Header */}
      <Header />

      {/* Main area: sidebar + content */}
      <box flexGrow={1} flexDirection="row">
        {/* Sidebar */}
        <Sidebar focused={state.focusedPanel === "sidebar"} />

        {/* Active view */}
        <box flexGrow={1}>
          <Show when={!state.isGitRepo}>
            <box flexGrow={1} alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
              <text fg="#58a6ff">⬡ gub</text>
              <text fg="#8b949e">Not inside a git repository</text>
              <text fg="#484f58">Navigate to a git repo and run gub</text>
            </box>
          </Show>

          <Show when={state.isGitRepo}>
            <Switch>
              <Match when={state.currentView === "smartlog"}>
                <SmartlogView />
              </Match>
              <Match when={state.currentView === "status"}>
                <StatusView />
              </Match>
              <Match when={state.currentView === "log"}>
                <LogView />
              </Match>
              <Match when={state.currentView === "branches"}>
                <BranchesView />
              </Match>
              <Match when={state.currentView === "stacks"}>
                <StacksView />
              </Match>
              <Match when={state.currentView === "stash"}>
                <StashView />
              </Match>
              <Match when={state.currentView === "prs"}>
                <PullRequestsView />
              </Match>
              <Match when={state.currentView === "issues"}>
                <IssuesView />
              </Match>
              <Match when={state.currentView === "actions"}>
                <ActionsView />
              </Match>
              <Match when={state.currentView === "notifications"}>
                <NotificationsView />
              </Match>
              <Match when={state.currentView === "remotes"}>
                <RemotesView />
              </Match>
            </Switch>
          </Show>
        </box>
      </box>

      {/* Status bar */}
      <StatusBar />

      {/* Help overlay */}
      <Show when={state.helpVisible}>
        <HelpOverlay onClose={() => setState("helpVisible", false)} />
      </Show>
    </box>
  )
}
