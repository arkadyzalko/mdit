import { readJSON, writeJSON } from "./storage"

export const AUTO_SAVE_DELAYS = [500, 1000, 2000] as const
export type AutoSaveDelay = (typeof AUTO_SAVE_DELAYS)[number]

export type WebSettings = {
	autoSave: boolean
	autoSaveDelayMs: number
}

export const DEFAULT_SETTINGS: WebSettings = {
	autoSave: true,
	autoSaveDelayMs: 1000,
}

const SETTINGS_STORAGE_KEY = "mdit.web.settings"

export function loadSettings(): WebSettings {
	const stored = readJSON<Partial<WebSettings>>(SETTINGS_STORAGE_KEY)
	const autoSave =
		typeof stored?.autoSave === "boolean"
			? stored.autoSave
			: DEFAULT_SETTINGS.autoSave
	const delay = stored?.autoSaveDelayMs
	const autoSaveDelayMs = AUTO_SAVE_DELAYS.includes(delay as AutoSaveDelay)
		? (delay as number)
		: DEFAULT_SETTINGS.autoSaveDelayMs
	return { autoSave, autoSaveDelayMs }
}

export function saveSettings(s: WebSettings): void {
	writeJSON(SETTINGS_STORAGE_KEY, s)
}
