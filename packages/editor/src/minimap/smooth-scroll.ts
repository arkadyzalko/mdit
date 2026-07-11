// Reliable smooth scrolling for the minimap.
//
// Native `scrollIntoView({ behavior: "smooth" })` / `scrollTo({ behavior:
// "smooth" })` silently no-op in some contexts (observed in the web editor:
// "instant"/"auto" scroll fine, "smooth" doesn't move at all). We instead find
// the element's real scrollable ancestor and animate its scrollTop ourselves
// with a timer, which works regardless of which ancestor overflows.

export function findScrollableAncestor(el: HTMLElement): HTMLElement {
	let node = el.parentElement
	while (node) {
		const style = getComputedStyle(node)
		if (
			/(auto|scroll|overlay)/.test(style.overflowY) &&
			node.scrollHeight > node.clientHeight
		) {
			return node
		}
		node = node.parentElement
	}
	return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export function smoothScrollIntoView(
	el: HTMLElement,
	options: { topOffset?: number; duration?: number } = {},
): void {
	const { topOffset = 0, duration = 350 } = options
	const scroller = findScrollableAncestor(el)

	const elTop = el.getBoundingClientRect().top
	const scrollerTop = scroller.getBoundingClientRect().top
	const start = scroller.scrollTop
	const maxScroll = scroller.scrollHeight - scroller.clientHeight
	const target = Math.max(
		0,
		Math.min(maxScroll, start + (elTop - scrollerTop) - topOffset),
	)
	const distance = target - start

	// Skip the animation for reduced-motion users and negligible distances.
	const prefersReduced =
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	if (prefersReduced || Math.abs(distance) < 2) {
		scroller.scrollTop = target
		return
	}

	// Timer-based stepping (rather than requestAnimationFrame, which is paused
	// in background/non-foreground tabs). ~60fps.
	const frameMs = 16
	const startTime = Date.now()
	const tick = () => {
		const progress = Math.min(1, (Date.now() - startTime) / duration)
		scroller.scrollTop = start + distance * easeOutCubic(progress)
		if (progress < 1) setTimeout(tick, frameMs)
	}
	tick()
}
