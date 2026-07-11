import { cn } from "@mdit/ui/lib/utils"
import { FileTextIcon } from "lucide-react"
import { tabLabel, type WebTab } from "../lib/web-tabs"
import { DownloadMac } from "./download-mac"

// Left sidebar listing the open documents as a floating rounded card (matching
// the mdit desktop look). Purely presentational — the same tab state that
// drives the top tab bar drives this list.
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
		<div className="flex h-full w-64 shrink-0 flex-col gap-1 overflow-hidden rounded-xl border border-border bg-muted/40 p-2 shadow-sm">
			<div className="px-2 pt-1 pb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
				Recents
			</div>
			<nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
				{tabs.map((tab) => {
					const isActive = tab.id === activeTabId
					return (
						<button
							key={tab.id}
							type="button"
							aria-current={isActive}
							onClick={() => onActivate(tab.id)}
							className={cn(
								"flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors",
								isActive
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							<FileTextIcon
								className={cn(
									"size-3.5 shrink-0",
									isActive
										? "text-accent-foreground/70"
										: "text-muted-foreground/60",
								)}
								aria-hidden
							/>
							<span className="truncate">{tabLabel(tab)}</span>
						</button>
					)
				})}
			</nav>
			<DownloadMac />
		</div>
	)
}
