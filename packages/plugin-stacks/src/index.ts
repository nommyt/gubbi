/**
 * @gubbi/plugin-stacks — Stack management views
 */

import type { GubbiPlugin } from "@gubbi/core"

import { StacksView } from "./stacks.tsx"

const plugin: GubbiPlugin = {
	id: "stacks",
	name: "Stacks",
	version: "0.1.0",

	activate(ctx) {
		ctx.registerView({
			id: "stacks",
			label: "Stacks",
			shortcut: "5",
			component: StacksView,
			condition: () => ctx.state.git.isRepo,
		})
	},
}

export default plugin
