/**
 * @gubbi/plugin-dashboard — Dashboard and Smartlog views
 */

import type { GubbiPlugin } from "@gubbi/core"

import { DashboardView } from "./dashboard.tsx"
import { SmartlogView } from "./smartlog.tsx"

const plugin: GubbiPlugin = {
	id: "dashboard",
	name: "Dashboard",
	version: "0.1.0",

	activate(ctx) {
		// Dashboard view - always available
		ctx.registerView({
			id: "dashboard",
			label: "Dashboard",
			shortcut: "d",
			component: DashboardView,
		})

		// Smartlog view - only in git repos
		ctx.registerView({
			id: "smartlog",
			label: "Smartlog",
			shortcut: "1",
			component: SmartlogView,
			condition: () => ctx.state.git.isRepo,
		})
	},
}

export default plugin
