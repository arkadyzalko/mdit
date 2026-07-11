import { cn } from "@mdit/ui/lib/utils"
import { InboxIcon } from "lucide-react"
import type { WebTab } from "../lib/web-tabs"

// Left sidebar listing the open documents, mirroring the mdit desktop file
// explorer's look (dark panel, folder-ish header, one row per open document
// with the active row highlighted). Purely presentational — the same tab
// state that drives the top tab bar drives this list.
export function DocSidebar({
	tabs,
	activeTabId,
	onActivate,
}: {
	tabs: WebTab[]
	activeTabId: string
	onActivate: (id: string) => void
}) {
	return (
		<div className="flex h-full w-60 shrink-0 flex-col border-border border-r bg-muted/30">
			<div className="flex h-10 items-center gap-2 px-3 text-muted-foreground text-sm">
				<InboxIcon className="size-4" aria-hidden />
				<span className="truncate">Open documents</span>
			</div>
			<nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
				{tabs.map((tab) => {
					const isActive = tab.id === activeTabId
					return (
						<button
							key={tab.id}
							type="button"
							aria-current={isActive}
							onClick={() => onActivate(tab.id)}
							className={cn(
								"flex h-8 items-center rounded-md px-2 text-left text-sm transition-colors",
								"text-muted-foreground hover:bg-muted",
								isActive && "bg-muted text-foreground",
							)}
						>
							<span className="truncate">
								{tab.dirty ? `${tab.name} •` : tab.name}
							</span>
						</button>
					)
				})}
			</nav>
		</div>
	)
}
