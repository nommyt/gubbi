/**
 * types/plugin.ts — Plugin interface definition
 */

import type { PluginContext } from "../context/index.ts"

/**
 * A Gubbi plugin that can contribute views, commands, and functionality
 */
export interface GubbiPlugin {
	/** Unique plugin identifier (e.g., "repo", "github") */
	id: string

	/** Human-readable plugin name */
	name: string

	/** Plugin version */
	version: string

	/**
	 * Called when the plugin is activated
	 * @param ctx - The plugin context for registration and state access
	 */
	activate: (ctx: PluginContext) => void | Promise<void>

	/**
	 * Called when the plugin is deactivated (optional)
	 * @param ctx - The plugin context
	 */
	deactivate?: (ctx: PluginContext) => void
}

/**
 * Plugin metadata without the implementation
 */
export interface PluginManifest {
	id: string
	name: string
	version: string
	description?: string
	author?: string
	dependencies?: string[] // Other plugin IDs this plugin depends on
}
