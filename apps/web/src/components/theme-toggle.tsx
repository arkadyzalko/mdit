import { Button } from "@mdit/ui/components/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

type Theme = "light" | "dark"

function systemTheme(): Theme {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light"
}

function applyTheme(theme: Theme) {
	document.documentElement.classList.toggle("dark", theme === "dark")
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("light")

	// Initialize from the system preference once, on the client.
	useEffect(() => {
		const initial = systemTheme()
		setTheme(initial)
		applyTheme(initial)
	}, [])

	const toggle = () => {
		const next: Theme = theme === "dark" ? "light" : "dark"
		setTheme(next)
		applyTheme(next)
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Toggle theme"
			className="absolute top-3 right-3 z-40"
			onClick={toggle}
		>
			{theme === "dark" ? (
				<Sun className="size-4" />
			) : (
				<Moon className="size-4" />
			)}
		</Button>
	)
}
