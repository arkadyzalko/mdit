// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
	activate,
	closeTab,
	closeTabsForNodes,
	createEmptyTabsState,
	openNode,
	setTabDirty,
	tabLabel,
} from "./web-tabs"

describe("tabs as node references", () => {
	it("starts empty", () => {
		const s = createEmptyTabsState()
		expect(s.openTabIds).toEqual([])
		expect(s.activeTabId).toBe(null)
	})

	it("opens a node and activates it; re-opening focuses without duplicating", () => {
		let s = openNode(createEmptyTabsState(), "a")
		s = openNode(s, "b")
		expect(s.openTabIds).toEqual(["a", "b"])
		expect(s.activeTabId).toBe("b")
		s = openNode(s, "a")
		expect(s.openTabIds).toEqual(["a", "b"]) // no dupe
		expect(s.activeTabId).toBe("a")
	})

	it("closing a tab removes it from the open list and activates a neighbor", () => {
		let s = openNode(openNode(openNode(createEmptyTabsState(), "a"), "b"), "c")
		s = activate(s, "b")
		s = closeTab(s, "b")
		expect(s.openTabIds).toEqual(["a", "c"])
		expect(s.activeTabId).toBe("a") // left neighbor
	})

	it("closing the active leftmost tab activates the new leftmost", () => {
		let s = openNode(openNode(createEmptyTabsState(), "a"), "b")
		s = activate(s, "a")
		s = closeTab(s, "a")
		expect(s.openTabIds).toEqual(["b"])
		expect(s.activeTabId).toBe("b")
	})

	it("closing the last tab leaves no active tab", () => {
		let s = openNode(createEmptyTabsState(), "a")
		s = closeTab(s, "a")
		expect(s.openTabIds).toEqual([])
		expect(s.activeTabId).toBe(null)
	})

	it("closeTabsForNodes closes all deleted nodes at once", () => {
		let s = openNode(openNode(openNode(createEmptyTabsState(), "a"), "b"), "c")
		s = activate(s, "b")
		s = closeTabsForNodes(s, ["b", "c"])
		expect(s.openTabIds).toEqual(["a"])
		expect(s.activeTabId).toBe("a")
	})

	it("setTabDirty toggles dirty per node; tabLabel appends a dot", () => {
		expect(tabLabel("Doc", false)).toBe("Doc")
		expect(tabLabel("Doc", true)).toBe("Doc •")
		let s = openNode(createEmptyTabsState(), "a")
		s = setTabDirty(s, "a", true)
		expect(s.openTabIds).toEqual(["a"]) // structure unchanged
	})
})
