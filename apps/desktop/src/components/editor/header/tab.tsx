import { TabBar } from "@mdit/ui/components/tab-bar"
import { isMac } from "@mdit/utils/platform"
import { useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useStore } from "@/store"

export function TabStrip() {
	const { rawTabs, openDocuments, activeTabId, activateTabById, closeTabById } =
		useStore(
			useShallow((s) => ({
				rawTabs: s.tabs,
				openDocuments: s.openDocuments,
				activeTabId: s.activeTabId,
				activateTabById: s.activateTabById,
				closeTabById: s.closeTabById,
			})),
		)

	const tabs = useMemo(() => {
		const documentsById = new Map(
			openDocuments.map((document) => [document.id, document]),
		)
		return rawTabs
			.map((tab) => {
				const document = documentsById.get(tab.documentId)
				if (!document) return null
				return {
					id: String(tab.id),
					label: document.name,
					dirty: !document.isSaved,
				}
			})
			.filter((tab): tab is NonNullable<typeof tab> => tab !== null)
	}, [openDocuments, rawTabs])

	if (tabs.length === 0) {
		return null
	}

	return (
		<TabBar
			tabs={tabs}
			activeTabId={String(activeTabId)}
			onActivate={(id) => activateTabById(Number(id))}
			onClose={(id) => closeTabById(Number(id))}
			dragRegion={isMac()}
			className="flex-1"
		/>
	)
}
