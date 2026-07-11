import { EditorDndProvider } from "@mdit/editor/dnd"
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { DocSidebar } from "../components/doc-sidebar"
import { DownloadButton } from "../components/download-button"
import { SettingsButton } from "../components/settings-button"
import { SettingsPanel } from "../components/settings-panel"
import { TabStrip } from "../components/tab-strip"
import { WebEditor } from "../components/web-editor"
import { useSettings } from "../hooks/use-settings"
import { downloadMarkdown } from "../lib/download"
import {
	loadPersistedTabsState,
	savePersistedTabsState,
} from "../lib/persist-tabs"
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
	const [state, setState] = useState(
		() => loadPersistedTabsState() ?? createInitialTabsState(),
	)
	const { settings, setSettings } = useSettings()
	const markdownByTab = useRef<Record<string, string>>({})
	const [showSettings, setShowSettings] = useState(false)

	const handlePersist = (id: string, markdown: string) => {
		markdownByTab.current[id] = markdown
		setState((s) => {
			const next = setDirty(s, id, false)
			savePersistedTabsState(next, markdownByTab.current)
			return next
		})
	}

	// Download the active tab's current content and mark it clean. Used by both
	// Cmd/Ctrl+S and the toolbar Download button.
	const downloadActiveTab = () => {
		const active = state.tabs.find((t) => t.id === state.activeTabId)
		if (!active) return
		const markdown = markdownByTab.current[active.id] ?? active.initialMarkdown
		downloadMarkdown(active.name, markdown)
		setState((s) => setDirty(s, active.id, false))
	}

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault()
				downloadActiveTab()
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	})

	useEffect(() => {
		savePersistedTabsState(state, markdownByTab.current)
	}, [state])

	const openMarkdownFile = async (file: File) => {
		const markdown = await file.text()
		setState((s) => openFileInTabs(s, { name: file.name, markdown }))
	}

	const activate = (id: string) => setState((s) => ({ ...s, activeTabId: id }))

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
		<div className="flex h-screen w-full gap-2 bg-background p-2">
			<DocSidebar
				tabs={state.tabs}
				activeTabId={state.activeTabId}
				onActivate={activate}
			/>
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
				<TabStrip
					tabs={state.tabs}
					activeTabId={state.activeTabId}
					onActivate={activate}
					onClose={handleClose}
					onNew={() => setState(newTab)}
					actions={
						<>
							<DownloadButton onClick={downloadActiveTab} />
							<SettingsButton onClick={() => setShowSettings(true)} />
						</>
					}
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
					{/* Every open tab stays mounted (inactive ones hidden) so each
					    editor keeps its content/undo state when switching. Each tab is
					    a full Plate editor instance, so live editor count grows with
					    open tabs — fine for typical single-user sessions. */}
					{state.tabs.map((tab) => {
						const isActive = tab.id === state.activeTabId
						return (
							<div
								key={`${tab.id}:${tab.epoch}`}
								className={isActive ? "h-full w-full" : "hidden"}
							>
								<PlateController>
									<EditorDndProvider>
										<WebEditor
											fileName={tab.name}
											initialMarkdown={tab.initialMarkdown}
											autoSave={settings.autoSave}
											autoSaveDelayMs={settings.autoSaveDelayMs}
											onChange={(md) => {
												markdownByTab.current[tab.id] = md
											}}
											onPersist={(md) => handlePersist(tab.id, md)}
											onDirtyChange={(dirty) =>
												setState((s) => setDirty(s, tab.id, dirty))
											}
										/>
									</EditorDndProvider>
								</PlateController>
							</div>
						)
					})}
				</div>
			</div>
			{showSettings ? (
				<SettingsPanel
					settings={settings}
					onChange={setSettings}
					onClose={() => setShowSettings(false)}
				/>
			) : null}
		</div>
	)
}
