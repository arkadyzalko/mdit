import { FileTextIcon, PlusIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "../lib/utils"

// Shared, presentational macOS-style tab bar used by both the web editor and
// the desktop app so their tabs look identical. It holds NO data logic — the
// consumer maps its own state (web props / desktop store) into `TabBarItem`s
// and handles the callbacks.

export type TabBarItem = {
	id: string
	label: string
	dirty?: boolean
}

const spring = {
	type: "spring" as const,
	stiffness: 580,
	damping: 38,
	mass: 0.7,
}

export function TabBar({
	tabs,
	activeTabId,
	onActivate,
	onClose,
	onNew,
	actions,
	dragRegion = false,
	className,
}: {
	tabs: TabBarItem[]
	activeTabId: string
	onActivate: (id: string) => void
	onClose: (id: string) => void
	// When omitted, the "new tab" (+) button is hidden.
	onNew?: () => void
	// Right-aligned action buttons (settings, download, ...).
	actions?: ReactNode
	// Set on macOS desktop so the empty strip area can drag the window.
	dragRegion?: boolean
	className?: string
}) {
	return (
		<div
			className={cn("flex min-w-0 items-end gap-1 px-2 pt-2", className)}
			{...(dragRegion && { "data-tauri-drag-region": "" })}
		>
			<div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
				<AnimatePresence initial={false} mode="popLayout">
					{tabs.map((tab) => {
						const isActive = tab.id === activeTabId
						const label = tab.dirty ? `${tab.label} •` : tab.label
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
									// Fixed width + shrink-0 so many tabs scroll horizontally
									// instead of squishing into unreadable slivers.
									"group/tab relative flex h-9 w-44 shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-t-lg pr-2 pl-2.5 text-sm transition-colors",
									isActive
										? "bg-background text-foreground"
										: "bg-transparent text-muted-foreground hover:bg-background/40",
								)}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 6 }}
								transition={{ layout: spring, opacity: spring, y: spring }}
							>
								<FileTextIcon
									className={cn(
										"size-3.5 shrink-0",
										isActive
											? "text-foreground/70"
											: "text-muted-foreground/60",
									)}
									aria-hidden
								/>
								<span className="min-w-0 flex-1 truncate text-left">
									{label}
								</span>
								<button
									type="button"
									aria-label="Close tab"
									onClick={(event: MouseEvent<HTMLButtonElement>) => {
										event.stopPropagation()
										onClose(tab.id)
									}}
									className={cn(
										"flex size-5 shrink-0 items-center justify-center rounded transition-all hover:bg-muted",
										"opacity-0 group-hover/tab:opacity-100",
										isActive && "opacity-70 hover:opacity-100",
									)}
								>
									<XIcon className="size-3.5" aria-hidden />
								</button>
							</motion.div>
						)
					})}
				</AnimatePresence>
				{onNew ? (
					<button
						type="button"
						aria-label="New tab"
						onClick={onNew}
						className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
					>
						<PlusIcon className="size-4" aria-hidden />
					</button>
				) : null}
			</div>
			{actions ? (
				<div className="mb-0.5 flex shrink-0 items-center gap-0.5">
					{actions}
				</div>
			) : null}
		</div>
	)
}
