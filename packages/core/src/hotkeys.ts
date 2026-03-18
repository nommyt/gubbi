/**
 * hotkeys.ts — Terminal keyboard utilities using @opentui/solid
 *
 * NOTE: @tanstack/solid-hotkeys is a browser-only library that calls
 * document.addEventListener() and silently no-ops in terminal environments.
 * We use @opentui/solid's useKeyboard hook instead, which reads from stdin.
 */

export { useKeyboard } from "@opentui/solid"
export type { ParsedKey as KeyEvent } from "@opentui/core"
