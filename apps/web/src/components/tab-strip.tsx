import { TabBar } from "@mdit/ui/components/tab-bar"
import type { ReactNode } from "react"

// Thin web wrapper over the shared TabBar primitive. The route builds tab
// items ({ id, label }) from the open workspace nodes and passes them in, so
// this component stays presentational and free of tab data logic.
export function TabStrip({
	tabs,
	activeTabId,
	onActivate,
	onClose,
	onNew,
	actions,
}: {
	tabs: { id: string; label: string }[]
	activeTabId: string | null
	onActivate: (id: string) => void
	onClose: (id: string) => void
	onNew: () => void
	actions?: ReactNode
}) {
	return (
		<TabBar
			tabs={tabs}
			activeTabId={activeTabId ?? ""}
			onActivate={onActivate}
			onClose={onClose}
			onNew={onNew}
			actions={actions}
		/>
	)
}
