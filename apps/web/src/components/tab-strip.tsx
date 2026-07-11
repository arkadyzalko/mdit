import { cn } from "@mdit/ui/lib/utils"
import { PlusIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { MouseEvent } from "react"
import { tabLabel, type WebTab } from "../lib/web-tabs"

const spring = {
	type: "spring" as const,
	stiffness: 580,
	damping: 38,
	mass: 0.7,
}

export function TabStrip({
	tabs,
	activeTabId,
	onActivate,
	onClose,
	onNew,
}: {
	tabs: WebTab[]
	activeTabId: string
	onActivate: (id: string) => void
	onClose: (id: string) => void
	onNew: () => void
}) {
	return (
		<div className="flex min-w-0 items-center gap-1 border-border border-b px-2 py-1.5">
			<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
				<AnimatePresence initial={false} mode="popLayout">
					{tabs.map((tab) => {
						const isActive = tab.id === activeTabId
						return (
							<motion.div
								key={tab.id}
								layout
								role="tab"
								aria-selected={isActive}
								tabIndex={0}
								onClick={() => onActivate(tab.id)}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return
									event.preventDefault()
									onActivate(tab.id)
								}}
								onAuxClick={(event) => {
									if (event.button !== 1) return
									event.stopPropagation()
									onClose(tab.id)
								}}
								className={cn(
									"group/tab relative flex h-8 min-w-12 max-w-48 flex-1 basis-0 cursor-pointer items-center overflow-hidden rounded-md text-sm transition-colors",
									"text-muted-foreground hover:bg-muted",
									isActive && "bg-muted text-foreground",
								)}
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ layout: spring, opacity: spring, x: spring }}
							>
								<div className="flex-1 truncate pr-1 pl-2 text-left">
									{tabLabel(tab)}
								</div>
								<div
									className={cn(
										"absolute right-0 flex h-full w-14 items-center justify-end rounded-r-md pr-1.5",
										"opacity-0 transition-opacity group-hover/tab:opacity-100",
										"bg-linear-to-r from-transparent via-muted to-muted",
									)}
								>
									<button
										type="button"
										aria-label="Close tab"
										onClick={(event: MouseEvent<HTMLButtonElement>) => {
											event.stopPropagation()
											onClose(tab.id)
										}}
										className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
									>
										<XIcon className="size-3.5" aria-hidden />
									</button>
								</div>
							</motion.div>
						)
					})}
				</AnimatePresence>
			</div>
			<button
				type="button"
				aria-label="New tab"
				onClick={onNew}
				className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<PlusIcon className="size-4" aria-hidden />
			</button>
		</div>
	)
}
