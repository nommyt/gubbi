/**
 * @gubbi/plugin-github — GitHub views (PRs, Issues, Actions, Notifications)
 */

import type { GubbiPlugin } from "@gubbi/core"

import { PullRequestsView } from "./pull-requests.tsx"
import { IssuesView } from "./issues.tsx"
import { ActionsView } from "./actions.tsx"
import { NotificationsView } from "./notifications.tsx"

const plugin: GubbiPlugin = {
  id: "github",
  name: "GitHub",
  version: "0.1.0",

  activate(ctx) {
    // PRs view
    ctx.registerView({
      id: "prs",
      label: "Pull Requests",
      shortcut: "7",
      component: PullRequestsView,
      condition: () => ctx.state.github.isAuthenticated,
    })

    // Issues view
    ctx.registerView({
      id: "issues",
      label: "Issues",
      shortcut: "8",
      component: IssuesView,
      condition: () => ctx.state.github.isAuthenticated,
    })

    // Actions view
    ctx.registerView({
      id: "actions",
      label: "Actions",
      shortcut: "9",
      component: ActionsView,
      condition: () => ctx.state.github.isAuthenticated,
    })

    // Notifications view
    ctx.registerView({
      id: "notifications",
      label: "Notifs",
      shortcut: "n",
      component: NotificationsView,
      condition: () => ctx.state.github.isAuthenticated,
      badge: () => ctx.state.github.unreadNotificationCount,
    })
  },
}

export default plugin
