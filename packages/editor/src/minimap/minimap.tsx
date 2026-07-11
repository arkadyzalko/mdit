import { cn } from "@mdit/ui/lib/utils"
import { useTocSideBar, useTocSideBarState } from "@platejs/toc/react"
import { NodeApi } from "platejs"
import { buildMinimapTicks } from "./minimap-ticks"
import { smoothScrollIntoView } from "./smooth-scroll"

export type HeadingMinimapProps = {
	topOffset?: number
	className?: string
}

export function HeadingMinimap({
	topOffset = 80,
	className,
}: HeadingMinimapProps) {
	const state = useTocSideBarState({ topOffset })
	const { navProps, onContentClick } = useTocSideBar(state)
	const { editor, headingList, activeContentId, mouseInToc } = state
	const ticks = buildMinimapTicks(headingList, activeContentId ?? "")

	if (ticks.length === 0) return null

	const scrollTo = (e: React.MouseEvent<HTMLElement>, id: string) => {
		const heading = headingList.find((h) => h.id === id)
		if (!heading) return
		// Let the TOC hook update its active state (its own scroll is a no-op
		// here — native smooth scrolling doesn't move this container).
		onContentClick(e, heading, "smooth")
		// Do the actual scroll ourselves: resolve the heading's DOM node and
		// animate its real scrollable ancestor. This works regardless of which
		// element overflows (the web editor scrolls PlateContent, not the
		// registered PlateContainer) and doesn't rely on native smooth scroll.
		const node = NodeApi.get(editor, heading.path)
		const el = node && editor.api.toDOMNode(node)
		if (el) smoothScrollIntoView(el as HTMLElement, { topOffset })
	}

	return (
		<nav
			{...navProps}
			aria-label="Document outline"
			className={cn(
				"absolute top-0 right-0 z-30 flex h-full w-8 flex-col items-end justify-center gap-1.5 py-16 pr-2",
				className,
			)}
		>
			{/* Ticks (always visible) */}
			<div className="flex flex-col items-end gap-1.5">
				{ticks.map((tick) => (
					<button
						key={tick.id}
						type="button"
						aria-label={tick.title}
						onClick={(e) => scrollTo(e, tick.id)}
						className={cn(
							"h-[2px] rounded-full transition-colors",
							tick.depth === 1 && "w-4",
							tick.depth === 2 && "w-3",
							tick.depth >= 3 && "w-2",
							tick.active
								? "bg-foreground"
								: "bg-muted-foreground/40 hover:bg-muted-foreground",
						)}
					/>
				))}
			</div>

			{/* Hover overlay: floats over content, does not resize the column */}
			{mouseInToc && (
				<div className="absolute top-1/2 right-8 max-h-[70vh] w-64 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
					{ticks.map((tick) => (
						<button
							key={tick.id}
							type="button"
							onClick={(e) => scrollTo(e, tick.id)}
							style={{ paddingLeft: `${(tick.depth - 1) * 12 + 8}px` }}
							className={cn(
								"block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent",
								tick.active ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{tick.title}
						</button>
					))}
				</div>
			)}
		</nav>
	)
}
