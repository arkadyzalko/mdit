import { readJSON, writeJSON } from "./storage"
import {
	fromPersisted,
	type PersistedTabsState,
	toPersisted,
	type WebTabsState,
} from "./web-tabs"

export const TABS_STORAGE_KEY = "mdit.web.tabs"

export function loadPersistedTabsState(): WebTabsState | null {
	const stored = readJSON<PersistedTabsState>(TABS_STORAGE_KEY)
	if (!stored || !Array.isArray(stored.tabs) || stored.tabs.length === 0) {
		return null
	}
	return fromPersisted(stored)
}

export function savePersistedTabsState(
	state: WebTabsState,
	markdownByTab: Record<string, string>,
): void {
	writeJSON(TABS_STORAGE_KEY, toPersisted(state, markdownByTab))
}
