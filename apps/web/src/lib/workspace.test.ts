// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
	createFile,
	createFolder,
	deleteNode,
	getChildren,
	getRootNodes,
	isDescendant,
	moveNode,
	renameNode,
	seedWorkspace,
	setNodeMarkdown,
} from "./workspace"

describe("workspace reducers", () => {
	it("seeds one root Untitled file", () => {
		const { workspace, fileId } = seedWorkspace()
		const roots = getRootNodes(workspace)
		expect(roots).toHaveLength(1)
		expect(roots[0].id).toBe(fileId)
		expect(roots[0].kind).toBe("file")
		expect(roots[0].name).toBe("Untitled")
	})

	it("creates files/folders under a parent, ordered by insertion", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "Docs")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const a = createFile(workspace, folder.id, "A")
		workspace = a.workspace
		const b = createFile(workspace, folder.id, "B")
		workspace = b.workspace
		const kids = getChildren(workspace, folder.id)
		expect(kids.map((n) => n.name)).toEqual(["A", "B"])
	})

	it("createFile with an invalid parent falls back to root", () => {
		const { workspace } = createFile(seedWorkspace().workspace, "nope", "X")
		expect(getRootNodes(workspace).some((n) => n.name === "X")).toBe(true)
	})

	it("createFile can nest inside a file (files may hold children)", () => {
		const { workspace, fileId } = seedWorkspace()
		const { workspace: ws2, node } = createFile(workspace, fileId, "Child")
		expect(node.parentId).toBe(fileId)
		expect(getChildren(ws2, fileId).map((n) => n.name)).toEqual(["Child"])
	})

	it("renames, ignoring empty names", () => {
		const { workspace, fileId } = seedWorkspace()
		expect(
			renameNode(workspace, fileId, "  Renamed  ").nodes[fileId].name,
		).toBe("Renamed")
		expect(renameNode(workspace, fileId, "   ").nodes[fileId].name).toBe(
			"Untitled",
		)
	})

	it("deletes a folder with all descendants and reports removedIds", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFile(workspace, folder.id, "C")
		workspace = child.workspace
		const grand = createFile(workspace, child.node.id, "G")
		workspace = grand.workspace
		const { workspace: after, removedIds } = deleteNode(workspace, folder.id)
		expect(after.nodes[folder.id]).toBeUndefined()
		expect(new Set(removedIds)).toEqual(
			new Set([folder.id, child.node.id, grand.node.id]),
		)
	})

	it("moveNode into a descendant is a no-op (cycle guard)", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFolder(workspace, folder.id, "Child")
		workspace = child.workspace
		const moved = moveNode(workspace, folder.id, child.node.id)
		expect(moved.nodes[folder.id].parentId).toBe(null) // unchanged
	})

	it("moveNode reorders siblings by index", () => {
		let { workspace } = createFile(seedWorkspace().workspace, null, "A")
		const a = getRootNodes(workspace).find((n) => n.name === "A")!
		const bRes = createFile(workspace, null, "B")
		workspace = bRes.workspace
		// move B to index 0 among root nodes
		workspace = moveNode(workspace, bRes.node.id, null, 0)
		expect(getRootNodes(workspace)[0].name).toBe("B")
		expect(
			getRootNodes(workspace)
				.map((n) => n.name)
				.indexOf("A"),
		).toBeGreaterThan(
			getRootNodes(workspace)
				.map((n) => n.name)
				.indexOf("B"),
		)
		expect(a).toBeDefined()
	})

	it("isDescendant detects nesting", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFile(workspace, folder.id, "C")
		workspace = child.workspace
		expect(isDescendant(workspace, folder.id, child.node.id)).toBe(true)
		expect(isDescendant(workspace, child.node.id, folder.id)).toBe(false)
	})

	it("setNodeMarkdown updates only the target file", () => {
		const { workspace, fileId } = seedWorkspace()
		const after = setNodeMarkdown(workspace, fileId, "# Hi")
		expect(after.nodes[fileId].markdown).toBe("# Hi")
	})
})
