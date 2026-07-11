// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { findScrollableAncestor, smoothScrollIntoView } from "./smooth-scroll"

describe("findScrollableAncestor", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
	})

	it("returns the nearest overflow ancestor that actually overflows", () => {
		const scroller = document.createElement("div")
		scroller.style.overflowY = "auto"
		// jsdom doesn't lay out, so fake the scroll metrics.
		Object.defineProperty(scroller, "scrollHeight", { value: 1000 })
		Object.defineProperty(scroller, "clientHeight", { value: 300 })
		const inner = document.createElement("div")
		const target = document.createElement("h2")
		inner.appendChild(target)
		scroller.appendChild(inner)
		document.body.appendChild(scroller)

		expect(findScrollableAncestor(target)).toBe(scroller)
	})

	it("skips overflow ancestors that do not overflow", () => {
		const notScrolling = document.createElement("div")
		notScrolling.style.overflowY = "auto"
		Object.defineProperty(notScrolling, "scrollHeight", { value: 300 })
		Object.defineProperty(notScrolling, "clientHeight", { value: 300 })
		const target = document.createElement("h2")
		notScrolling.appendChild(target)
		document.body.appendChild(notScrolling)

		// Falls back to the document scrolling element, not the non-overflowing div.
		expect(findScrollableAncestor(target)).not.toBe(notScrolling)
	})
})

describe("smoothScrollIntoView", () => {
	it("jumps instantly (no animation) when reduced motion is preferred", () => {
		const scroller = document.createElement("div")
		scroller.style.overflowY = "auto"
		Object.defineProperty(scroller, "scrollHeight", { value: 1000 })
		Object.defineProperty(scroller, "clientHeight", { value: 300 })
		scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
		const target = document.createElement("h2")
		target.getBoundingClientRect = () => ({ top: 500 }) as DOMRect
		scroller.appendChild(target)
		document.body.appendChild(scroller)

		vi.stubGlobal(
			"matchMedia",
			vi
				.fn()
				.mockReturnValue({ matches: true }) as unknown as typeof matchMedia,
		)

		smoothScrollIntoView(target, { topOffset: 0 })
		expect(scroller.scrollTop).toBe(500)

		vi.unstubAllGlobals()
	})
})
