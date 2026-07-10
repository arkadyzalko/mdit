import { describe, expect, it } from "vitest"
import { buildMinimapTicks } from "./minimap-ticks"

describe("buildMinimapTicks", () => {
	it("maps headings to ticks and marks the active one", () => {
		const ticks = buildMinimapTicks(
			[
				{ id: "a", depth: 1, title: "Intro" },
				{ id: "b", depth: 2, title: "Details" },
			],
			"b",
		)
		expect(ticks).toEqual([
			{ id: "a", depth: 1, title: "Intro", active: false },
			{ id: "b", depth: 2, title: "Details", active: true },
		])
	})

	it("marks nothing active when activeContentId is unknown", () => {
		const ticks = buildMinimapTicks([{ id: "a", depth: 1, title: "X" }], "zzz")
		expect(ticks.every((t) => !t.active)).toBe(true)
	})

	it("returns an empty array for no headings", () => {
		expect(buildMinimapTicks([], "")).toEqual([])
	})
})
