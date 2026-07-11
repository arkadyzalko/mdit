// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings"

describe("settings", () => {
	beforeEach(() => localStorage.clear())

	it("returns defaults when nothing stored", () => {
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
	})

	it("persists and reloads settings", () => {
		saveSettings({ autoSave: false, autoSaveDelayMs: 2000 })
		expect(loadSettings()).toEqual({ autoSave: false, autoSaveDelayMs: 2000 })
	})

	it("clamps an unknown delay back to the default", () => {
		saveSettings({ autoSave: true, autoSaveDelayMs: 9999 })
		expect(loadSettings().autoSaveDelayMs).toBe(
			DEFAULT_SETTINGS.autoSaveDelayMs,
		)
	})

	it("fills missing fields from defaults", () => {
		localStorage.setItem(
			"mdit.web.settings",
			JSON.stringify({ autoSave: false }),
		)
		const s = loadSettings()
		expect(s.autoSave).toBe(false)
		expect(s.autoSaveDelayMs).toBe(DEFAULT_SETTINGS.autoSaveDelayMs)
	})
})
