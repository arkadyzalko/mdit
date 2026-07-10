import { describe, expect, it } from "vitest"
import { ensureMdExtension } from "./download"

describe("ensureMdExtension", () => {
	it("keeps an existing .md extension", () => {
		expect(ensureMdExtension("notes.md")).toBe("notes.md")
	})
	it("adds .md when missing", () => {
		expect(ensureMdExtension("notes")).toBe("notes.md")
	})
	it("keeps .markdown", () => {
		expect(ensureMdExtension("notes.markdown")).toBe("notes.markdown")
	})
})
