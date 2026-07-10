import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsConfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
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
		tanstackStart(),
		viteReact(),
	],
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
})
