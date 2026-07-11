import { createSlateEditor } from "platejs"
import { describe, expect, it } from "vitest"
import { BlockSelectionKit } from "../selection/block-selection-kit"
import { handleEditorBlockDrop } from "./block-move"

function makeEditor() {
	return createSlateEditor({
		plugins: BlockSelectionKit,
		value: [
			{ type: "p", id: "a", children: [{ text: "Alpha" }] },
			{ type: "p", id: "b", children: [{ text: "Beta" }] },
			{ type: "p", id: "c", children: [{ text: "Gamma" }] },
		],
	})
}

const ids = (editor: ReturnType<typeof makeEditor>) =>
	editor.children.map((n) => (n as { id?: string }).id)

describe("handleEditorBlockDrop", () => {
	it("returns false when the target is not an editor drop", () => {
		const editor = makeEditor()
		expect(
			handleEditorBlockDrop({
				editor,
				activeData: { kind: "editor", id: "c" },
				overData: { some: "other-target" },
			}),
		).toBe(false)
		expect(ids(editor)).toEqual(["a", "b", "c"])
	})

	it("moves a block above the target when dropped on its top half", () => {
		const editor = makeEditor()
		handleEditorBlockDrop({
			editor,
			activeData: { kind: "editor", id: "c" },
			overData: { kind: "editor", id: "a", position: "top" },
		})
		expect(ids(editor)).toEqual(["c", "a", "b"])
	})

	it("moves a block below the target when dropped on its bottom half", () => {
		const editor = makeEditor()
		handleEditorBlockDrop({
			editor,
			activeData: { kind: "editor", id: "a" },
			overData: { kind: "editor", id: "c", position: "bottom" },
		})
		expect(ids(editor)).toEqual(["b", "c", "a"])
	})

	it("is a no-op when dropping a block onto itself", () => {
		const editor = makeEditor()
		handleEditorBlockDrop({
			editor,
			activeData: { kind: "editor", id: "b" },
			overData: { kind: "editor", id: "b", position: "top" },
		})
		expect(ids(editor)).toEqual(["a", "b", "c"])
	})
})
