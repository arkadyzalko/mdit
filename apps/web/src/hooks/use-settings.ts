import { useCallback, useState } from "react"
import { loadSettings, saveSettings, type WebSettings } from "../lib/settings"

export function useSettings() {
	const [settings, setSettingsState] = useState<WebSettings>(loadSettings)
	const setSettings = useCallback((next: WebSettings) => {
		setSettingsState(next)
		saveSettings(next)
	}, [])
	return { settings, setSettings }
}
