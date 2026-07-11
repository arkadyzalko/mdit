// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { readJSON, writeJSON } from "./storage"

describe("storage", () => {
	beforeEach(() => localStorage.clear())

	it("round-trips a JSON value", () => {
		writeJSON("k", { a: 1, b: ["x"] })
		expect(readJSON<{ a: number; b: string[] }>("k")).toEqual({
			a: 1,
			b: ["x"],
		})
	})

	it("returns null for a missing key", () => {
		expect(readJSON("nope")).toBeNull()
	})

	it("returns null (no throw) for corrupt JSON", () => {
		localStorage.setItem("bad", "{not json")
		expect(readJSON("bad")).toBeNull()
	})
})
