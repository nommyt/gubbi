/**
 * @gubbi/plugin-repo — Repository operations views
 */

import type { GubbiPlugin } from "@gubbi/core"

import { BranchesView } from "./branches.tsx"
import { LogView } from "./log.tsx"
import { RemotesView } from "./remotes.tsx"
import { StashView } from "./stash.tsx"
import { StatusView } from "./status.tsx"

const plugin: GubbiPlugin = {
	id: "repo",
	name: "Repository",
	version: "0.1.0",

	activate(ctx) {
		// Status view
		ctx.registerView({
			id: "status",
			label: "Status",
			shortcut: "2",
			component: StatusView,
			condition: () => ctx.state.git.isRepo,
		})

		// Log view
		ctx.registerView({
			id: "log",
			label: "Log",
			shortcut: "3",
			component: LogView,
			condition: () => ctx.state.git.isRepo,
		})

		// Branches view
		ctx.registerView({
			id: "branches",
			label: "Branches",
			shortcut: "4",
			component: BranchesView,
			condition: () => ctx.state.git.isRepo,
		})

		// Stash view
		ctx.registerView({
			id: "stash",
			label: "Stash",
			shortcut: "6",
			component: StashView,
			condition: () => ctx.state.git.isRepo,
		})

		// Remotes view
		ctx.registerView({
			id: "remotes",
			label: "Remotes",
			shortcut: "0",
			component: RemotesView,
			condition: () => ctx.state.git.isRepo,
		})
	},
}

export default plugin
