export type MinimapTick = {
	id: string
	depth: number
	title: string
	active: boolean
}

export function buildMinimapTicks(
	headingList: { id: string; depth: number; title: string }[],
	activeContentId: string,
): MinimapTick[] {
	return headingList.map((h) => ({
		id: h.id,
		depth: h.depth,
		title: h.title,
		active: h.id === activeContentId,
	}))
}
