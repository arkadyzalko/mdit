import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsConfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

// On GitHub Pages the app is served from a subpath (/<repo>/). Set
// GH_PAGES_BASE at build time (the Actions workflow does this); locally the
// base stays "/" so dev and preview work unchanged.
const base = process.env.GH_PAGES_BASE ?? "/"

export default defineConfig({
	base,
	server: {
		port: 3100,
	},
	ssr: {
		// Let Vite transform these packages (incl. their bare CSS imports)
		// during dev SSR instead of Node's ESM loader, which cannot load ".css".
		noExternal: ["@platejs/math", "katex"],
	},
	plugins: [
		tailwindcss(),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart({
			// Emit a static SPA shell so the app can be hosted on any static
			// host (GitHub Pages) with no server/database.
			spa: { enabled: true },
		}),
		viteReact(),
	],
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
})
