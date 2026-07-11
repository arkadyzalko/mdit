# Web Editor Internal Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web editor (`apps/web`) open into an empty editable document and support multiple documents via a browser-style internal tab bar, where dropping a `.md` reuses an empty active tab or opens a new tab.

**Architecture:** A lightweight in-memory tab state (no `@mdit/store`, no Tauri) lives in the route component. Pure state functions in `web-tabs.ts` implement the reuse/new/close/dirty rules. A presentational `TabStrip` mirrors the desktop tab look. All open tabs stay mounted (inactive ones hidden with CSS) so each Plate editor keeps its state on switch. The global `.md` drop is handled at the route level; image drops stay inline in the active editor.

**Tech Stack:** React 19, TypeScript, Vite, Plate.js (`platejs` v53), TanStack Start/Router, Tailwind v4, `motion`, `@mdit/ui`, Vitest, pnpm + turbo monorepo.

## Global Constraints

- **Node** ≥ 20; **pnpm** = 10.30.0. Run JS commands via `pnpm --filter @mdit/web ...` / `pnpm --filter @mdit/editor ...` from repo root.
- **Web-only change.** Do not modify `apps/desktop/`, `packages/`, or `crates/`.
- **Lint/format:** Biome (`pnpm lint` / `pnpm lint:fix`). Tabs for indentation, double quotes, semicolons `asNeeded`. Match existing files exactly.
- **TS strict:** `strict`, `noUnusedLocals`, `noUnusedParameters` on. No unused vars, no implicit any.
- **Markdown compatibility unchanged:** reuse the existing serializer/deserializer; do not touch them.
- **Commit style:** conventional commits (`feat:`, `test:`, `refactor:`), matching upstream history.
- **Dev server:** `pnpm --filter @mdit/web dev` on port 3100. `timeout` is unavailable on macOS; poll with `curl` instead.
- **Editor-package changes don't always HMR into web** — hard-reload the browser (append `?v=N`) after changing imported packages.

---

## Key facts (reference for all tasks)

- Current `apps/web/src/routes/index.tsx` holds `useState<{name,markdown}|null>`; renders full-screen `DropZone` until a drop, then one `WebEditor` inside `EditorDndProvider` under `PlateController`. Route is `ssr: false`.
- Current `WebEditor` props: `{ fileName: string; initialMarkdown: string }`. It creates the Plate editor with `usePlateEditor`, renders a `Download` button + `EditorSurface editor rightRail={<HeadingMinimap/>}`, and has its own `onPaste`/`onDrop` that inserts images inline (`isImageFile` → `fileToWebpDataUrl` → `insertResolvedImage`). Its wrapper `<div>` has `className="relative h-screen w-full"` and `data-editor-scroll-root`.
- `EditorSurface` accepts `onValueChange?: () => void` and `rightRail?: ReactNode`.
- Download: `downloadMarkdown(fileName, markdown)` from `../lib/download`; serialize with `editor.api.markdown.serialize({ value: editor.children as Value })`.
- `EditorDndProvider` (from `@mdit/editor/dnd`) must wrap each editor and be under `PlateController`.
- `@mdit/ui/components/button` exports `Button`. `lucide-react` (`PlusIcon`, `XIcon`) and `motion` are available to web (deps already present via editor/ui or add if missing — check `apps/web/package.json`).
- Desktop `TabStrip` visual reference: `apps/desktop/src/components/editor/header/tab.tsx` (rounded chips `h-8 min-w-12 max-w-48`, `motion.div` layout spring, active `bg-muted text-foreground`, hover close button revealed with gradient mask, middle-click closes). Mirror the look; do NOT import it (it's store-coupled).
- `crypto.randomUUID()` is available in the browser (route is client-only).

## File Structure

**New:**
- `apps/web/src/lib/web-tabs.ts` — pure tab-state functions + types.
- `apps/web/src/lib/web-tabs.test.ts` — unit tests for the pure functions.
- `apps/web/src/components/tab-strip.tsx` — presentational tab bar.

**Modified:**
- `apps/web/src/components/web-editor.tsx` — add `onDirtyChange`/`onDownloaded` props; wire `onValueChange`; keep image drop; height becomes flex-friendly.
- `apps/web/src/routes/index.tsx` — own `WebTabsState`; render `TabStrip` + stacked editors; global `.md` drop.
- `apps/web/package.json` — add `lucide-react` / `motion` only if not already resolvable.

**Removed:**
- `apps/web/src/components/drop-zone.tsx`.

---

## Task 1: Pure tab-state module (`web-tabs.ts`) with tests

**Files:**
- Create: `apps/web/src/lib/web-tabs.ts`
- Test: `apps/web/src/lib/web-tabs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WebTab = {
    id: string
    name: string
    initialMarkdown: string
    isFile: boolean
    dirty: boolean
  }
  export type WebTabsState = { tabs: WebTab[]; activeTabId: string }
  export function createEmptyTab(): WebTab
  export function createInitialTabsState(): WebTabsState
  export function isTabEmpty(tab: WebTab): boolean
  export function openFileInTabs(state: WebTabsState, file: { name: string; markdown: string }): WebTabsState
  export function newTab(state: WebTabsState): WebTabsState
  export function closeTab(state: WebTabsState, id: string): WebTabsState
  export function setDirty(state: WebTabsState, id: string, dirty: boolean): WebTabsState
  ```
- Consumes: `crypto.randomUUID()`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/web-tabs.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import {
	closeTab,
	createInitialTabsState,
	isTabEmpty,
	newTab,
	openFileInTabs,
	setDirty,
} from "./web-tabs"

describe("web-tabs", () => {
	it("starts with a single empty Untitled tab", () => {
		const s = createInitialTabsState()
		expect(s.tabs).toHaveLength(1)
		expect(s.tabs[0].name).toBe("Untitled")
		expect(s.tabs[0].isFile).toBe(false)
		expect(s.tabs[0].dirty).toBe(false)
		expect(s.activeTabId).toBe(s.tabs[0].id)
		expect(isTabEmpty(s.tabs[0])).toBe(true)
	})

	it("opens a dropped file into the active empty tab (reuse)", () => {
		const s = createInitialTabsState()
		const next = openFileInTabs(s, { name: "notes.md", markdown: "# Notes" })
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].name).toBe("notes.md")
		expect(next.tabs[0].isFile).toBe(true)
		expect(next.tabs[0].initialMarkdown).toBe("# Notes")
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("opens a dropped file in a new tab when the active tab is a file", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" })
		const next = openFileInTabs(s, { name: "b.md", markdown: "B" })
		expect(next.tabs).toHaveLength(2)
		expect(next.tabs[1].name).toBe("b.md")
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("opens a dropped file in a new tab when the active tab is dirty", () => {
		let s = createInitialTabsState()
		s = setDirty(s, s.tabs[0].id, true)
		const next = openFileInTabs(s, { name: "b.md", markdown: "B" })
		expect(next.tabs).toHaveLength(2)
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("newTab always appends a fresh empty tab and activates it", () => {
		const s = createInitialTabsState()
		const next = newTab(s)
		expect(next.tabs).toHaveLength(2)
		expect(next.tabs[1].isFile).toBe(false)
		expect(next.activeTabId).toBe(next.tabs[1].id)
	})

	it("closing the active tab activates the left neighbor", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" }) // reuse -> [a]
		s = newTab(s) // [a, untitled] active=untitled
		const untitledId = s.activeTabId
		const next = closeTab(s, untitledId)
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].name).toBe("a.md")
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("closing the last tab recreates a fresh empty tab", () => {
		const s = createInitialTabsState()
		const next = closeTab(s, s.tabs[0].id)
		expect(next.tabs).toHaveLength(1)
		expect(next.tabs[0].isFile).toBe(false)
		expect(next.tabs[0].dirty).toBe(false)
		expect(next.tabs[0].id).not.toBe(s.tabs[0].id)
		expect(next.activeTabId).toBe(next.tabs[0].id)
	})

	it("setDirty toggles the flag on the target tab only", () => {
		let s = createInitialTabsState()
		s = newTab(s)
		const first = s.tabs[0].id
		const next = setDirty(s, first, true)
		expect(next.tabs[0].dirty).toBe(true)
		expect(next.tabs[1].dirty).toBe(false)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- web-tabs`
Expected: FAIL with "Cannot find module './web-tabs'".

- [ ] **Step 3: Write the implementation**

`apps/web/src/lib/web-tabs.ts`:
```ts
export type WebTab = {
	id: string
	name: string
	initialMarkdown: string
	isFile: boolean
	dirty: boolean
}

export type WebTabsState = {
	tabs: WebTab[]
	activeTabId: string
}

export function createEmptyTab(): WebTab {
	return {
		id: crypto.randomUUID(),
		name: "Untitled",
		initialMarkdown: "",
		isFile: false,
		dirty: false,
	}
}

export function createInitialTabsState(): WebTabsState {
	const tab = createEmptyTab()
	return { tabs: [tab], activeTabId: tab.id }
}

export function isTabEmpty(tab: WebTab): boolean {
	return !tab.isFile && !tab.dirty
}

function activeTab(state: WebTabsState): WebTab | undefined {
	return state.tabs.find((t) => t.id === state.activeTabId)
}

export function openFileInTabs(
	state: WebTabsState,
	file: { name: string; markdown: string },
): WebTabsState {
	const active = activeTab(state)
	if (active && isTabEmpty(active)) {
		return {
			...state,
			tabs: state.tabs.map((t) =>
				t.id === active.id
					? {
							...t,
							name: file.name,
							initialMarkdown: file.markdown,
							isFile: true,
							dirty: false,
						}
					: t,
			),
		}
	}
	const tab: WebTab = {
		id: crypto.randomUUID(),
		name: file.name,
		initialMarkdown: file.markdown,
		isFile: true,
		dirty: false,
	}
	return { tabs: [...state.tabs, tab], activeTabId: tab.id }
}

export function newTab(state: WebTabsState): WebTabsState {
	const tab = createEmptyTab()
	return { tabs: [...state.tabs, tab], activeTabId: tab.id }
}

export function closeTab(state: WebTabsState, id: string): WebTabsState {
	const index = state.tabs.findIndex((t) => t.id === id)
	if (index === -1) return state

	const remaining = state.tabs.filter((t) => t.id !== id)
	if (remaining.length === 0) {
		return createInitialTabsState()
	}

	let activeTabId = state.activeTabId
	if (state.activeTabId === id) {
		const neighbor = remaining[index - 1] ?? remaining[index] ?? remaining[0]
		activeTabId = neighbor.id
	}
	return { tabs: remaining, activeTabId }
}

export function setDirty(
	state: WebTabsState,
	id: string,
	dirty: boolean,
): WebTabsState {
	return {
		...state,
		tabs: state.tabs.map((t) => (t.id === id ? { ...t, dirty } : t)),
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- web-tabs`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/web-tabs.ts apps/web/src/lib/web-tabs.test.ts
git commit -m "feat(web): pure internal tab-state module"
```

---

## Task 2: TabStrip component

**Files:**
- Create: `apps/web/src/components/tab-strip.tsx`
- Modify: `apps/web/package.json` (only if `lucide-react`/`motion` are not resolvable from `apps/web` — verify first)

**Interfaces:**
- Consumes: `WebTab` from `../lib/web-tabs`.
- Produces:
  ```ts
  export function TabStrip(props: {
    tabs: WebTab[]
    activeTabId: string
    onActivate: (id: string) => void
    onClose: (id: string) => void
    onNew: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Verify deps are resolvable**

Run:
```bash
node -e "require.resolve('motion/react',{paths:['apps/web']}); require.resolve('lucide-react',{paths:['apps/web']}); console.log('ok')" || echo "MISSING"
```
If it prints `MISSING`, add to `apps/web/package.json` dependencies (versions matching the editor package: `"lucide-react": "^0.539.0"`, `"motion": "^12.34.2"`) and run `pnpm install`. If `ok`, skip.

- [ ] **Step 2: Create the component**

`apps/web/src/components/tab-strip.tsx`:
```tsx
import { cn } from "@mdit/ui/lib/utils"
import { PlusIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { MouseEvent } from "react"
import type { WebTab } from "../lib/web-tabs"

const spring = { type: "spring" as const, stiffness: 580, damping: 38, mass: 0.7 }

export function TabStrip({
	tabs,
	activeTabId,
	onActivate,
	onClose,
	onNew,
}: {
	tabs: WebTab[]
	activeTabId: string
	onActivate: (id: string) => void
	onClose: (id: string) => void
	onNew: () => void
}) {
	return (
		<div className="flex min-w-0 items-center gap-1 border-border border-b px-2 py-1.5">
			<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
				<AnimatePresence initial={false} mode="popLayout">
					{tabs.map((tab) => {
						const isActive = tab.id === activeTabId
						return (
							<motion.div
								key={tab.id}
								layout
								role="tab"
								aria-selected={isActive}
								tabIndex={0}
								onClick={() => onActivate(tab.id)}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return
									event.preventDefault()
									onActivate(tab.id)
								}}
								onAuxClick={(event) => {
									if (event.button !== 1) return
									event.stopPropagation()
									onClose(tab.id)
								}}
								className={cn(
									"group/tab relative flex h-8 min-w-12 max-w-48 flex-1 basis-0 cursor-pointer items-center overflow-hidden rounded-md text-sm transition-colors",
									"text-muted-foreground hover:bg-muted",
									isActive && "bg-muted text-foreground",
								)}
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ layout: spring, opacity: spring, x: spring }}
							>
								<div className="flex-1 truncate pr-1 pl-2 text-left">
									{tab.dirty ? `${tab.name} •` : tab.name}
								</div>
								<div
									className={cn(
										"absolute right-0 flex h-full w-14 items-center justify-end rounded-r-md pr-1.5",
										"opacity-0 transition-opacity group-hover/tab:opacity-100",
										"bg-linear-to-r from-transparent via-muted to-muted",
									)}
								>
									<button
										type="button"
										aria-label="Close tab"
										onClick={(event: MouseEvent<HTMLButtonElement>) => {
											event.stopPropagation()
											onClose(tab.id)
										}}
										className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
									>
										<XIcon className="size-3.5" aria-hidden />
									</button>
								</div>
							</motion.div>
						)
					})}
				</AnimatePresence>
			</div>
			<button
				type="button"
				aria-label="New tab"
				onClick={onNew}
				className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<PlusIcon className="size-4" aria-hidden />
			</button>
		</div>
	)
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tab-strip.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): tab strip component"
```

---

## Task 3: WebEditor dirty/download props + flex height

**Files:**
- Modify: `apps/web/src/components/web-editor.tsx`

**Interfaces:**
- Consumes: existing `downloadMarkdown`, `fileToWebpDataUrl`, `isImageFile`.
- Produces: `WebEditor` gains props:
  ```ts
  { fileName: string; initialMarkdown: string; onDirtyChange?: () => void; onDownloaded?: () => void }
  ```
  Wrapper height changes from `h-screen` to `h-full` (it now lives under the tab bar in a flex column).

- [ ] **Step 1: Update props, height, dirty + download wiring**

Replace the whole file `apps/web/src/components/web-editor.tsx` with:
```tsx
import { createMarkdownDeserializerWithFallback } from "@mdit/editor/markdown"
import { insertResolvedImage } from "@mdit/editor/media"
import { HeadingMinimap } from "@mdit/editor/minimap"
import { usePlateEditor, type Value } from "@mdit/editor/plate"
import { EditorSurface } from "@mdit/editor/shared"
import { createWebEditorKit } from "@mdit/editor/web-kit"
import { Button } from "@mdit/ui/components/button"
import { useMemo } from "react"
import { downloadMarkdown } from "../lib/download"
import { fileToWebpDataUrl, isImageFile } from "../lib/web-image"

export function WebEditor({
	fileName,
	initialMarkdown,
	onDirtyChange,
	onDownloaded,
}: {
	fileName: string
	initialMarkdown: string
	onDirtyChange?: () => void
	onDownloaded?: () => void
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

	const insertImageFile = async (file: File) => {
		const dataUrl = await fileToWebpDataUrl(file)
		insertResolvedImage(editor, { url: dataUrl }, { nextBlock: true })
	}

	return (
		<div
			className="relative h-full w-full"
			data-editor-scroll-root
			onPaste={(e) => {
				const file = Array.from(e.clipboardData.files)[0]
				if (file && isImageFile(file)) {
					e.preventDefault()
					void insertImageFile(file)
				}
			}}
			onDrop={(e) => {
				const file = Array.from(e.dataTransfer.files)[0]
				if (file && isImageFile(file)) {
					e.preventDefault()
					e.stopPropagation()
					void insertImageFile(file)
				}
			}}
		>
			<Button
				type="button"
				className="absolute top-3 right-12 z-40"
				onClick={() => {
					downloadMarkdown(
						fileName,
						editor.api.markdown.serialize({ value: editor.children as Value }),
					)
					onDownloaded?.()
				}}
			>
				Download
			</Button>
			<EditorSurface
				editor={editor}
				onValueChange={onDirtyChange}
				rightRail={<HeadingMinimap />}
			/>
		</div>
	)
}
```
Note: the image `onDrop` now also calls `e.stopPropagation()` so an image dropped in the editor does not also bubble to the route-level `.md` handler (Task 4).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/web-editor.tsx
git commit -m "feat(web): web editor dirty + download callbacks"
```

---

## Task 4: Route wiring — tabs, stacked editors, global .md drop

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Delete: `apps/web/src/components/drop-zone.tsx`

**Interfaces:**
- Consumes: `TabStrip`, `WebEditor`, all `web-tabs` functions, `EditorDndProvider`, `PlateController`, `isImageFile` (`../lib/web-image`).

- [ ] **Step 1: Rewrite the route**

Replace the whole file `apps/web/src/routes/index.tsx` with:
```tsx
import { EditorDndProvider } from "@mdit/editor/dnd"
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { TabStrip } from "../components/tab-strip"
import { WebEditor } from "../components/web-editor"
import { isImageFile } from "../lib/web-image"
import {
	closeTab,
	createInitialTabsState,
	newTab,
	openFileInTabs,
	setDirty,
} from "../lib/web-tabs"

export const Route = createFileRoute("/")({
	ssr: false,
	component: Home,
})

function Home() {
	const [state, setState] = useState(createInitialTabsState)

	const openMarkdownFile = async (file: File) => {
		const markdown = await file.text()
		setState((s) => openFileInTabs(s, { name: file.name, markdown }))
	}

	const handleClose = (id: string) => {
		setState((s) => {
			const tab = s.tabs.find((t) => t.id === id)
			if (tab?.dirty && !window.confirm("Discard unsaved changes?")) {
				return s
			}
			return closeTab(s, id)
		})
	}

	return (
		<div className="flex h-screen w-full flex-col">
			<TabStrip
				tabs={state.tabs}
				activeTabId={state.activeTabId}
				onActivate={(id) => setState((s) => ({ ...s, activeTabId: id }))}
				onClose={handleClose}
				onNew={() => setState(newTab)}
			/>
			<div
				className="relative min-h-0 flex-1"
				onDrop={(e) => {
					const file = Array.from(e.dataTransfer.files)[0]
					// Images are handled inline by the editor (they stopPropagation);
					// here we only handle markdown files → tab logic.
					if (file && !isImageFile(file)) {
						e.preventDefault()
						void openMarkdownFile(file)
					}
				}}
				onDragOver={(e) => e.preventDefault()}
			>
				{state.tabs.map((tab) => {
					const isActive = tab.id === state.activeTabId
					return (
						<div
							key={tab.id}
							className={isActive ? "h-full w-full" : "hidden"}
						>
							<PlateController>
								<EditorDndProvider>
									<WebEditor
										fileName={tab.name}
										initialMarkdown={tab.initialMarkdown}
										onDirtyChange={() =>
											setState((s) => setDirty(s, tab.id, true))
										}
										onDownloaded={() =>
											setState((s) => setDirty(s, tab.id, false))
										}
									/>
								</EditorDndProvider>
							</PlateController>
						</div>
					)
				})}
			</div>
		</div>
	)
}
```
Notes:
- Each tab gets its **own** `PlateController` + `EditorDndProvider` + `WebEditor`, so each has an isolated editor instance and DnD scope; hiding with `hidden` keeps them mounted (state preserved).
- The route-level `onDrop` only handles non-image files (markdown). Image drops call `stopPropagation` in `WebEditor` (Task 3) so they never reach here.

- [ ] **Step 2: Delete the obsolete drop-zone**

```bash
git rm apps/web/src/components/drop-zone.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS. (If `drop-zone` is referenced anywhere else, `grep -rn "drop-zone" apps/web/src` returns nothing — confirm.)

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @mdit/web test`
Expected: PASS (download, web-image, web-tabs).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/index.tsx
git commit -m "feat(web): internal tabs with empty-first editor and md drop routing"
```

---

## Task 5: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start dev and hard-load**

```bash
pnpm --filter @mdit/web dev
```
Poll until ready, open `http://localhost:3100/?v=1`.

- [ ] **Step 2: Verify the empty-first + tabs flow**

Confirm each:
1. App opens directly into an empty editor with one `Untitled` tab and a `+` button (no full-screen drop-zone).
2. Typing in the empty tab: the tab stays (title `Untitled`), and a dirty marker (`•`) appears.
3. Drop a `.md` while the tab is **untouched/empty** (reload first): it opens **in place** (tab title becomes the file name), no new tab.
4. Drop a second `.md` while the current tab has content/file: opens in a **new** tab and activates it.
5. Switch between tabs by clicking: each tab preserves its own content.
6. `+` creates a new empty `Untitled` tab.
7. Paste/drop an **image** into the active editor: inserts inline WebP, does **not** create a tab.
8. Close a **dirty** tab (`x`): a confirm appears; cancel keeps it, OK closes it.
9. Close the **last** tab: a fresh empty `Untitled` tab appears (never tabless).
10. `Download` on the active tab downloads its content and clears the `•`.
11. Minimap + slash menu + drag handle still work inside a tab.

- [ ] **Step 3: Check console for errors**

Use the browser console (or read_console_messages) filtered for `error`. Expected: only the benign theme hydration-mismatch warning; no other errors. Stop the dev server.

---

## Task 6: Full checks

- [ ] **Step 1: Lint**

Run: `pnpm lint` (fix with `pnpm lint:fix` if needed, then re-run).
Expected: PASS.

- [ ] **Step 2: Typecheck web + confirm desktop/editor untouched**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS. (This plan only touched `apps/web`.)

- [ ] **Step 3: Web tests**

Run: `pnpm --filter @mdit/web test`
Expected: PASS.

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(web): lint fixes for internal tabs"
```

---

## Self-Review notes

- **Spec coverage:** empty-first editor (Task 4 initial state), tab bar with `+`/`x`/click/middle-click (Task 2), drop reuse-vs-new on active-empty (Task 1 `openFileInTabs` + Task 4 wiring), image drop stays inline (Task 3 `stopPropagation` + Task 4 filter), dirty tracking + `•` (Tasks 1/2/3), download acts on active + clears dirty (Task 3), close confirm on dirty + neighbor activation + last-tab recreate (Tasks 1/4), all-tabs-mounted state preservation (Task 4 `hidden`), drop-zone removed (Task 4), placeholder is Plate's native default (no extra work — empty tab shows `'/' for commands...`). `+` always creates (explicit, per approved spec).
- **Placeholder scan:** none — every step has full code/commands.
- **Type consistency:** `WebTab`/`WebTabsState` and all function signatures defined in Task 1 are used verbatim in Tasks 2 and 4. `WebEditor` props from Task 3 match the callsite in Task 4.
- **Verification limitation:** live drag of tabs isn't in scope; drag-based editor interactions (blocks) already covered elsewhere. Tab drops use file `dataTransfer`, which the harness can drive via input/drop events.
