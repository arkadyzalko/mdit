import { EditorDndProvider } from "@mdit/editor/dnd"
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { TabStrip } from "../components/tab-strip"
import { WebEditor } from "../components/web-editor"
import { isImageFile } from "../lib/web-image"
import {
	closeTab,
	createInitialTabsState,
	newTab,
	openFileInTabs,
	setDirty,
} from "../lib/web-tabs"

export const Route = createFileRoute("/")({
	ssr: false,
	component: Home,
})

function Home() {
	const [state, setState] = useState(createInitialTabsState)

	const openMarkdownFile = async (file: File) => {
		const markdown = await file.text()
		setState((s) => openFileInTabs(s, { name: file.name, markdown }))
	}

	const handleClose = (id: string) => {
		setState((s) => {
			const tab = s.tabs.find((t) => t.id === id)
			if (tab?.dirty && !window.confirm("Discard unsaved changes?")) {
				return s
			}
			return closeTab(s, id)
		})
	}

	return (
		<div className="flex h-screen w-full flex-col">
			<TabStrip
				tabs={state.tabs}
				activeTabId={state.activeTabId}
				onActivate={(id) => setState((s) => ({ ...s, activeTabId: id }))}
				onClose={handleClose}
				onNew={() => setState(newTab)}
			/>
			<div
				className="relative min-h-0 flex-1"
				onDrop={(e) => {
					const file = Array.from(e.dataTransfer.files)[0]
					// Images are handled inline by the editor (they stopPropagation);
					// here we only handle markdown files → tab logic.
					if (file && !isImageFile(file)) {
						e.preventDefault()
						void openMarkdownFile(file)
					}
				}}
				onDragOver={(e) => e.preventDefault()}
			>
				{state.tabs.map((tab) => {
					const isActive = tab.id === state.activeTabId
					return (
						<div key={tab.id} className={isActive ? "h-full w-full" : "hidden"}>
							<PlateController>
								<EditorDndProvider>
									<WebEditor
										fileName={tab.name}
										initialMarkdown={tab.initialMarkdown}
										onDirtyChange={() =>
											setState((s) => setDirty(s, tab.id, true))
										}
										onDownloaded={() =>
											setState((s) => setDirty(s, tab.id, false))
										}
									/>
								</EditorDndProvider>
							</PlateController>
						</div>
					)
				})}
			</div>
		</div>
	)
}
