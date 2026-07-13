import { readJSON, writeJSON } from "./storage"
import { createEmptyTabsState, type TabsState } from "./web-tabs"
import { seedWorkspace, type Workspace } from "./workspace"

export const WORKSPACE_STORAGE_KEY = "mdit.web.workspace"
export const OPEN_TABS_STORAGE_KEY = "mdit.web.openTabs"

export function loadWorkspace(): {
	workspace: Workspace
	seededFileId: string | null
} {
	const stored = readJSON<Workspace>(WORKSPACE_STORAGE_KEY)
	if (stored?.nodes && Object.keys(stored.nodes).length > 0) {
		return { workspace: stored, seededFileId: null }
	}
	const { workspace, fileId } = seedWorkspace()
	return { workspace, seededFileId: fileId }
}

export function saveWorkspace(ws: Workspace): void {
	writeJSON(WORKSPACE_STORAGE_KEY, ws)
}

export function loadTabs(): TabsState {
	const stored = readJSON<TabsState>(OPEN_TABS_STORAGE_KEY)
	if (stored && Array.isArray(stored.openTabIds)) return stored
	return createEmptyTabsState()
}

export function saveTabs(state: TabsState): void {
	writeJSON(OPEN_TABS_STORAGE_KEY, state)
}
