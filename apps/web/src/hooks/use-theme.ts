import { useEffect } from "react"
import type { ThemePreference } from "../lib/settings"

function systemPrefersDark(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	)
}

function applyDark(dark: boolean) {
	document.documentElement.classList.toggle("dark", dark)
}

/**
 * Applies the theme preference to the document. When the preference is
 * "system", it follows the OS setting and keeps following live changes to it.
 */
export function useTheme(preference: ThemePreference) {
	useEffect(() => {
		if (preference !== "system") {
			applyDark(preference === "dark")
			return
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)")
		applyDark(media.matches)
		const onChange = () => applyDark(media.matches)
		media.addEventListener("change", onChange)
		return () => media.removeEventListener("change", onChange)
	}, [preference])
}

export { systemPrefersDark }
