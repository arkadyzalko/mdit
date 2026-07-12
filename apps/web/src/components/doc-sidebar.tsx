import { cn } from "@mdit/ui/lib/utils"
import { FileTextIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { WebSettings } from "../lib/settings"
import { tabLabel, type WebTab } from "../lib/web-tabs"
import { DownloadMac } from "./download-mac"
import { SettingsContent } from "./settings-content"

const RECENTS_WIDTH = 256
const SETTINGS_WIDTH = 360

// Left sidebar as a floating rounded card (matching the mdit desktop look).
// It hosts two modes in the SAME card: the recent-documents list and the
// settings form. Opening settings expands the card and cross-fades its
// content; closing reverses it. The card is the animated container.
export function DocSidebar({
	tabs,
	activeTabId,
	onActivate,
	showSettings,
	settings,
	onChangeSettings,
	onCloseSettings,
}: {
	tabs: WebTab[]
	activeTabId: string
	onActivate: (id: string) => void
	showSettings: boolean
	settings: WebSettings
	onChangeSettings: (s: WebSettings) => void
	onCloseSettings: () => void
}) {
	return (
		<motion.div
			className="flex h-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/40 p-2 shadow-sm"
			animate={{ width: showSettings ? SETTINGS_WIDTH : RECENTS_WIDTH }}
			initial={false}
			transition={{ type: "spring", stiffness: 400, damping: 38 }}
		>
			<AnimatePresence mode="wait" initial={false}>
				{showSettings ? (
					<motion.div
						key="settings"
						className="flex h-full min-h-0 flex-col"
						initial={{ opacity: 0, x: 12 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 12 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
					>
						<SettingsContent
							settings={settings}
							onChange={onChangeSettings}
							onClose={onCloseSettings}
						/>
					</motion.div>
				) : (
					<motion.div
						key="recents"
						className="flex h-full min-h-0 flex-col gap-1"
						initial={{ opacity: 0, x: -12 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -12 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
					>
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
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
