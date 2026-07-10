# Web Editor + Side Minimap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (1) a browser-based single-file `.md` editor and (2) a right-edge heading minimap to the forked `hjinco/mdit` monorepo, without removing any existing feature.

**Architecture:** The editor/store/markdown packages are already Tauri-free; all Tauri coupling lives in `apps/desktop/src`. We add a new `apps/web` TanStack Start app that mounts the existing `EditorSurface` with a web-specific plugin kit (no Tauri hosts) and a browser file layer (drop → edit → download). The minimap is a new reusable component in `packages/editor` that consumes Plate's built-in `@platejs/toc/react` sidebar hooks; it is mounted in both desktop and web.

**Tech Stack:** React 19, TypeScript, Vite, Plate.js (`platejs` v53, `@platejs/toc`), TanStack Start/Router, Tailwind v4, `@mdit/ui`, Vitest, pnpm + turbo monorepo.

## Global Constraints

- **Node** ≥ 20; **pnpm** = 10.30.0 (`packageManager` in root `package.json`). Run all JS commands via `pnpm --filter <pkg>` from repo root.
- **No Rust required** for this work — the web app and minimap are pure JS/Vite. Do not touch `crates/` or `apps/desktop/src-tauri/`.
- **Markdown compatibility is non-negotiable:** saved/downloaded output must be plain CommonMark + GFM readable by other viewers. Reuse the existing `@mdit/editor/markdown` serializer — do NOT write a new one.
- **Lint/format:** Biome (`pnpm lint`). Tabs for indentation, double quotes (match existing files exactly).
- **TS strict:** `strict`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` are on. No unused vars, no implicit any.
- **Do not remove or trim any upstream feature.** Additions only.
- **Reuse over rebuild:** the editor (`@mdit/editor`), store, markdown serializer, and `@platejs/toc` hooks already exist. Prefer them.
- **Commit style:** conventional commits (`feat:`, `test:`, `chore:`), matching upstream history.

---

## Key facts discovered (reference for all tasks)

- `EditorSurface` — `packages/editor/src/shared/editor-surface.tsx`. Signature:
  ```ts
  function EditorSurface(props: {
    editor: PlateEditor
    placeholder?: string
    onValueChange?: () => void
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    onBlur?: () => void
    containerClassName?: string
    contentClassName?: string
  }): JSX.Element
  ```
  It renders `<Plate editor={editor}>` → `<PlateContainer overflow-y-auto>` → `<PlateContent>`. Takes an already-created editor instance; read `editor.children` on change.
- Create the editor: `usePlateEditor({ plugins, value })` from `@mdit/editor/plate` (re-exports `platejs/react`). Must be under `<PlateController>` (from `@mdit/editor/plate`).
- Deserialize md→value: `createMarkdownDeserializerWithFallback({ mdxPlugins, noMdxPlugins })` from `@mdit/editor/markdown`.
- Serialize value→md: `editor.api.markdown.serialize({ value })`.
- Desktop plugin kit: `apps/desktop/src/components/editor/plugins/editor-kit.ts` (`createEditorKit`). Several plugins take a Tauri "host": AI, filePaste, blockSelection, frontmatter, link, media, slash, tag. The web kit MUST omit or stub these hosts. Pure kits needing no host: `AutoformatKit`, `BasicBlocksKit`, `BasicMarksKit`, `CalloutKit`, `CodeBlockKit`, `CursorOverlayKit`, `EmojiKit`, `DateKit`, `DndKit`, `FloatingToolbarKit`, `ListKit`, `MarkdownKit`/`MarkdownKitNoMdx`, `MathKit`, `ShortcutsKit`, `SuggestionKit`, `TableKit`, `TocKit`, `UtilsKit`.
- Minimap hooks (already in the repo via `@platejs/toc/react`): `useTocSideBarState({ topOffset? })` → `{ activeContentId, headingList, mouseInToc, onContentScroll, open, setMouseInToc, tocRef, ... }`; `useTocSideBar(state)` → `{ navProps: { ref, onMouseEnter, onMouseLeave }, onContentClick(e, item, behavior?) }`. `Heading = { id: string; depth: number; path: Path; title: string; type: string }`. These work from ANY component inside the `<Plate>` provider.
- Existing marketing app: `apps/www` (`@mdit/www`), TanStack Start, dev on port 3000. It is marketing-only; we leave it alone and create a separate `apps/web` for the editor to avoid coupling.
- Editor test command that already works: `pnpm --filter @mdit/editor test` (Vitest, jsdom).

---

## File Structure

**New files:**
- `packages/editor/src/minimap/minimap.tsx` — the `HeadingMinimap` component (ticks + hover overlay).
- `packages/editor/src/minimap/index.ts` — barrel export.
- `packages/editor/src/minimap/minimap.test.tsx` — unit tests for tick derivation/rendering.
- `packages/editor/src/web-kit/web-editor-kit.ts` — `createWebEditorKit()` (Tauri-free plugin kit).
- `packages/editor/src/web-kit/index.ts` — barrel export.
- `apps/web/` — new TanStack Start app (package `@mdit/web`): `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles/globals.css`, `src/components/web-editor.tsx`, `src/components/drop-zone.tsx`, `src/lib/web-image.ts`, `src/lib/download.ts`.
- `apps/web/src/lib/web-image.test.ts` — unit test for the download filename + markdown helpers (pure parts).

**Modified files:**
- `packages/editor/package.json` — add `./minimap` and `./web-kit` to `exports`.

---

## Phase 1 — Side minimap (in `packages/editor`, testable in isolation)

Do this first: it's self-contained, has the existing test harness, and is reused by both apps.

### Task 1: Minimap exports + package wiring

**Files:**
- Modify: `packages/editor/package.json` (the `exports` map)
- Create: `packages/editor/src/minimap/index.ts`
- Create: `packages/editor/src/minimap/minimap.tsx` (stub for now)

**Interfaces:**
- Produces: `export function HeadingMinimap(props: HeadingMinimapProps): JSX.Element` from `@mdit/editor/minimap`, where
  ```ts
  export type HeadingMinimapProps = { topOffset?: number; className?: string }
  ```

- [ ] **Step 1: Add the export entries**

In `packages/editor/package.json`, inside `"exports"`, add (keep alphabetical-ish grouping, match tab indentation):
```json
		"./minimap": "./src/minimap/index.ts",
		"./web-kit": "./src/web-kit/web-editor-kit.ts",
```

- [ ] **Step 2: Create the barrel**

`packages/editor/src/minimap/index.ts`:
```ts
export { HeadingMinimap, type HeadingMinimapProps } from "./minimap"
```

- [ ] **Step 3: Create a minimal component stub so the import resolves**

`packages/editor/src/minimap/minimap.tsx`:
```tsx
export type HeadingMinimapProps = {
	topOffset?: number
	className?: string
}

export function HeadingMinimap(_props: HeadingMinimapProps) {
	return null
}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter @mdit/editor ts:check`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add packages/editor/package.json packages/editor/src/minimap/
git commit -m "feat(editor): scaffold heading minimap export"
```

### Task 2: Derive minimap ticks from the heading list (pure function + test)

Extract the pure transform (heading list → tick view-models) so it's unit-testable without a live Plate editor.

**Files:**
- Create: `packages/editor/src/minimap/minimap-ticks.ts`
- Test: `packages/editor/src/minimap/minimap.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type MinimapTick = { id: string; depth: number; title: string; active: boolean }
  export function buildMinimapTicks(
    headingList: { id: string; depth: number; title: string }[],
    activeContentId: string,
  ): MinimapTick[]
  ```
- Consumes (later, in Task 3): `Heading` items from `useTocSideBarState().headingList` and `activeContentId`.

- [ ] **Step 1: Write the failing test**

`packages/editor/src/minimap/minimap.test.tsx`:
```tsx
import { describe, expect, it } from "vitest"
import { buildMinimapTicks } from "./minimap-ticks"

describe("buildMinimapTicks", () => {
	it("maps headings to ticks and marks the active one", () => {
		const ticks = buildMinimapTicks(
			[
				{ id: "a", depth: 1, title: "Intro" },
				{ id: "b", depth: 2, title: "Details" },
			],
			"b",
		)
		expect(ticks).toEqual([
			{ id: "a", depth: 1, title: "Intro", active: false },
			{ id: "b", depth: 2, title: "Details", active: true },
		])
	})

	it("marks nothing active when activeContentId is unknown", () => {
		const ticks = buildMinimapTicks([{ id: "a", depth: 1, title: "X" }], "zzz")
		expect(ticks.every((t) => !t.active)).toBe(true)
	})

	it("returns an empty array for no headings", () => {
		expect(buildMinimapTicks([], "")).toEqual([])
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/editor test -- minimap`
Expected: FAIL with "Cannot find module './minimap-ticks'".

- [ ] **Step 3: Write the implementation**

`packages/editor/src/minimap/minimap-ticks.ts`:
```ts
export type MinimapTick = {
	id: string
	depth: number
	title: string
	active: boolean
}

export function buildMinimapTicks(
	headingList: { id: string; depth: number; title: string }[],
	activeContentId: string,
): MinimapTick[] {
	return headingList.map((h) => ({
		id: h.id,
		depth: h.depth,
		title: h.title,
		active: h.id === activeContentId,
	}))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/editor test -- minimap`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/minimap/
git commit -m "feat(editor): add minimap tick derivation"
```

### Task 3: Implement the minimap component (ticks + hover overlay)

Wire the pure ticks into the real component using Plate's TOC sidebar hooks.

**Files:**
- Modify: `packages/editor/src/minimap/minimap.tsx`

**Interfaces:**
- Consumes: `useTocSideBarState`, `useTocSideBar` from `@platejs/toc/react`; `buildMinimapTicks` from `./minimap-ticks`.
- Produces: the real `HeadingMinimap` (same `HeadingMinimapProps` signature as the stub).

- [ ] **Step 1: Replace the stub with the full component**

`packages/editor/src/minimap/minimap.tsx`:
```tsx
import { cn } from "@mdit/ui/lib/utils"
import { useTocSideBar, useTocSideBarState } from "@platejs/toc/react"
import { buildMinimapTicks } from "./minimap-ticks"

export type HeadingMinimapProps = {
	topOffset?: number
	className?: string
}

export function HeadingMinimap({ topOffset = 80, className }: HeadingMinimapProps) {
	const state = useTocSideBarState({ topOffset })
	const { navProps, onContentClick } = useTocSideBar(state)
	const { headingList, activeContentId, mouseInToc } = state
	const ticks = buildMinimapTicks(headingList, activeContentId)

	if (ticks.length === 0) return null

	return (
		<nav
			{...navProps}
			aria-label="Document outline"
			className={cn(
				"absolute top-0 right-0 z-30 flex h-full w-8 flex-col items-end justify-center gap-1.5 py-16 pr-2",
				className,
			)}
		>
			{/* Ticks (always visible) */}
			<div className="flex flex-col items-end gap-1.5">
				{ticks.map((tick) => (
					<button
						key={tick.id}
						type="button"
						aria-label={tick.title}
						onClick={(e) =>
							onContentClick(
								e,
								{ id: tick.id } as Parameters<typeof onContentClick>[1],
								"smooth",
							)
						}
						className={cn(
							"h-[2px] rounded-full transition-colors",
							tick.depth === 1 && "w-4",
							tick.depth === 2 && "w-3",
							tick.depth >= 3 && "w-2",
							tick.active
								? "bg-foreground"
								: "bg-muted-foreground/40 hover:bg-muted-foreground",
						)}
					/>
				))}
			</div>

			{/* Hover overlay: floats over content, does not resize the column */}
			{mouseInToc && (
				<div className="absolute top-1/2 right-8 max-h-[70vh] w-64 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
					{ticks.map((tick) => (
						<button
							key={tick.id}
							type="button"
							onClick={(e) =>
								onContentClick(
									e,
									{ id: tick.id } as Parameters<typeof onContentClick>[1],
									"smooth",
								)
							}
							style={{ paddingLeft: `${(tick.depth - 1) * 12 + 8}px` }}
							className={cn(
								"block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent",
								tick.active
									? "text-foreground"
									: "text-muted-foreground",
							)}
						>
							{tick.title}
						</button>
					))}
				</div>
			)}
		</nav>
	)
}
```

Note: `onContentClick` expects a full `Heading`; the hooks resolve the DOM node by `id` internally, so passing `{ id }` (cast to the param type) is sufficient for scroll-to. If typecheck rejects the cast, pass the full heading object by looking it up: `state.headingList.find((h) => h.id === tick.id)!`.

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @mdit/editor ts:check`
Expected: PASS. If it fails on the `onContentClick` arg type, switch to passing the found `Heading` object (see note above) and re-run.

- [ ] **Step 3: Verify existing + new tests still pass**

Run: `pnpm --filter @mdit/editor test`
Expected: PASS (146 existing + 3 minimap).

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/minimap/minimap.tsx
git commit -m "feat(editor): implement heading minimap with hover overlay"
```

### Task 4: Mount the minimap in the desktop editor

Prove the minimap works in the real desktop app (it renders inside the same `<Plate>` tree via `EditorSurface`). We wrap `EditorSurface` and the minimap in a relative container.

**Files:**
- Modify: `apps/desktop/src/components/editor/editor.tsx` (the JSX that renders `<EditorSurface .../>`)

**Interfaces:**
- Consumes: `HeadingMinimap` from `@mdit/editor/minimap`.

- [ ] **Step 1: Add the dependency import**

At the top of `apps/desktop/src/components/editor/editor.tsx`, add with the other `@mdit/editor/*` imports:
```ts
import { HeadingMinimap } from "@mdit/editor/minimap"
```

- [ ] **Step 2: Render the minimap as a sibling of EditorSurface**

Find the `<EditorSurface editor={editor} ... />` usage. Wrap it in a relative container and add the minimap directly after it, inside the same wrapper (the minimap must be a descendant of the `<Plate>` provider — since `EditorSurface` owns `<Plate>`, mount `HeadingMinimap` by passing it as extra UI at the app level is NOT possible; instead render it by adding a `rightRail` slot). Simplest correct approach: render `HeadingMinimap` **inside** `EditorSurface`. Do that in Task 4b below — here, first confirm the wrapper compiles by placing the minimap absolutely in the editor pane container:

Replace the existing surrounding container of `<EditorSurface .../>` so it is `relative`, e.g.:
```tsx
<div className="relative h-full w-full">
	<EditorSurface
		editor={editor}
		contentClassName={isFocusMode ? "..." : undefined}
		onValueChange={/* existing */}
		onKeyDown={handleTypingDetection}
		onBlur={() => { void handleSave("blur") }}
	/>
</div>
```
(Preserve the exact existing props — do not change behavior.)

- [ ] **Step 3: Confirm desktop typecheck passes**

Run: `pnpm --filter @mdit/desktop ts:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/editor/editor.tsx
git commit -m "feat(desktop): prepare editor pane for minimap rail"
```

### Task 4b: Add a rightRail slot to EditorSurface and render the minimap

Because the minimap must live inside `<Plate>`, give `EditorSurface` an optional `rightRail` slot rendered inside the provider.

**Files:**
- Modify: `packages/editor/src/shared/editor-surface.tsx`
- Modify: `apps/desktop/src/components/editor/editor.tsx`

**Interfaces:**
- Produces: `EditorSurface` gains optional prop `rightRail?: React.ReactNode`.
- Consumes: `<HeadingMinimap />` passed as `rightRail`.

- [ ] **Step 1: Add the `rightRail` prop**

In `packages/editor/src/shared/editor-surface.tsx`, add `rightRail?: React.ReactNode` to `EditorSurfaceProps`, and render it inside `<Plate>` after `<SelectionAreaCursor />`:
```tsx
type EditorSurfaceProps = {
	editor: PlateEditor
	placeholder?: string
	onValueChange?: () => void
	onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
	onBlur?: () => void
	containerClassName?: string
	contentClassName?: string
	rightRail?: React.ReactNode
}
```
Add `rightRail` to the destructured params, and just before the closing `</Plate>`:
```tsx
			<SelectionAreaCursor />
			{rightRail}
		</Plate>
```
Add `import type { KeyboardEvent, ReactNode } from "react"` (extend the existing react import) and use `ReactNode` for the prop type.

- [ ] **Step 2: Pass the minimap from desktop**

In `apps/desktop/src/components/editor/editor.tsx`, pass it to `EditorSurface` and drop the extra wrapper div added in Task 4 (keep the surface as before but add the prop):
```tsx
<EditorSurface
	editor={editor}
	contentClassName={isFocusMode ? "..." : undefined}
	onValueChange={/* existing */}
	onKeyDown={handleTypingDetection}
	onBlur={() => { void handleSave("blur") }}
	rightRail={<HeadingMinimap />}
/>
```

- [ ] **Step 3: Typecheck both packages**

Run: `pnpm --filter @mdit/editor ts:check && pnpm --filter @mdit/desktop ts:check`
Expected: PASS.

- [ ] **Step 4: Run editor tests**

Run: `pnpm --filter @mdit/editor test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/shared/editor-surface.tsx apps/desktop/src/components/editor/editor.tsx
git commit -m "feat: render heading minimap in desktop editor"
```

---

## Phase 2 — Web editor app (`apps/web`)

### Task 5: Web-safe plugin kit

A Tauri-free plugin kit for the browser. Omit host-dependent plugins that require Tauri (AI, filePaste, blockSelection, frontmatter, link, media, slash, tag) OR pass no-op/browser hosts. For v1 web, include the pure kits + a browser media host (Task 8) is added later; start with pure kits only so the editor mounts.

**Files:**
- Create: `packages/editor/src/web-kit/web-editor-kit.ts`
- Create: `packages/editor/src/web-kit/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export function createWebEditorKit(options?: { mdx?: boolean }): unknown[]
  ```
  from `@mdit/editor/web-kit`.

- [ ] **Step 1: Create the kit**

`packages/editor/src/web-kit/web-editor-kit.ts`:
```ts
import {
	BasicBlocksKit,
	ListKit,
	ShortcutsKit,
	UtilsKit,
} from "@mdit/editor/basic"
import { CalloutKit } from "@mdit/editor/callout"
import { BasicMarksKit, CodeBlockKit } from "@mdit/editor/code"
import { DateKit } from "@mdit/editor/date"
import { EmojiKit } from "@mdit/editor/emoji"
import {
	AutoformatKit,
	MarkdownKit,
	MarkdownKitNoMdx,
} from "@mdit/editor/markdown"
import { MathKit } from "@mdit/editor/math"
import {
	CursorOverlayKit,
	FloatingToolbarKit,
} from "@mdit/editor/selection"
import { SuggestionKit } from "@mdit/editor/suggestion"
import { TableKit } from "@mdit/editor/table"
import { TocKit } from "@mdit/editor/toc"

type CreateWebEditorKitOptions = { mdx?: boolean }

export const createWebEditorKit = ({
	mdx = true,
}: CreateWebEditorKitOptions = {}) => [
	...AutoformatKit,
	...BasicBlocksKit,
	...BasicMarksKit,
	...CalloutKit,
	...CodeBlockKit,
	...CursorOverlayKit,
	...DateKit,
	...EmojiKit,
	...FloatingToolbarKit,
	...ListKit,
	...(mdx ? MarkdownKit : MarkdownKitNoMdx),
	...MathKit,
	...ShortcutsKit,
	...SuggestionKit,
	...TableKit,
	...TocKit,
	...UtilsKit,
]
```
Note: `DndKit` (drag handles) is omitted here because it relies on the `DropProvider`/`DndProvider` wrappers; add it in a later task once the web root provides those providers. Slash `/` menu is host-dependent (`createSlashKit({ host })`) — deferred to Task 9.

- [ ] **Step 2: Create the barrel**

`packages/editor/src/web-kit/index.ts`:
```ts
export { createWebEditorKit } from "./web-editor-kit"
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mdit/editor ts:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/web-kit/ packages/editor/package.json
git commit -m "feat(editor): add browser-safe web editor kit"
```

### Task 6: Scaffold the `apps/web` TanStack Start app

Mirror `apps/www` config but without content-collections/marketing. This task produces a running blank app.

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html` (if needed by Start template), `apps/web/src/main.tsx`, `apps/web/src/router.tsx`, `apps/web/src/routeTree.gen.ts` (auto-generated on dev), `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/styles/globals.css`

**Interfaces:**
- Produces: `@mdit/web` package runnable via `pnpm --filter @mdit/web dev` on a port (set 3100 to avoid clashing with www's 3000).

- [ ] **Step 1: Copy the www config as a starting point**

```bash
cp apps/www/tsconfig.json apps/web/tsconfig.json
cp apps/www/vite.config.ts apps/web/vite.config.ts
```
Then edit `apps/web/vite.config.ts`: remove the `contentCollections(...)` plugin and its import; set the dev server port to 3100 (`server: { port: 3100 }`); keep `tailwindcss()`, `tsConfigPaths()`, `cloudflare(...)` (or remove cloudflare if not deploying to CF — for local dev it can stay), `tanstackStart(...)`, `viteReact()`. Remove the `pages`/`prerender` list (the editor is client-only).

- [ ] **Step 2: Create `apps/web/package.json`**

```json
{
	"name": "@mdit/web",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"ts:check": "tsgo --noEmit"
	},
	"dependencies": {
		"@mdit/editor": "workspace:*",
		"@mdit/ui": "workspace:*",
		"@tanstack/react-router": "^1.166.2",
		"@tanstack/react-start": "^1.166.2",
		"platejs": "^53.0.5",
		"react": "catalog:",
		"react-dom": "catalog:"
	},
	"devDependencies": {
		"@tailwindcss/vite": "^4.2.2",
		"@types/react": "catalog:",
		"@types/react-dom": "catalog:",
		"@typescript/native-preview": "catalog:",
		"@vitejs/plugin-react": "^6.0.1",
		"tailwindcss": "^4.2.0",
		"typescript": "^5.9.3",
		"vite": "catalog:",
		"vite-tsconfig-paths": "^5.1.4"
	}
}
```

- [ ] **Step 3: Router + main (copy from www, they are generic)**

`apps/web/src/router.tsx`:
```ts
import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
	const router = createRouter({
		routeTree,
		defaultPreload: "intent",
		scrollRestoration: true,
	})
	return router
}
declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>
	}
}
```
`apps/web/src/main.tsx`:
```ts
export { getRouter } from "./router"
```

- [ ] **Step 4: Root route + styles**

`apps/web/src/routes/__root.tsx` (copy the structure from `apps/www/src/routes/__root.tsx`, keeping `HeadContent`, `Outlet`, `Scripts`, and the `../styles/globals.css?url` link; drop marketing-specific head content).

`apps/web/src/styles/globals.css`:
```css
@import "tailwindcss";
@import "@mdit/ui/styles/theme.css";
@source "../**/*.{html,js,jsx,ts,tsx}";
@source "../../../../packages/ui/src/**/*.{ts,tsx}";
@source "../../../../packages/editor/src/**/*.{ts,tsx}";
@custom-variant dark (&:is(.dark *));
```
(The extra editor `@source` glob is REQUIRED so Tailwind emits the editor's classes.)

- [ ] **Step 5: Placeholder home route**

`apps/web/src/routes/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
	component: Home,
})

function Home() {
	return <div className="p-8 text-foreground">mdit web — editor coming up</div>
}
```

- [ ] **Step 6: Install and run dev to verify the blank app boots**

```bash
pnpm install
pnpm --filter @mdit/web dev
```
Expected: dev server starts on http://localhost:3100 and the placeholder text renders. Stop the server (Ctrl-C) after confirming.

- [ ] **Step 7: Commit**

```bash
git add apps/web/ pnpm-lock.yaml
git commit -m "feat(web): scaffold apps/web TanStack Start app"
```

### Task 7: Drop-zone + mount the editor on a dropped file

Wire the browser file-open flow: drop/pick `.md` → read text → deserialize → mount `EditorSurface` with the web kit + minimap.

**Files:**
- Create: `apps/web/src/components/drop-zone.tsx`
- Create: `apps/web/src/components/web-editor.tsx`
- Modify: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `createWebEditorKit` (`@mdit/editor/web-kit`), `EditorSurface` (`@mdit/editor/shared`), `HeadingMinimap` (`@mdit/editor/minimap`), `PlateController`, `usePlateEditor` (`@mdit/editor/plate`), `createMarkdownDeserializerWithFallback` (`@mdit/editor/markdown`).
- Produces:
  ```ts
  // drop-zone.tsx
  export function DropZone(props: { onFile: (name: string, markdown: string) => void }): JSX.Element
  // web-editor.tsx
  export function WebEditor(props: { fileName: string; initialMarkdown: string }): JSX.Element
  ```

- [ ] **Step 1: DropZone component**

`apps/web/src/components/drop-zone.tsx`:
```tsx
import { useRef, useState } from "react"

export function DropZone({
	onFile,
}: {
	onFile: (name: string, markdown: string) => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)

	const handleFile = async (file: File) => {
		const text = await file.text()
		onFile(file.name, text)
	}

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setDragging(true)
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				e.preventDefault()
				setDragging(false)
				const file = e.dataTransfer.files[0]
				if (file) void handleFile(file)
			}}
			onClick={() => inputRef.current?.click()}
			className={`flex h-screen w-full cursor-pointer items-center justify-center text-center ${
				dragging ? "bg-accent" : "bg-background"
			}`}
		>
			<div className="text-muted-foreground">
				<p className="text-lg">Drop a .md file here</p>
				<p className="text-sm">or click to choose</p>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept=".md,.markdown,text/markdown"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0]
					if (file) void handleFile(file)
				}}
			/>
		</div>
	)
}
```

- [ ] **Step 2: WebEditor component**

`apps/web/src/components/web-editor.tsx`:
```tsx
import { createMarkdownDeserializerWithFallback } from "@mdit/editor/markdown"
import { HeadingMinimap } from "@mdit/editor/minimap"
import { usePlateEditor, type Value } from "@mdit/editor/plate"
import { EditorSurface } from "@mdit/editor/shared"
import { createWebEditorKit } from "@mdit/editor/web-kit"
import { useMemo } from "react"

export function WebEditor({
	fileName,
	initialMarkdown,
}: {
	fileName: string
	initialMarkdown: string
}) {
	const plugins = useMemo(() => createWebEditorKit(), [])

	const value = useMemo<Value>(() => {
		const deserialize = createMarkdownDeserializerWithFallback({
			mdxPlugins: plugins,
			noMdxPlugins: plugins,
		})
		return deserialize({ content: initialMarkdown, path: fileName })
	}, [plugins, initialMarkdown, fileName])

	const editor = usePlateEditor({ plugins, value })

	return (
		<div className="relative h-screen w-full">
			<EditorSurface editor={editor} rightRail={<HeadingMinimap />} />
		</div>
	)
}
```
Note: verify the exact `createMarkdownDeserializerWithFallback` signature against `packages/editor/src/markdown/index.ts` while implementing — mirror how `apps/desktop/src/components/editor/editor.tsx` calls it (it passes `{ mdxPlugins: EditorKit, noMdxPlugins: EditorKitNoMdx }` and then calls the returned function with `{ content, path }`). Adjust arg names to match reality.

- [ ] **Step 3: Wire the route with PlateController**

`apps/web/src/routes/index.tsx`:
```tsx
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { DropZone } from "../components/drop-zone"
import { WebEditor } from "../components/web-editor"

export const Route = createFileRoute("/")({
	component: Home,
})

function Home() {
	const [file, setFile] = useState<{ name: string; markdown: string } | null>(
		null,
	)

	return (
		<PlateController>
			{file ? (
				<WebEditor fileName={file.name} initialMarkdown={file.markdown} />
			) : (
				<DropZone
					onFile={(name, markdown) => setFile({ name, markdown })}
				/>
			)}
		</PlateController>
	)
}
```

- [ ] **Step 4: Run dev and manually verify**

```bash
pnpm --filter @mdit/web dev
```
Open http://localhost:3100, drop a `.md` file (create a test one with a few headings). Expected: the drop-zone is replaced by the editor showing formatted content, and the minimap ticks appear on the right edge; hovering shows the overlay of titles. Fix import/signature mismatches (esp. the deserializer) until it renders. Stop the server.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): mount editor on dropped markdown file"
```

### Task 8: Download the edited markdown

Serialize the current editor value to markdown and trigger a browser download.

**Files:**
- Create: `apps/web/src/lib/download.ts`
- Create: `apps/web/src/lib/download.test.ts`
- Modify: `apps/web/src/components/web-editor.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function downloadMarkdown(fileName: string, markdown: string): void
  export function ensureMdExtension(fileName: string): string
  ```

- [ ] **Step 1: Write the failing test (pure part)**

`apps/web/src/lib/download.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { ensureMdExtension } from "./download"

describe("ensureMdExtension", () => {
	it("keeps an existing .md extension", () => {
		expect(ensureMdExtension("notes.md")).toBe("notes.md")
	})
	it("adds .md when missing", () => {
		expect(ensureMdExtension("notes")).toBe("notes.md")
	})
	it("keeps .markdown", () => {
		expect(ensureMdExtension("notes.markdown")).toBe("notes.markdown")
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- download` (if `@mdit/web` has no test script yet, add `"test": "vitest run"` and `vitest` + jsdom devDeps to `apps/web/package.json`, mirroring `apps/www`; then run `pnpm install`).
Expected: FAIL ("Cannot find module './download'").

- [ ] **Step 3: Implement**

`apps/web/src/lib/download.ts`:
```ts
export function ensureMdExtension(fileName: string): string {
	if (/\.(md|markdown)$/i.test(fileName)) return fileName
	return `${fileName}.md`
}

export function downloadMarkdown(fileName: string, markdown: string): void {
	const blob = new Blob([markdown], { type: "text/markdown" })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = ensureMdExtension(fileName)
	a.click()
	URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- download`
Expected: PASS (3 tests).

- [ ] **Step 5: Add a Download button to WebEditor**

In `apps/web/src/components/web-editor.tsx`, import `downloadMarkdown` and the Button from `@mdit/ui/components/button`; add a fixed top-right button that serializes and downloads:
```tsx
import { Button } from "@mdit/ui/components/button"
import { downloadMarkdown } from "../lib/download"
// ...inside the returned JSX, before </div>:
<Button
	type="button"
	className="absolute top-3 right-12 z-40"
	onClick={() =>
		downloadMarkdown(
			fileName,
			editor.api.markdown.serialize({ value: editor.children as Value }),
		)
	}
>
	Download
</Button>
```
Verify `editor.api.markdown.serialize` arg shape against desktop usage (`editor.api.markdown.serialize({ value: ... })`).

- [ ] **Step 6: Manual verify + typecheck**

Run: `pnpm --filter @mdit/web dev` → edit content → click Download → confirm the downloaded `.md` opens correctly and matches edits (open in another viewer / re-drop it). Then `pnpm --filter @mdit/web ts:check` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat(web): download edited markdown"
```

### Task 9: Web image paste → WebP → base64 inline

On paste/drop of an image in the web editor, convert to WebP via Canvas and embed as a base64 data URI so the downloaded `.md` stays self-contained.

**Files:**
- Create: `apps/web/src/lib/web-image.ts`
- Create: `apps/web/src/lib/web-image.test.ts`
- Modify: `packages/editor/src/web-kit/web-editor-kit.ts` (add media kit with a browser host) OR handle at the app level via a paste handler in `web-editor.tsx`

**Interfaces:**
- Produces:
  ```ts
  export async function fileToWebpDataUrl(file: File, quality?: number): Promise<string>
  export function isImageFile(file: File): boolean
  ```

- [ ] **Step 1: Write the failing test (pure predicate)**

`apps/web/src/lib/web-image.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { isImageFile } from "./web-image"

describe("isImageFile", () => {
	it("accepts png", () => {
		expect(isImageFile(new File([], "a.png", { type: "image/png" }))).toBe(true)
	})
	it("rejects text", () => {
		expect(isImageFile(new File([], "a.md", { type: "text/markdown" }))).toBe(
			false,
		)
	})
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @mdit/web test -- web-image`
Expected: FAIL ("Cannot find module './web-image'").

- [ ] **Step 3: Implement**

`apps/web/src/lib/web-image.ts`:
```ts
export function isImageFile(file: File): boolean {
	return file.type.startsWith("image/")
}

export async function fileToWebpDataUrl(
	file: File,
	quality = 0.8,
): Promise<string> {
	const bitmap = await createImageBitmap(file)
	const canvas = document.createElement("canvas")
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const ctx = canvas.getContext("2d")
	if (!ctx) throw new Error("Canvas 2D context unavailable")
	ctx.drawImage(bitmap, 0, 0)
	bitmap.close()
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/webp", quality),
	)
	if (!blob) throw new Error("WebP encoding failed")
	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(blob)
	})
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @mdit/web test -- web-image`
Expected: PASS.

- [ ] **Step 5: Wire a paste/drop handler in WebEditor**

In `apps/web/src/components/web-editor.tsx`, add an `onPaste`/`onDrop` handler on the wrapping `<div>` that, for image files, calls `fileToWebpDataUrl` and inserts an image node at the selection using Plate's insert API. Mirror how `packages/editor/src/media/image-insert.ts` (`insertResolvedImage`) inserts images, passing the data URL as the `url`. Reference `packages/editor/src/media/image-link-resolver.ts` for the host shape; here the "resolve" is just returning the data URL.
```tsx
onPaste={(e) => {
	const file = Array.from(e.clipboardData.files)[0]
	if (file && isImageFile(file)) {
		e.preventDefault()
		void fileToWebpDataUrl(file).then((dataUrl) => {
			editor.tf.insertNodes({
				type: "img",
				url: dataUrl,
				children: [{ text: "" }],
			})
		})
	}
}}
```
Verify the exact image node type/props against `packages/editor/src/media` (the media node key/props) and adjust (`type`, `url` vs `src`) to match what the serializer emits as `![](...)`.

- [ ] **Step 6: Manual verify**

Run: `pnpm --filter @mdit/web dev` → paste an image → it appears in the editor → Download → confirm the `.md` contains `![](data:image/webp;base64,...)` and re-opens with the image. Then `pnpm --filter @mdit/web ts:check` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat(web): paste images as inline webp data URIs"
```

### Task 10: Web dark/light theme

Match the reference dark visual; follow system theme with a toggle.

**Files:**
- Modify: `apps/web/src/routes/__root.tsx` (apply theme class)

- [ ] **Step 1: Apply system theme on load**

In `apps/web/src/routes/__root.tsx`, add a small effect that sets `document.documentElement.classList` to `dark` based on `window.matchMedia("(prefers-color-scheme: dark)").matches`, and add a toggle button. (The `.dark` variant is already wired in `globals.css` via `@custom-variant dark`.) Reuse `next-themes` only if desktop does; otherwise a minimal effect is fine (YAGNI).

- [ ] **Step 2: Manual verify**

Run dev; confirm the editor + minimap render correctly in dark mode and toggling switches theme.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @mdit/web ts:check` → PASS.
```bash
git add apps/web/src/routes/__root.tsx
git commit -m "feat(web): system theme with toggle"
```

---

## Phase 3 — Verification & polish

### Task 11: Full monorepo checks

- [ ] **Step 1: Lint the whole repo**

Run: `pnpm lint`
Expected: PASS (fix any Biome findings in new files with `pnpm lint:fix`).

- [ ] **Step 2: Typecheck all JS packages**

Run: `pnpm ts:check:packages && pnpm ts:check:desktop && pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 3: Run all JS tests**

Run: `pnpm test:packages`
Expected: PASS (includes the new minimap + web lib tests if web is in `packages`/`apps` test globs; run `pnpm --filter @mdit/web test` explicitly too).

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "chore: lint and typecheck fixes"
```

### Task 12: Slash menu + drag handles on web (optional enhancement)

The web kit deferred `DndKit` (drag handles) and the slash `/` menu (host-dependent). Add them now that the app is stable.

**Files:**
- Modify: `apps/web/src/routes/index.tsx` (wrap in `DropProvider`/`DndProvider` from wherever desktop imports them — see `apps/desktop/src/main.tsx`)
- Modify: `packages/editor/src/web-kit/web-editor-kit.ts` (add `DndKit`; add `createSlashKit({ host })` with a browser slash host — look at `apps/desktop/src/components/editor/hosts/slash-host.ts` and provide a minimal web host that offers the pure blocks)

- [ ] **Step 1: Add DnD providers to the web root**

Mirror `apps/desktop/src/main.tsx`:
```tsx
import { DropProvider, DndProvider, PlateController } from "@mdit/editor/plate"
// wrap: <PlateController><DropProvider><DndProvider>{children}</DndProvider></DropProvider></PlateController>
```
(Confirm these are exported from `@mdit/editor/plate`; if not, import from their real source as desktop does.)

- [ ] **Step 2: Add DndKit to the web kit**

Add `...DndKit` (from `@mdit/editor/selection`) to `createWebEditorKit`.

- [ ] **Step 3: Add a browser slash host**

Create a minimal slash host that lists the pure blocks (headings, lists, quote, code, divider, table). Model it on `createDesktopSlashHost` but drop Tauri-only actions (image-from-disk, tag). Wire via `...createSlashKit({ host })`.

- [ ] **Step 4: Manual verify**

Run dev; confirm `/` opens the command menu and drag handles reorder blocks.

- [ ] **Step 5: Typecheck + test + commit**

Run: `pnpm --filter @mdit/editor ts:check && pnpm --filter @mdit/web ts:check && pnpm --filter @mdit/editor test`
Expected: PASS.
```bash
git add packages/editor/src/web-kit/ apps/web/src/
git commit -m "feat(web): slash menu and drag handles"
```

---

## Self-Review notes

- **Spec coverage:** Web single-file editor (Tasks 6–8), images as WebP inline (Task 9), side minimap on desktop+web always visible with hover overlay (Tasks 1–4b, mounted web in Task 7), themes (Task 10), slash/drag (Task 12), markdown compatibility via existing serializer (enforced in Tasks 7–8). Desktop features untouched (additions only).
- **Known verification points flagged inline (not placeholders — real API shapes to confirm against existing desktop code while implementing):** exact `createMarkdownDeserializerWithFallback` arg names (Task 7), `editor.api.markdown.serialize` arg shape (Task 8), image node `type`/`url` key (Task 9), `@platejs/toc` `onContentClick` heading arg (Task 3), DnD provider export path (Task 12). Each cites the desktop file to mirror.
- **Ordering rationale:** minimap first (isolated, existing test harness), then web app bottom-up (scaffold → mount → download → images → theme), enhancements last. Every task ends independently testable.
