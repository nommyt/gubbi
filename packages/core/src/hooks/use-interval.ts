/**
 * hooks/use-interval.ts — Polling helper for background refresh
 */

import { onCleanup } from "solid-js"

export function useInterval(fn: () => void | Promise<void>, intervalMs: number) {
  const id = setInterval(() => {
    void Promise.resolve(fn())
  }, intervalMs)
  onCleanup(() => clearInterval(id))
}
