export type WebTab = {
	id: string
	name: string
	initialMarkdown: string
	isFile: boolean
	dirty: boolean
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
	}
}

export function createInitialTabsState(): WebTabsState {
	const tab = createEmptyTab()
	return { tabs: [tab], activeTabId: tab.id }
}

export function isTabEmpty(tab: WebTab): boolean {
	return !tab.isFile && !tab.dirty
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
		const neighbor = remaining[index - 1] ?? remaining[index] ?? remaining[0]
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
