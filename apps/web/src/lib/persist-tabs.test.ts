// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { loadPersistedTabsState, savePersistedTabsState } from "./persist-tabs"
import { createInitialTabsState, openFileInTabs } from "./web-tabs"

describe("persist-tabs", () => {
	beforeEach(() => localStorage.clear())

	it("returns null when nothing is stored", () => {
		expect(loadPersistedTabsState()).toBeNull()
	})

	it("round-trips a tabs state through storage", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" })
		savePersistedTabsState(s, { [s.tabs[0].id]: "A-edited" })
		const loaded = loadPersistedTabsState()
		expect(loaded).not.toBeNull()
		expect(loaded?.tabs[0]).toMatchObject({
			name: "a.md",
			initialMarkdown: "A-edited",
			isFile: true,
			dirty: false,
		})
		expect(loaded?.activeTabId).toBe(s.activeTabId)
	})
})
