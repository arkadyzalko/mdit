import { describe, expect, it } from "vitest"
import { isImageFile } from "./web-image"

describe("isImageFile", () => {
	it("accepts png", () => {
		expect(isImageFile(new File([], "a.png", { type: "image/png" }))).toBe(true)
	})
	it("rejects text", () => {
		expect(isImageFile(new File([], "a.md", { type: "text/markdown" }))).toBe(
			false,
		)
	})
})
