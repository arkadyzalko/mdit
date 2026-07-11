import { TabBar } from "@mdit/ui/components/tab-bar"
import type { ReactNode } from "react"
import type { WebTab } from "../lib/web-tabs"

// Thin web wrapper over the shared TabBar primitive: maps WebTab[] to the
// primitive's generic items so web and desktop render identical tabs.
export function TabStrip({
	tabs,
	activeTabId,
	onActivate,
	onClose,
	onNew,
	actions,
}: {
	tabs: WebTab[]
	activeTabId: string
	onActivate: (id: string) => void
	onClose: (id: string) => void
	onNew: () => void
	actions?: ReactNode
}) {
	return (
		<TabBar
			tabs={tabs.map((t) => ({ id: t.id, label: t.name, dirty: t.dirty }))}
			activeTabId={activeTabId}
			onActivate={onActivate}
			onClose={onClose}
			onNew={onNew}
			actions={actions}
		/>
	)
}
