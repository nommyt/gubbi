import "@opentui/solid"
import type { DiffRenderableOptions } from "@opentui/core"

declare module "@opentui/solid" {
	namespace JSX {
		interface IntrinsicElements {
			diff: DiffRenderableOptions
		}
	}
}
