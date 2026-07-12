import { readJSON, writeJSON } from "./storage"

export const AUTO_SAVE_DELAYS = [500, 1000, 2000] as const
export type AutoSaveDelay = (typeof AUTO_SAVE_DELAYS)[number]

export const THEMES = ["light", "dark", "system"] as const
export type ThemePreference = (typeof THEMES)[number]

export type WebSettings = {
	autoSave: boolean
	autoSaveDelayMs: number
	theme: ThemePreference
}

export const DEFAULT_SETTINGS: WebSettings = {
	autoSave: true,
	autoSaveDelayMs: 1000,
	theme: "system",
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
	const theme = THEMES.includes(stored?.theme as ThemePreference)
		? (stored?.theme as ThemePreference)
		: DEFAULT_SETTINGS.theme
	return { autoSave, autoSaveDelayMs, theme }
}

export function saveSettings(s: WebSettings): void {
	writeJSON(SETTINGS_STORAGE_KEY, s)
}
