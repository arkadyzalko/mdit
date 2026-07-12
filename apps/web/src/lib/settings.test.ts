// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings"

describe("settings", () => {
	beforeEach(() => localStorage.clear())

	it("returns defaults when nothing stored", () => {
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
	})

	it("persists and reloads settings", () => {
		saveSettings({ autoSave: false, autoSaveDelayMs: 2000, theme: "dark" })
		expect(loadSettings()).toEqual({
			autoSave: false,
			autoSaveDelayMs: 2000,
			theme: "dark",
		})
	})

	it("clamps an unknown delay back to the default", () => {
		saveSettings({ autoSave: true, autoSaveDelayMs: 9999, theme: "system" })
		expect(loadSettings().autoSaveDelayMs).toBe(
			DEFAULT_SETTINGS.autoSaveDelayMs,
		)
	})

	it("falls back to the default theme when stored value is unknown", () => {
		localStorage.setItem(
			"mdit.web.settings",
			JSON.stringify({ autoSave: true, autoSaveDelayMs: 1000, theme: "neon" }),
		)
		expect(loadSettings().theme).toBe(DEFAULT_SETTINGS.theme)
	})

	it("fills missing fields from defaults", () => {
		localStorage.setItem(
			"mdit.web.settings",
			JSON.stringify({ autoSave: false }),
		)
		const s = loadSettings()
		expect(s.autoSave).toBe(false)
		expect(s.autoSaveDelayMs).toBe(DEFAULT_SETTINGS.autoSaveDelayMs)
		expect(s.theme).toBe(DEFAULT_SETTINGS.theme)
	})
})
