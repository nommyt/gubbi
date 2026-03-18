/**
 * plugins/index.ts — Static plugin loader
 * 
 * Plugins are imported and activated at build time.
 * This is simpler than dynamic loading and maintains type safety.
 */

import type { GubbiPlugin } from "@gubbi/core"

// Import all plugins
import dashboardPlugin from "@gubbi/plugin-dashboard"
import repoPlugin from "@gubbi/plugin-repo"
import stacksPlugin from "@gubbi/plugin-stacks"
import githubPlugin from "@gubbi/plugin-github"

// Plugin registry - add new plugins here
const plugins: GubbiPlugin[] = [
  dashboardPlugin,
  repoPlugin,
  stacksPlugin,
  githubPlugin,
]

export default plugins
