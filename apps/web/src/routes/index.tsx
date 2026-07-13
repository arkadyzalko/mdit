import { EditorDndProvider } from "@mdit/editor/dnd"
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { AiPanel } from "../components/ai-panel"
import { AiPanelToggle } from "../components/ai-panel-toggle"
import { DocSidebar } from "../components/doc-sidebar"
import { DownloadButton } from "../components/download-button"
import { SettingsButton } from "../components/settings-button"
import { TabStrip } from "../components/tab-strip"
import { WebEditor } from "../components/web-editor"
import { AiClientProvider } from "../hooks/use-ai-client"
import { useSettings } from "../hooks/use-settings"
import { useTheme } from "../hooks/use-theme"
import { downloadMarkdown } from "../lib/download"
import {
	loadTabs,
	loadWorkspace,
	saveTabs,
	saveWorkspace,
} from "../lib/persist-workspace"
import { isImageFile } from "../lib/web-image"
import {
	activate,
	closeTab,
	closeTabsForNodes,
	createEmptyTabsState,
	openNode,
	tabLabel,
} from "../lib/web-tabs"
import {
	createFile,
	deleteNode,
	getChildren,
	setNodeMarkdown,
	type Workspace,
	type WorkspaceNode,
} from "../lib/workspace"

export const Route = createFileRoute("/")({
	ssr: false,
	component: Home,
})

function Home() {
	// Load the persisted workspace ONCE so a fresh seed produces a single file
	// id (calling loadWorkspace() twice would seed two different ids).
	const initial = useRef(loadWorkspace()).current
	const [workspace, setWorkspace] = useState<Workspace>(initial.workspace)
	const [tabs, setTabs] = useState(() => {
		if (initial.seededFileId)
			return openNode(createEmptyTabsState(), initial.seededFileId)
		const stored = loadTabs()
		return stored.openTabIds.length > 0 ? stored : createEmptyTabsState()
	})
	// Per-open-tab UI state (dirty + epoch), keyed by node id.
	const tabMeta = useRef<Record<string, { dirty: boolean; epoch: number }>>({})
	const [, forceRerender] = useState(0)

	const { settings, setSettings } = useSettings()
	useTheme(settings.theme)
	const [showSettings, setShowSettings] = useState(false)
	const [showAi, setShowAi] = useState(false)

	// Latest editor content per node, mirrored on every keystroke so download
	// and other actions can read the live value before it is persisted.
	const liveMarkdown = useRef<Record<string, string>>({})

	useEffect(() => saveWorkspace(workspace), [workspace])
	useEffect(() => saveTabs(tabs), [tabs])

	const nodeById = (id: string | null): WorkspaceNode | undefined =>
		id ? workspace.nodes[id] : undefined

	const openFile = (id: string) => {
		const node = workspace.nodes[id]
		if (!node || node.kind !== "file") return
		setTabs((s) => openNode(s, id))
	}

	const closeActiveOrTab = (id: string) => {
		// Close only removes the tab; the node stays in the workspace.
		setTabs((s) => closeTab(s, id))
	}

	const handleDelete = (id: string) => {
		const node = workspace.nodes[id]
		if (!node) return
		const childCount = getChildren(workspace, id).length
		const msg =
			childCount > 0
				? `Delete "${node.name}" and everything inside it?`
				: `Delete "${node.name}"?`
		if (!window.confirm(msg)) return
		// Compute the deletion result synchronously (deleteNode is pure) so the
		// derived removedIds are available immediately for the tab cleanup below.
		// Reading them from inside a setWorkspace updater would not work: React
		// defers the updater, so the code after setWorkspace runs before it.
		const { workspace: nextWs, removedIds } = deleteNode(workspace, id)
		setWorkspace(nextWs)
		if (removedIds.length) {
			setTabs((s) => closeTabsForNodes(s, removedIds))
			for (const removedId of removedIds) delete tabMeta.current[removedId]
		}
	}

	const createChild = (parentId: string) => {
		const { workspace: nextWs, node } = createFile(workspace, parentId)
		setWorkspace(nextWs)
		setTabs((s) => openNode(s, node.id))
	}

	const createRoot = () => {
		const { workspace: nextWs, node } = createFile(workspace, null)
		setWorkspace(nextWs)
		setTabs((s) => openNode(s, node.id))
	}

	const setTabDirtyMeta = (id: string, dirty: boolean) => {
		const prev = tabMeta.current[id] ?? { dirty: false, epoch: 0 }
		if (prev.dirty === dirty) return
		tabMeta.current[id] = { ...prev, dirty }
		forceRerender((n) => n + 1)
	}

	const handlePersist = (id: string, markdown: string) => {
		liveMarkdown.current[id] = markdown
		setWorkspace((ws) => setNodeMarkdown(ws, id, markdown))
		setTabDirtyMeta(id, false)
	}

	// Download the active tab's current content and mark it clean. Used by both
	// Cmd/Ctrl+S and the toolbar Download button.
	const downloadActiveTab = () => {
		const id = tabs.activeTabId
		const node = nodeById(id)
		if (!id || !node) return
		const markdown = liveMarkdown.current[id] ?? node.markdown ?? ""
		downloadMarkdown(node.name, markdown)
		setTabDirtyMeta(id, false)
	}

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault()
				downloadActiveTab()
			}
			if (e.key === "Escape" && showSettings) {
				setShowSettings(false)
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	})

	// A dropped markdown file creates a NEW workspace node and opens it.
	const openMarkdownFile = async (file: File) => {
		const markdown = await file.text()
		const { workspace: created, node } = createFile(workspace, null, file.name)
		setWorkspace(setNodeMarkdown(created, node.id, markdown))
		setTabs((s) => openNode(s, node.id))
	}

	const openNodes = tabs.openTabIds
		.map((id) => workspace.nodes[id])
		.filter((n): n is WorkspaceNode => Boolean(n))

	return (
		<AiClientProvider>
			<div className="flex h-screen w-full gap-2 bg-background p-2">
				<DocSidebar
					workspace={workspace}
					activeNodeId={tabs.activeTabId}
					onWorkspaceChange={setWorkspace}
					onOpenFile={openFile}
					onDeleteNode={handleDelete}
					onCreateChild={createChild}
					onCreateRoot={createRoot}
					showSettings={showSettings}
					settings={settings}
					onChangeSettings={setSettings}
					onCloseSettings={() => setShowSettings(false)}
				/>
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
					<TabStrip
						tabs={openNodes.map((n) => ({
							id: n.id,
							label: tabLabel(n.name, tabMeta.current[n.id]?.dirty ?? false),
						}))}
						activeTabId={tabs.activeTabId}
						onActivate={(id) => setTabs((s) => activate(s, id))}
						onClose={closeActiveOrTab}
						onNew={createRoot}
						actions={
							<>
								<DownloadButton onClick={downloadActiveTab} />
								<AiPanelToggle
									active={showAi}
									onClick={() => setShowAi((v) => !v)}
								/>
								<SettingsButton onClick={() => setShowSettings(true)} />
							</>
						}
					/>
					<div
						className="relative min-h-0 flex-1"
						onDrop={(e) => {
							const file = Array.from(e.dataTransfer.files)[0]
							// Images are handled inline by the editor (they stopPropagation);
							// here we only handle markdown files → new workspace node.
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
						{openNodes.map((node) => {
							const isActive = node.id === tabs.activeTabId
							const epoch = tabMeta.current[node.id]?.epoch ?? 0
							return (
								<div
									key={`${node.id}:${epoch}`}
									className={isActive ? "h-full w-full" : "hidden"}
								>
									<PlateController>
										<EditorDndProvider>
											<WebEditor
												fileName={node.name}
												initialMarkdown={node.markdown ?? ""}
												autoSave={settings.autoSave}
												autoSaveDelayMs={settings.autoSaveDelayMs}
												onChange={(md) => {
													liveMarkdown.current[node.id] = md
												}}
												onPersist={(md) => handlePersist(node.id, md)}
												onDirtyChange={(dirty) =>
													setTabDirtyMeta(node.id, dirty)
												}
											/>
										</EditorDndProvider>
									</PlateController>
								</div>
							)
						})}
					</div>
				</div>
				{showAi ? <AiPanel onClose={() => setShowAi(false)} /> : null}
			</div>
		</AiClientProvider>
	)
}
