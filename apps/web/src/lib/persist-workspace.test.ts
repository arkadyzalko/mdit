// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import {
	loadTabs,
	loadWorkspace,
	OPEN_TABS_STORAGE_KEY,
	saveTabs,
	saveWorkspace,
	WORKSPACE_STORAGE_KEY,
} from "./persist-workspace"
import { seedWorkspace } from "./workspace"

describe("workspace persistence", () => {
	beforeEach(() => localStorage.clear())

	it("seeds a fresh workspace when nothing is stored", () => {
		const { workspace, seededFileId } = loadWorkspace()
		expect(seededFileId).not.toBeNull()
		expect(Object.keys(workspace.nodes)).toHaveLength(1)
	})

	it("round-trips a saved workspace and reports no seed", () => {
		const { workspace } = seedWorkspace()
		saveWorkspace(workspace)
		const loaded = loadWorkspace()
		expect(loaded.seededFileId).toBeNull()
		expect(loaded.workspace.nodes).toEqual(workspace.nodes)
	})

	it("ignores the abandoned mdit.web.tabs key", () => {
		localStorage.setItem(
			"mdit.web.tabs",
			JSON.stringify({ tabs: [{ id: "x" }] }),
		)
		const { seededFileId } = loadWorkspace()
		expect(seededFileId).not.toBeNull() // still seeds; old key not read
	})

	it("round-trips open tabs; defaults to empty", () => {
		expect(loadTabs().openTabIds).toEqual([])
		saveTabs({ openTabIds: ["a", "b"], activeTabId: "b" })
		expect(loadTabs()).toEqual({ openTabIds: ["a", "b"], activeTabId: "b" })
	})

	it("uses the documented storage keys", () => {
		saveWorkspace(seedWorkspace().workspace)
		saveTabs({ openTabIds: [], activeTabId: null })
		expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull()
		expect(localStorage.getItem(OPEN_TABS_STORAGE_KEY)).not.toBeNull()
	})
})
