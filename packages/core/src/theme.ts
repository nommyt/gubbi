/**
 * theme.ts — Theme system with semantic color tokens, built-in themes, and SolidJS context.
 *
 * Defines the {@link ThemeColors} interface (70+ semantic tokens), the
 * {@link ThemeConfig} wrapper, a registry of built-in themes, persistence
 * helpers, and the SolidJS context used throughout gubbi's UI.
 */

import { createContext, useContext } from "solid-js"

import { getPersistedValue, setPersistedValue } from "./persist.ts"
import { githubDark, BUILTIN_THEMES } from "./themes/index.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Semantic color tokens consumed by every UI component.
 *
 * Organised into surface, border, text, accent, status, git, PR,
 * diff, and syntax-highlighting groups.
 */
export interface ThemeColors {
	// ---- Surface ----
	/** Primary background. */
	bg: string
	/** Secondary surface (sidebars, panels). */
	bgSecondary: string
	/** Tertiary surface (hover / selection highlights). */
	bgTertiary: string
	/** Overlay backdrop (dialogs, palettes). */
	bgOverlay: string

	// ---- Border ----
	/** Default border. */
	border: string
	/** Focused / active border. */
	borderFocused: string
	/** Danger-state border (destructive actions). */
	borderDanger: string

	// ---- Text ----
	/** Primary text. */
	text: string
	/** Secondary text (descriptions, metadata). */
	textSecondary: string
	/** Muted text (placeholders, disabled labels). */
	textMuted: string

	// ---- Accent ----
	/** Primary accent (links, keybinding highlights). */
	accent: string
	/** Secondary accent (complementary highlights). */
	accentSecondary: string

	// ---- Semantic status ----
	/** Success indicator. */
	success: string
	/** Warning indicator. */
	warning: string
	/** Error / failure indicator. */
	error: string
	/** Informational indicator. */
	info: string

	// ---- Git file status ----
	/** Added files. */
	gitAdded: string
	/** Modified files. */
	gitModified: string
	/** Deleted files. */
	gitDeleted: string
	/** Renamed files. */
	gitRenamed: string
	/** Untracked files. */
	gitUntracked: string
	/** Conflicted files. */
	gitConflict: string

	// ---- GitHub PR status ----
	/** Open PRs. */
	prOpen: string
	/** Closed PRs. */
	prClosed: string
	/** Merged PRs. */
	prMerged: string
	/** Draft PRs. */
	prDraft: string

	// ---- Diff ----
	/** Added-line foreground. */
	diffAdded: string
	/** Added-line background. */
	diffAddedBg: string
	/** Removed-line foreground. */
	diffRemoved: string
	/** Removed-line background. */
	diffRemovedBg: string
	/** Context-line foreground. */
	diffContext: string
	/** Hunk header foreground. */
	diffHunkHeader: string

	// ---- Syntax highlighting ----
	/** Keywords (`if`, `return`, `const`). */
	syntaxKeyword: string
	/** String literals. */
	syntaxString: string
	/** Comments. */
	syntaxComment: string
	/** Function names. */
	syntaxFunction: string
	/** Variables and identifiers. */
	syntaxVariable: string
	/** Type names and annotations. */
	syntaxType: string
	/** Numeric literals. */
	syntaxNumber: string
	/** Operators (`+`, `=>`, `===`). */
	syntaxOperator: string
}

/** Border drawing style used when rendering panels. */
export type BorderStyle = "single" | "rounded" | "double" | "bold"

/** A complete theme definition: metadata, colors, and border style. */
export interface ThemeConfig {
	/** Machine-readable name (e.g. `"github-dark"`). */
	name: string
	/** Human-readable display name (e.g. `"GitHub Dark"`). */
	displayName: string
	/** Semantic color tokens. */
	colors: ThemeColors
	/** Border drawing style. */
	borderStyle: BorderStyle
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const themeMap = new Map<string, ThemeConfig>(BUILTIN_THEMES.map((t) => [t.name, t]))

/**
 * Look up a theme by its machine-readable name.
 * Falls back to GitHub Dark if the name is not found.
 */
export function getThemeByName(name: string): ThemeConfig {
	return themeMap.get(name) ?? githubDark
}

/** Return a copy of all built-in themes. */
export function listThemes(): ThemeConfig[] {
	return [...BUILTIN_THEMES]
}

/**
 * Read the user's persisted theme preference.
 * Defaults to `"github-dark"` if no preference has been saved.
 */
export function getDefaultThemeName(): string {
	return getPersistedValue<string>("theme", "github-dark")
}

/** Persist the user's theme preference to disk. */
export function persistThemeName(name: string) {
	setPersistedValue("theme", name)
}

// ---------------------------------------------------------------------------
// SolidJS Context
// ---------------------------------------------------------------------------

/** SolidJS context providing the active {@link ThemeConfig} to the component tree. */
const ThemeContext = createContext<ThemeConfig>(githubDark)

export { ThemeContext }

/**
 * Access the active theme's color tokens from any component.
 * Shorthand for `useThemeConfig().colors`.
 */
export function useTheme(): ThemeColors {
	return useContext(ThemeContext).colors
}

/**
 * Access the full active {@link ThemeConfig} (colors + metadata + border style).
 */
export function useThemeConfig(): ThemeConfig {
	return useContext(ThemeContext)
}
