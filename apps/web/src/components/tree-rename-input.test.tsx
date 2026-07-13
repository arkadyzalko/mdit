// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TreeRenameInput } from "./tree-rename-input"

afterEach(() => {
	cleanup()
})

describe("TreeRenameInput", () => {
	it("submits the trimmed value on Enter", () => {
		const onSubmit = vi.fn()
		render(
			<TreeRenameInput
				initialName="Old"
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		)
		const input = screen.getByRole("textbox") as HTMLInputElement
		fireEvent.change(input, { target: { value: "  New  " } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(onSubmit).toHaveBeenCalledWith("New")
	})

	it("cancels on Escape", () => {
		const onCancel = vi.fn()
		render(
			<TreeRenameInput
				initialName="Old"
				onSubmit={vi.fn()}
				onCancel={onCancel}
			/>,
		)
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })
		expect(onCancel).toHaveBeenCalled()
	})

	it("does not submit an empty name on Enter (cancels instead)", () => {
		const onSubmit = vi.fn()
		const onCancel = vi.fn()
		render(
			<TreeRenameInput
				initialName="Old"
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>,
		)
		const input = screen.getByRole("textbox")
		fireEvent.change(input, { target: { value: "   " } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(onSubmit).not.toHaveBeenCalled()
		expect(onCancel).toHaveBeenCalled()
	})
})
