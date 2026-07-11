import { describe, expect, it } from "vitest"
import {
	closeTab,
	createInitialTabsState,
	isTabEmpty,
	newTab,
	openFileInTabs,
	setDirty,
} from "./web-tabs"

describe("web-tabs", () => {
	it("starts with a single empty Untitled tab", () => {
		const s = createInitialTabsState()
		expect(s.tabs).toHaveLength(1)
		expect(s.tabs[0].name).toBe("Untitled")
		expect(s.tabs[0].isFile).toBe(false)
		expect(s.tabs[0].dirty).toBe(false)
		expect(s.activeTabId).toBe(s.tabs[0].id)
		expect(isTabEmpty(s.tabs[0])).toBe(true)
	})

	it("opens a dropped file into the active empty tab (reuse)", () => {
		const s = createInitialTabsState()
		const next = openFileInTabs(s, { name: "notes.md", markdown: "# Notes" })
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].name).toBe("notes.md")
		expect(next.tabs[0].isFile).toBe(true)
		expect(next.tabs[0].initialMarkdown).toBe("# Notes")
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("bumps epoch when reusing a tab so the editor remounts with new content", () => {
		const s = createInitialTabsState()
		expect(s.tabs[0].epoch).toBe(0)
		const next = openFileInTabs(s, { name: "notes.md", markdown: "# Notes" })
		expect(next.tabs[0].id).toBe(s.tabs[0].id) // same tab (reused)
		expect(next.tabs[0].epoch).toBe(1) // but epoch bumped → new React key
	})

	it("opens a dropped file in a new tab when the active tab is a file", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" })
		const next = openFileInTabs(s, { name: "b.md", markdown: "B" })
		expect(next.tabs).toHaveLength(2)
		expect(next.tabs[1].name).toBe("b.md")
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("opens a dropped file in a new tab when the active tab is dirty", () => {
		let s = createInitialTabsState()
		s = setDirty(s, s.tabs[0].id, true)
		const next = openFileInTabs(s, { name: "b.md", markdown: "B" })
		expect(next.tabs).toHaveLength(2)
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("newTab always appends a fresh empty tab and activates it", () => {
		const s = createInitialTabsState()
		const next = newTab(s)
		expect(next.tabs).toHaveLength(2)
		expect(next.tabs[1].isFile).toBe(false)
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("closing the active tab activates the left neighbor", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" }) // reuse -> [a]
		s = newTab(s) // [a, untitled] active=untitled
		const untitledId = s.activeTabId
		const next = closeTab(s, untitledId)
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].name).toBe("a.md")
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("closing the last tab recreates a fresh empty tab", () => {
		const s = createInitialTabsState()
		const next = closeTab(s, s.tabs[0].id)
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].isFile).toBe(false)
		expect(next.tabs[0].dirty).toBe(false)
		expect(next.tabs[0].id).not.toBe(s.tabs[0].id)
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("setDirty toggles the flag on the target tab only", () => {
		let s = createInitialTabsState()
		s = newTab(s)
		const first = s.tabs[0].id
		const next = setDirty(s, first, true)
		expect(next.tabs[0].dirty).toBe(true)
		expect(next.tabs[1].dirty).toBe(false)
	})
})
