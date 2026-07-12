/// <reference types="vite/client" />

import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import appCss from "../styles/globals.css?url"

// Set the theme class before paint to avoid a flash of the wrong theme.
// Honors the persisted preference (light/dark/system); falls back to system.
const themeInitScript = `
try {
	var stored = null
	try { stored = JSON.parse(localStorage.getItem('mdit.web.settings') || 'null') } catch (_) {}
	var pref = stored && stored.theme ? stored.theme : 'system'
	var dark = pref === 'dark' ||
		(pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
	if (dark) document.documentElement.classList.add('dark')
} catch (_) {}
`

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "mdit — web editor" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				{/* Static, no user input — sets theme class before paint. */}
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	)
}
