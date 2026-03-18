/**
 * plugins/index.ts — Static plugin loader
 *
 * Plugins are imported and activated at build time.
 * This is simpler than dynamic loading and maintains type safety.
 */

import type { GubbiPlugin } from "@gubbi/core"
// Import all plugins
import dashboardPlugin from "@gubbi/plugin-dashboard"
import githubPlugin from "@gubbi/plugin-github"
import repoPlugin from "@gubbi/plugin-repo"
import stacksPlugin from "@gubbi/plugin-stacks"

// Plugin registry - add new plugins here
const plugins: GubbiPlugin[] = [dashboardPlugin, repoPlugin, stacksPlugin, githubPlugin]

export default plugins
