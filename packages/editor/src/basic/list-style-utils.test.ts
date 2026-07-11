import { describe, expect, it } from "vitest"
import {
	resolveBulletedListStyleByIndent,
	resolveListStyleTypeByIndent,
	resolveOrderedListStyleByIndent,
} from "./list-style-utils"

describe("list-style-utils", () => {
	it("returns disc when indent is undefined", () => {
		expect(resolveBulletedListStyleByIndent()).toBe("disc")
	})

	it("maps indent depth styles in a repeating cycle", () => {
		expect(resolveBulletedListStyleByIndent(1)).toBe("disc")
		expect(resolveBulletedListStyleByIndent(2)).toBe("circle")
		expect(resolveBulletedListStyleByIndent(3)).toBe("square")
		expect(resolveBulletedListStyleByIndent(4)).toBe("disc")
		expect(resolveBulletedListStyleByIndent(5)).toBe("circle")
	})

	it("normalizes non-positive and invalid indents to disc", () => {
		expect(resolveBulletedListStyleByIndent(0)).toBe("disc")
		expect(resolveBulletedListStyleByIndent(-1)).toBe("disc")
		expect(resolveBulletedListStyleByIndent(Number.NaN)).toBe("disc")
	})

	it("cycles ordered list styles decimal → lower-alpha → lower-roman by indent", () => {
		expect(resolveOrderedListStyleByIndent(1)).toBe("decimal")
		expect(resolveOrderedListStyleByIndent(2)).toBe("lower-alpha")
		expect(resolveOrderedListStyleByIndent(3)).toBe("lower-roman")
		expect(resolveOrderedListStyleByIndent(4)).toBe("decimal")
		expect(resolveOrderedListStyleByIndent()).toBe("decimal")
	})

	it("resolves ordered lists through the top-level resolver", () => {
		expect(resolveListStyleTypeByIndent("decimal", 1)).toBe("decimal")
		expect(resolveListStyleTypeByIndent("decimal", 2)).toBe("lower-alpha")
		expect(resolveListStyleTypeByIndent("decimal", 3)).toBe("lower-roman")
	})

	it("keeps other list styles (e.g. todo) unchanged", () => {
		expect(resolveListStyleTypeByIndent("todo", 3)).toBe("todo")
	})
})
