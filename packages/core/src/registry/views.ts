/**
 * registry/views.ts — View registry for managing plugin-contributed views
 */

import { createStore, produce } from "solid-js/store"

import type { ViewDefinition, RegisteredView } from "../types/view.ts"

/**
 * ViewRegistry manages all registered views from plugins
 */
export class ViewRegistry {
	private viewsStore = createStore<RegisteredView[]>([])
	private viewMap = new Map<string, RegisteredView>()

	/**
	 * Register a view from a plugin
	 */
	register(pluginId: string, view: ViewDefinition): void {
		if (this.viewMap.has(view.id)) {
			console.warn(`View "${view.id}" is already registered, skipping`)
			return
		}

		const registered: RegisteredView = {
			...view,
			pluginId,
			isVisible: view.condition ? view.condition() : true,
		}

		this.viewMap.set(view.id, registered)
		this.viewsStore[1](
			produce((list) => {
				list.push(registered)
			}),
		)
	}

	/**
	 * Get a view by ID
	 */
	get(id: string): ViewDefinition | undefined {
		return this.viewMap.get(id)
	}

	/**
	 * Get all registered views
	 */
	getAll(): RegisteredView[] {
		return this.viewsStore[0]
	}

	/**
	 * Get all currently visible views (filtered by condition)
	 */
	getVisible(): RegisteredView[] {
		return this.viewsStore[0].filter((v) => {
			if (v.condition) {
				return v.condition()
			}
			return true
		})
	}

	/**
	 * Get views sorted by shortcut
	 */
	getOrdered(): RegisteredView[] {
		return this.getVisible().sort((a, b) => a.shortcut.localeCompare(b.shortcut))
	}

	/**
	 * Check if a view exists
	 */
	has(id: string): boolean {
		return this.viewMap.has(id)
	}

	/**
	 * Unregister all views from a plugin
	 */
	unregisterByPlugin(pluginId: string): void {
		const viewsToRemove = this.viewsStore[0].filter((v) => v.pluginId === pluginId)
		for (const view of viewsToRemove) {
			this.viewMap.delete(view.id)
		}
		this.viewsStore[1](
			produce((list) => {
				const indices = list
					.map((v, i) => (v.pluginId === pluginId ? i : -1))
					.filter((i) => i !== -1)
					.sort((a, b) => b - a)
				for (const idx of indices) {
					list.splice(idx, 1)
				}
			}),
		)
	}
}

// Global view registry instance
export const viewRegistry = new ViewRegistry()
