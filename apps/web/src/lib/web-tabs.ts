// A tab is a reference to a workspace file node (see workspace.ts). The
// workspace tree owns file identity/name/content; this module only tracks
// which nodes are open and which one is active. Per-tab UI state (dirty) is
// kept on the route's own ref, not in TabsState, so open/close operations
// stay simple array ops.

export type TabsState = {
	openTabIds: string[]
	activeTabId: string | null
}

export function createEmptyTabsState(): TabsState {
	return { openTabIds: [], activeTabId: null }
}

export function openNode(state: TabsState, nodeId: string): TabsState {
	if (state.openTabIds.includes(nodeId)) {
		return { ...state, activeTabId: nodeId }
	}
	return {
		openTabIds: [...state.openTabIds, nodeId],
		activeTabId: nodeId,
	}
}

export function activate(state: TabsState, nodeId: string): TabsState {
	if (!state.openTabIds.includes(nodeId)) return state
	return { ...state, activeTabId: nodeId }
}

export function closeTab(state: TabsState, nodeId: string): TabsState {
	const index = state.openTabIds.indexOf(nodeId)
	if (index === -1) return state
	const remaining = state.openTabIds.filter((id) => id !== nodeId)
	if (remaining.length === 0) {
		return { openTabIds: [], activeTabId: null }
	}
	let activeTabId = state.activeTabId
	if (state.activeTabId === nodeId) {
		// Activate the left neighbor; when closing the leftmost tab there is no
		// left neighbor, so fall back to the new leftmost (the old right neighbor).
		activeTabId = remaining[index - 1] ?? remaining[0]
	}
	return { openTabIds: remaining, activeTabId }
}

export function closeTabsForNodes(
	state: TabsState,
	nodeIds: string[],
): TabsState {
	let next = state
	for (const id of nodeIds) next = closeTab(next, id)
	return next
}

// Display label for a tab: appends a dot when it has unsaved changes. Shared
// by the tab strip and the sidebar so the "•" convention lives in one place.
export function tabLabel(name: string, dirty: boolean): string {
	return dirty ? `${name} •` : name
}
