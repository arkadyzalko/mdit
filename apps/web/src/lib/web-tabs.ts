export type WebTab = {
	id: string
	name: string
	initialMarkdown: string
	isFile: boolean
	dirty: boolean
	// Bumped whenever new content is loaded into this tab (e.g. a file is
	// dropped onto a reused empty tab). The route includes it in the editor's
	// React key so reusing a tab remounts the editor with the new content
	// instead of keeping the stale empty instance.
	epoch: number
}

export type WebTabsState = {
	tabs: WebTab[]
	activeTabId: string
}

export function createEmptyTab(): WebTab {
	return {
		id: crypto.randomUUID(),
		name: "Untitled",
		initialMarkdown: "",
		isFile: false,
		dirty: false,
		epoch: 0,
	}
}

export function createInitialTabsState(): WebTabsState {
	const tab = createEmptyTab()
	return { tabs: [tab], activeTabId: tab.id }
}

export function isTabEmpty(tab: WebTab): boolean {
	return !tab.isFile && !tab.dirty
}

// Display label for a tab: appends a dot when it has unsaved changes. Shared by
// the tab strip and the sidebar so the "•" convention lives in one place.
export function tabLabel(tab: WebTab): string {
	return tab.dirty ? `${tab.name} •` : tab.name
}

function activeTab(state: WebTabsState): WebTab | undefined {
	return state.tabs.find((t) => t.id === state.activeTabId)
}

export function openFileInTabs(
	state: WebTabsState,
	file: { name: string; markdown: string },
): WebTabsState {
	const active = activeTab(state)
	if (active && isTabEmpty(active)) {
		return {
			...state,
			tabs: state.tabs.map((t) =>
				t.id === active.id
					? {
							...t,
							name: file.name,
							initialMarkdown: file.markdown,
							isFile: true,
							dirty: false,
							epoch: t.epoch + 1,
						}
					: t,
			),
		}
	}
	const tab: WebTab = {
		id: crypto.randomUUID(),
		name: file.name,
		initialMarkdown: file.markdown,
		isFile: true,
		dirty: false,
		epoch: 0,
	}
	return { tabs: [...state.tabs, tab], activeTabId: tab.id }
}

export function newTab(state: WebTabsState): WebTabsState {
	const tab = createEmptyTab()
	return { tabs: [...state.tabs, tab], activeTabId: tab.id }
}

export function closeTab(state: WebTabsState, id: string): WebTabsState {
	const index = state.tabs.findIndex((t) => t.id === id)
	if (index === -1) return state

	const remaining = state.tabs.filter((t) => t.id !== id)
	if (remaining.length === 0) {
		return createInitialTabsState()
	}

	let activeTabId = state.activeTabId
	if (state.activeTabId === id) {
		// Activate the left neighbor; when closing the leftmost tab there is no
		// left neighbor, so fall back to the new leftmost (the old right neighbor).
		const neighbor = remaining[index - 1] ?? remaining[0]
		activeTabId = neighbor.id
	}
	return { tabs: remaining, activeTabId }
}

export function setDirty(
	state: WebTabsState,
	id: string,
	dirty: boolean,
): WebTabsState {
	return {
		...state,
		tabs: state.tabs.map((t) => (t.id === id ? { ...t, dirty } : t)),
	}
}
