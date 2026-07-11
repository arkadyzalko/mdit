# Web Save / Auto-save / Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real save model to the web editor: Cmd+S downloads the active tab, auto-save persists each tab to localStorage (debounced), reload restores all tabs, and a Settings panel configures auto-save. Generic UI primitives go to `@mdit/ui`.

**Architecture:** Pure localStorage helpers + a persisted tab shape derived from `WebTabsState`; a `useSettings` hook and `useAutosave` debounce hook; a `SettingRow` primitive in `@mdit/ui` composed by an app-level `SettingsPanel`. The route hydrates tab state from storage on mount, wires a global Cmd+S, and persists on each tab's debounced `onPersist`.

**Tech Stack:** React 19, TypeScript, Vite, Plate.js (`platejs` v53), TanStack Start/Router (`ssr: false` route), Tailwind v4, `@mdit/ui` (base-ui primitives), Vitest, pnpm + turbo.

## Global Constraints

- **Web + one `@mdit/ui` primitive only.** Touch `apps/web/**` and add exactly one new file `packages/ui/src/components/setting-row.tsx`. Do not modify desktop, other packages, or crates.
- **Design-system rule:** generic logic-free primitives live in `@mdit/ui`; composition + domain state live in `apps/web`. Reuse existing `@mdit/ui` primitives — do NOT re-implement Switch/Select/Button/Separator/Label.
- **`@mdit/ui` uses `@base-ui/react`, not Radix.** `Switch` props: `checked`, `onCheckedChange(checked: boolean)`. `Select` is composed from `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` (all from `@mdit/ui/components/select`).
- **Lint/format:** Biome (`pnpm lint`/`pnpm lint:fix`). Tabs, double quotes, semicolons `asNeeded`. Match existing files.
- **TS strict:** no unused vars, no implicit any.
- **SSR-safe:** the route is `ssr: false`, but localStorage access must still guard `typeof window`/`typeof localStorage` to avoid crashes during any prerender/build.
- **Commit style:** conventional commits (`feat:`, `test:`, `refactor:`), matching upstream.
- **Dev:** `pnpm --filter @mdit/web dev` (port 3100). No `timeout` on macOS — poll with `curl`. Editor-package/ui changes may need a hard browser reload (`?v=N`).

---

## Key facts (reference for all tasks)

- `WebTab` (`apps/web/src/lib/web-tabs.ts`): `{ id: string; name: string; initialMarkdown: string; isFile: boolean; dirty: boolean; epoch: number }`. `WebTabsState = { tabs: WebTab[]; activeTabId: string }`. Pure functions: `createInitialTabsState`, `createEmptyTab`, `isTabEmpty`, `tabLabel`, `openFileInTabs`, `newTab`, `closeTab`, `setDirty(state, id, dirty)`.
- `WebEditor` (`apps/web/src/components/web-editor.tsx`) props today: `{ fileName, initialMarkdown, onDirtyChange?(dirty), onDownloaded?() }`. It creates the Plate editor, serializes via `editor.api.markdown.serialize({ value: editor.children as Value })`, computes dirty by comparing to a baseline ref, and has a Download button. It imports `Value` from `@mdit/editor/plate`.
- Route (`apps/web/src/routes/index.tsx`): `ssr: false`; `useState(createInitialTabsState)`; renders `DocSidebar` + `TabStrip` + a stack of `WebEditor`s (active visible, others `hidden`), each in its own `PlateController` + `EditorDndProvider`; key is `` `${tab.id}:${tab.epoch}` ``.
- `@mdit/ui` primitives: `@mdit/ui/components/switch` → `Switch` (base-ui: `checked`, `onCheckedChange`), `@mdit/ui/components/select` → `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `@mdit/ui/components/button` → `Button`, `@mdit/ui/components/separator` → `Separator`, `@mdit/ui/components/label` → `Label`. `cn` from `@mdit/ui/lib/utils`. `@mdit/ui` exports via `./components/*`.
- `lucide-react` and `motion` are already deps of `apps/web`.

## File structure

**New — `@mdit/ui`:** `packages/ui/src/components/setting-row.tsx`
**New — `apps/web/src`:** `lib/storage.ts`, `lib/persist-tabs.ts`, `lib/persist-tabs.test.ts`, `lib/settings.ts`, `lib/settings.test.ts`, `hooks/use-settings.ts`, `hooks/use-autosave.ts`, `components/settings-panel.tsx`, `components/settings-button.tsx`
**Modified:** `apps/web/src/lib/web-tabs.ts`, `apps/web/src/lib/web-tabs.test.ts`, `apps/web/src/components/web-editor.tsx`, `apps/web/src/routes/index.tsx`

---

## Task 1: localStorage helpers (`storage.ts`)

**Files:** Create `apps/web/src/lib/storage.ts`, `apps/web/src/lib/storage.test.ts`

**Interfaces — Produces:**
```ts
export function readJSON<T>(key: string): T | null
export function writeJSON(key: string, value: unknown): void
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/storage.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { readJSON, writeJSON } from "./storage"

describe("storage", () => {
	beforeEach(() => localStorage.clear())

	it("round-trips a JSON value", () => {
		writeJSON("k", { a: 1, b: ["x"] })
		expect(readJSON<{ a: number; b: string[] }>("k")).toEqual({ a: 1, b: ["x"] })
	})

	it("returns null for a missing key", () => {
		expect(readJSON("nope")).toBeNull()
	})

	it("returns null (no throw) for corrupt JSON", () => {
		localStorage.setItem("bad", "{not json")
		expect(readJSON("bad")).toBeNull()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- storage`
Expected: FAIL ("Cannot find module './storage'").

- [ ] **Step 3: Implement**

`apps/web/src/lib/storage.ts`:
```ts
// SSR-safe, throw-safe localStorage JSON helpers.
function store(): Storage | null {
	try {
		if (typeof localStorage === "undefined") return null
		return localStorage
	} catch {
		return null
	}
}

export function readJSON<T>(key: string): T | null {
	const s = store()
	if (!s) return null
	try {
		const raw = s.getItem(key)
		return raw === null ? null : (JSON.parse(raw) as T)
	} catch {
		return null
	}
}

export function writeJSON(key: string, value: unknown): void {
	const s = store()
	if (!s) return
	try {
		s.setItem(key, JSON.stringify(value))
	} catch {
		// ignore quota / serialization errors
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- storage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/storage.ts apps/web/src/lib/storage.test.ts
git commit -m "feat(web): ssr-safe localStorage json helpers"
```

---

## Task 2: Persisted tab (de)serialization in `web-tabs.ts`

**Files:** Modify `apps/web/src/lib/web-tabs.ts`, `apps/web/src/lib/web-tabs.test.ts`

**Interfaces:**
- Consumes: existing `WebTab`, `WebTabsState`, `createInitialTabsState`.
- Produces:
```ts
export type PersistedTab = { id: string; name: string; markdown: string; isFile: boolean; epoch: number }
export type PersistedTabsState = { tabs: PersistedTab[]; activeTabId: string }
export function toPersisted(state: WebTabsState, markdownByTab: Record<string, string>): PersistedTabsState
export function fromPersisted(p: PersistedTabsState): WebTabsState
```
`toPersisted` uses each tab's current markdown from `markdownByTab` (falling back to `tab.initialMarkdown` when absent). `fromPersisted` rebuilds `WebTabsState` with `dirty: false` and `initialMarkdown = persisted.markdown`; if `p.tabs` is empty it returns `createInitialTabsState()`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/web-tabs.test.ts` (inside the top `describe`):
```ts
	it("toPersisted captures current markdown per tab and the active id", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" }) // reuse -> [a]
		s = newTab(s) // [a, untitled] active=untitled
		const p = toPersisted(s, { [s.tabs[0].id]: "A-edited" })
		expect(p.activeTabId).toBe(s.activeTabId)
		expect(p.tabs).toHaveLength(2)
		expect(p.tabs[0]).toMatchObject({ name: "a.md", markdown: "A-edited", isFile: true })
		// tab without an entry in markdownByTab falls back to its initialMarkdown
		expect(p.tabs[1].markdown).toBe("")
	})

	it("fromPersisted rebuilds clean tabs with markdown as initial content", () => {
		const p = {
			tabs: [
				{ id: "x", name: "n.md", markdown: "# N", isFile: true, epoch: 2 },
			],
			activeTabId: "x",
		}
		const s = fromPersisted(p)
		expect(s.tabs).toHaveLength(1)
		expect(s.tabs[0]).toMatchObject({
			id: "x",
			name: "n.md",
			initialMarkdown: "# N",
			isFile: true,
			dirty: false,
			epoch: 2,
		})
		expect(s.activeTabId).toBe("x")
	})

	it("fromPersisted with no tabs returns a fresh initial state", () => {
		const s = fromPersisted({ tabs: [], activeTabId: "" })
		expect(s.tabs).toHaveLength(1)
		expect(s.tabs[0].isFile).toBe(false)
	})
```
Add `fromPersisted`, `toPersisted` to the existing import from `./web-tabs` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- web-tabs`
Expected: FAIL (toPersisted/fromPersisted not exported).

- [ ] **Step 3: Implement**

Append to `apps/web/src/lib/web-tabs.ts`:
```ts
export type PersistedTab = {
	id: string
	name: string
	markdown: string
	isFile: boolean
	epoch: number
}

export type PersistedTabsState = {
	tabs: PersistedTab[]
	activeTabId: string
}

export function toPersisted(
	state: WebTabsState,
	markdownByTab: Record<string, string>,
): PersistedTabsState {
	return {
		activeTabId: state.activeTabId,
		tabs: state.tabs.map((t) => ({
			id: t.id,
			name: t.name,
			markdown: markdownByTab[t.id] ?? t.initialMarkdown,
			isFile: t.isFile,
			epoch: t.epoch,
		})),
	}
}

export function fromPersisted(p: PersistedTabsState): WebTabsState {
	if (p.tabs.length === 0) return createInitialTabsState()
	return {
		activeTabId: p.activeTabId,
		tabs: p.tabs.map((t) => ({
			id: t.id,
			name: t.name,
			initialMarkdown: t.markdown,
			isFile: t.isFile,
			dirty: false,
			epoch: t.epoch,
		})),
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- web-tabs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/web-tabs.ts apps/web/src/lib/web-tabs.test.ts
git commit -m "feat(web): persisted tab (de)serialization helpers"
```

---

## Task 3: `persist-tabs.ts` (storage glue)

**Files:** Create `apps/web/src/lib/persist-tabs.ts`, `apps/web/src/lib/persist-tabs.test.ts`

**Interfaces:**
- Consumes: `readJSON`/`writeJSON` (Task 1), `PersistedTabsState`/`WebTabsState`/`fromPersisted`/`toPersisted` (Task 2).
- Produces:
```ts
export const TABS_STORAGE_KEY = "mdit.web.tabs"
export function loadPersistedTabsState(): WebTabsState | null
export function savePersistedTabsState(state: WebTabsState, markdownByTab: Record<string, string>): void
```
`loadPersistedTabsState` returns `fromPersisted(stored)` when a valid stored state exists, else `null` (route decides to fall back to `createInitialTabsState`). `savePersistedTabsState` writes `toPersisted(...)` under the key.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/persist-tabs.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { loadPersistedTabsState, savePersistedTabsState } from "./persist-tabs"
import { createInitialTabsState, openFileInTabs } from "./web-tabs"

describe("persist-tabs", () => {
	beforeEach(() => localStorage.clear())

	it("returns null when nothing is stored", () => {
		expect(loadPersistedTabsState()).toBeNull()
	})

	it("round-trips a tabs state through storage", () => {
		let s = createInitialTabsState()
		s = openFileInTabs(s, { name: "a.md", markdown: "A" })
		savePersistedTabsState(s, { [s.tabs[0].id]: "A-edited" })
		const loaded = loadPersistedTabsState()
		expect(loaded).not.toBeNull()
		expect(loaded?.tabs[0]).toMatchObject({
			name: "a.md",
			initialMarkdown: "A-edited",
			isFile: true,
			dirty: false,
		})
		expect(loaded?.activeTabId).toBe(s.activeTabId)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- persist-tabs`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/lib/persist-tabs.ts`:
```ts
import { readJSON, writeJSON } from "./storage"
import {
	fromPersisted,
	type PersistedTabsState,
	toPersisted,
	type WebTabsState,
} from "./web-tabs"

export const TABS_STORAGE_KEY = "mdit.web.tabs"

export function loadPersistedTabsState(): WebTabsState | null {
	const stored = readJSON<PersistedTabsState>(TABS_STORAGE_KEY)
	if (!stored || !Array.isArray(stored.tabs) || stored.tabs.length === 0) {
		return null
	}
	return fromPersisted(stored)
}

export function savePersistedTabsState(
	state: WebTabsState,
	markdownByTab: Record<string, string>,
): void {
	writeJSON(TABS_STORAGE_KEY, toPersisted(state, markdownByTab))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- persist-tabs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/persist-tabs.ts apps/web/src/lib/persist-tabs.test.ts
git commit -m "feat(web): tab state persistence to localStorage"
```

---

## Task 4: Settings model + hook

**Files:** Create `apps/web/src/lib/settings.ts`, `apps/web/src/lib/settings.test.ts`, `apps/web/src/hooks/use-settings.ts`

**Interfaces — Produces:**
```ts
// settings.ts
export type WebSettings = { autoSave: boolean; autoSaveDelayMs: number }
export const AUTO_SAVE_DELAYS = [500, 1000, 2000] as const
export const DEFAULT_SETTINGS: WebSettings
export function loadSettings(): WebSettings   // merges stored over defaults, clamps delay
export function saveSettings(s: WebSettings): void
// use-settings.ts
export function useSettings(): { settings: WebSettings; setSettings: (next: WebSettings) => void }
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/settings.test.ts`:
```ts
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
		expect(loadSettings().autoSaveDelayMs).toBe(DEFAULT_SETTINGS.autoSaveDelayMs)
	})

	it("fills missing fields from defaults", () => {
		localStorage.setItem("mdit.web.settings", JSON.stringify({ autoSave: false }))
		const s = loadSettings()
		expect(s.autoSave).toBe(false)
		expect(s.autoSaveDelayMs).toBe(DEFAULT_SETTINGS.autoSaveDelayMs)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test -- settings`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/lib/settings.ts`:
```ts
import { readJSON, writeJSON } from "./storage"

export const AUTO_SAVE_DELAYS = [500, 1000, 2000] as const
export type AutoSaveDelay = (typeof AUTO_SAVE_DELAYS)[number]

export type WebSettings = {
	autoSave: boolean
	autoSaveDelayMs: number
}

export const DEFAULT_SETTINGS: WebSettings = {
	autoSave: true,
	autoSaveDelayMs: 1000,
}

const SETTINGS_STORAGE_KEY = "mdit.web.settings"

export function loadSettings(): WebSettings {
	const stored = readJSON<Partial<WebSettings>>(SETTINGS_STORAGE_KEY)
	const autoSave =
		typeof stored?.autoSave === "boolean"
			? stored.autoSave
			: DEFAULT_SETTINGS.autoSave
	const delay = stored?.autoSaveDelayMs
	const autoSaveDelayMs = AUTO_SAVE_DELAYS.includes(delay as AutoSaveDelay)
		? (delay as number)
		: DEFAULT_SETTINGS.autoSaveDelayMs
	return { autoSave, autoSaveDelayMs }
}

export function saveSettings(s: WebSettings): void {
	writeJSON(SETTINGS_STORAGE_KEY, s)
}
```

`apps/web/src/hooks/use-settings.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test -- settings`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/settings.ts apps/web/src/lib/settings.test.ts apps/web/src/hooks/use-settings.ts
git commit -m "feat(web): settings model + useSettings hook"
```

---

## Task 5: `SettingRow` primitive in `@mdit/ui`

**Files:** Create `packages/ui/src/components/setting-row.tsx`

**Interfaces — Produces:** `SettingRow` from `@mdit/ui/components/setting-row`:
```ts
function SettingRow(props: {
	title: string
	description?: string
	htmlFor?: string
	children: React.ReactNode // the control (right side)
}): JSX.Element
```

- [ ] **Step 1: Create the primitive**

`packages/ui/src/components/setting-row.tsx`:
```tsx
import type { ReactNode } from "react"
import { cn } from "../lib/utils"

export function SettingRow({
	title,
	description,
	htmlFor,
	children,
	className,
}: {
	title: string
	description?: string
	htmlFor?: string
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 py-3",
				className,
			)}
		>
			<div className="min-w-0">
				<label
					htmlFor={htmlFor}
					className="block font-medium text-foreground text-sm"
				>
					{title}
				</label>
				{description ? (
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	)
}
```

- [ ] **Step 2: Typecheck `@mdit/ui`**

Run: `pnpm --filter @mdit/ui ts:check` (if `@mdit/ui` has no ts:check script, run `pnpm --filter @mdit/web ts:check` after Task 6 consumes it).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/setting-row.tsx
git commit -m "feat(ui): SettingRow primitive"
```

---

## Task 6: Settings panel + button (app composition)

**Files:** Create `apps/web/src/components/settings-panel.tsx`, `apps/web/src/components/settings-button.tsx`

**Interfaces:**
- Consumes: `SettingRow` (`@mdit/ui/components/setting-row`), `Switch` (`@mdit/ui/components/switch`), `Select`+parts (`@mdit/ui/components/select`), `Button` (`@mdit/ui/components/button`), `Separator` (`@mdit/ui/components/separator`), `WebSettings`/`AUTO_SAVE_DELAYS` (`../lib/settings`).
- Produces:
```ts
// settings-panel.tsx
export function SettingsPanel(props: { settings: WebSettings; onChange: (s: WebSettings) => void; onClose: () => void }): JSX.Element
// settings-button.tsx
export function SettingsButton(props: { onClick: () => void }): JSX.Element
```

- [ ] **Step 1: Settings button**

`apps/web/src/components/settings-button.tsx`:
```tsx
import { Button } from "@mdit/ui/components/button"
import { SettingsIcon } from "lucide-react"

export function SettingsButton({ onClick }: { onClick: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Settings"
			onClick={onClick}
		>
			<SettingsIcon className="size-4" />
		</Button>
	)
}
```

- [ ] **Step 2: Settings panel**

`apps/web/src/components/settings-panel.tsx`:
```tsx
import { Button } from "@mdit/ui/components/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mdit/ui/components/select"
import { SettingRow } from "@mdit/ui/components/setting-row"
import { Switch } from "@mdit/ui/components/switch"
import { ArrowLeftIcon } from "lucide-react"
import { AUTO_SAVE_DELAYS, type WebSettings } from "../lib/settings"

const delayLabel = (ms: number) => `${ms / 1000}s`

export function SettingsPanel({
	settings,
	onChange,
	onClose,
}: {
	settings: WebSettings
	onChange: (s: WebSettings) => void
	onClose: () => void
}) {
	return (
		<div className="fixed inset-0 z-50 flex bg-background">
			{/* Left: section list */}
			<div className="flex w-60 shrink-0 flex-col border-border border-r bg-muted/30 p-2">
				<Button
					type="button"
					variant="ghost"
					className="mb-2 justify-start gap-2"
					onClick={onClose}
				>
					<ArrowLeftIcon className="size-4" />
					Back to app
				</Button>
				<div className="rounded-md bg-muted px-2 py-1.5 font-medium text-foreground text-sm">
					Editor
				</div>
			</div>
			{/* Right: content */}
			<div className="min-w-0 flex-1 overflow-y-auto p-8">
				<h1 className="font-semibold text-foreground text-xl">Editor</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					How the editor saves your work.
				</p>
				<div className="mt-6 max-w-xl divide-y divide-border">
					<SettingRow
						title="Auto-save"
						description="Persist changes to this browser as you type."
					>
						<Switch
							checked={settings.autoSave}
							onCheckedChange={(checked) =>
								onChange({ ...settings, autoSave: checked })
							}
						/>
					</SettingRow>
					{settings.autoSave ? (
						<SettingRow
							title="Auto-save delay"
							description="How long to wait after you stop typing."
						>
							<Select
								value={String(settings.autoSaveDelayMs)}
								onValueChange={(v) =>
									onChange({ ...settings, autoSaveDelayMs: Number(v) })
								}
							>
								<SelectTrigger className="w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{AUTO_SAVE_DELAYS.map((ms) => (
										<SelectItem key={ms} value={String(ms)}>
											{delayLabel(ms)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SettingRow>
					) : null}
				</div>
			</div>
		</div>
	)
}
```
Note: verify the base-ui `Select` API in `packages/ui/src/components/select.tsx` — it may use `value`/`onValueChange` (Radix-style) or base-ui's `value`/`onValueChange` differently. If the props differ, adapt to the actual `Select` root props (read the file). Same for `Switch` (`checked`/`onCheckedChange` vs base-ui `checked`/`onCheckedChange`). Adjust to match the real signatures.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS. If Select/Switch prop names differ, fix per the actual component signatures and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/settings-panel.tsx apps/web/src/components/settings-button.tsx
git commit -m "feat(web): settings panel + button"
```

---

## Task 7: Auto-save debounce hook

**Files:** Create `apps/web/src/hooks/use-autosave.ts`

**Interfaces — Produces:**
```ts
export function useAutosave(
	onPersist: (markdown: string) => void,
	options: { delayMs: number; enabled: boolean },
): (markdown: string) => void  // returns schedule(markdown)
```
`schedule(markdown)` debounces by `delayMs`; when it fires it calls `onPersist(markdown)`. When `enabled` is false, `schedule` is a no-op. Cleans up its timer on unmount / when inputs change.

- [ ] **Step 1: Implement**

`apps/web/src/hooks/use-autosave.ts`:
```ts
import { useCallback, useEffect, useRef } from "react"

export function useAutosave(
	onPersist: (markdown: string) => void,
	{ delayMs, enabled }: { delayMs: number; enabled: boolean },
) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const onPersistRef = useRef(onPersist)
	onPersistRef.current = onPersist

	const clear = useCallback(() => {
		if (timer.current !== null) {
			clearTimeout(timer.current)
			timer.current = null
		}
	}, [])

	useEffect(() => clear, [clear])

	return useCallback(
		(markdown: string) => {
			if (!enabled) return
			clear()
			timer.current = setTimeout(() => {
				timer.current = null
				onPersistRef.current(markdown)
			}, delayMs)
		},
		[clear, delayMs, enabled],
	)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-autosave.ts
git commit -m "feat(web): debounced auto-save hook"
```

---

## Task 8: WebEditor reports content for persist/autosave

**Files:** Modify `apps/web/src/components/web-editor.tsx`

**Interfaces:**
- Consumes: `useAutosave` (Task 7).
- Produces: `WebEditor` gains props `{ autoSave: boolean; autoSaveDelayMs: number; onPersist?: (markdown: string) => void }` (in addition to existing). On each editor change it (a) still computes/report dirty via `onDirtyChange`, and (b) schedules an auto-save that serializes the current markdown and calls `onPersist(markdown)` after the debounce.

- [ ] **Step 1: Wire autosave into WebEditor**

In `apps/web/src/components/web-editor.tsx`:
- Add imports: `import { useAutosave } from "../hooks/use-autosave"`.
- Extend the props type with `autoSave: boolean`, `autoSaveDelayMs: number`, `onPersist?: (markdown: string) => void`.
- After `const editor = usePlateEditor(...)` and the existing `baseline` ref, add:
```ts
	const scheduleAutosave = useAutosave(
		(markdown) => onPersist?.(markdown),
		{ delayMs: autoSaveDelayMs, enabled: autoSave },
	)
```
- Change `handleValueChange` to also schedule autosave with the current serialized markdown:
```ts
	const handleValueChange = () => {
		const current = editor.api.markdown.serialize({
			value: editor.children as Value,
		})
		onDirtyChange?.(current !== baseline.current)
		scheduleAutosave(current)
	}
```
(Keep the existing baseline-initialization block and the Download button behavior unchanged.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS (route not yet passing the new props — TS will error only if the props are required; they are required except `onPersist`. To avoid a transient error, this task's typecheck may fail until Task 9 passes the props. That's acceptable — run Task 9 immediately after, or make `autoSave`/`autoSaveDelayMs` required and complete Task 9 before typechecking.) Do Task 9 before final typecheck.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/web-editor.tsx
git commit -m "feat(web): web editor schedules debounced auto-save"
```

---

## Task 9: Route — hydrate, persist, Cmd+S, settings

**Files:** Modify `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `loadPersistedTabsState`/`savePersistedTabsState` (Task 3), `useSettings` (Task 4), `SettingsPanel`/`SettingsButton` (Task 6), `setDirty`/`createInitialTabsState` (`web-tabs`), `downloadMarkdown`/`ensureMdExtension` (existing `../lib/download`).

- [ ] **Step 1: Hydrate initial state from storage**

Replace `const [state, setState] = useState(createInitialTabsState)` with:
```ts
const [state, setState] = useState(
	() => loadPersistedTabsState() ?? createInitialTabsState(),
)
```
Add imports for `loadPersistedTabsState`, `savePersistedTabsState`, `useSettings`, `SettingsPanel`, `SettingsButton`, and `useEffect`, `useRef`, `useState` as needed.

- [ ] **Step 2: Track current markdown per tab + persist on autosave**

Add a ref holding the latest markdown per tab and settings:
```ts
const { settings, setSettings } = useSettings()
const markdownByTab = useRef<Record<string, string>>({})
const [showSettings, setShowSettings] = useState(false)

const handlePersist = (id: string, markdown: string) => {
	markdownByTab.current[id] = markdown
	setState((s) => {
		const next = setDirty(s, id, false)
		savePersistedTabsState(next, markdownByTab.current)
		return next
	})
}
```

- [ ] **Step 3: Global Cmd+S downloads the active tab**

Add:
```ts
useEffect(() => {
	const onKeyDown = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
			e.preventDefault()
			const active = state.tabs.find((t) => t.id === state.activeTabId)
			if (!active) return
			const markdown =
				markdownByTab.current[active.id] ?? active.initialMarkdown
			downloadMarkdown(active.name, markdown)
			setState((s) => setDirty(s, active.id, false))
		}
	}
	window.addEventListener("keydown", onKeyDown)
	return () => window.removeEventListener("keydown", onKeyDown)
}, [state.tabs, state.activeTabId])
```
Add `import { downloadMarkdown } from "../lib/download"`.

- [ ] **Step 4: Pass settings + persist to each WebEditor; also persist tab-list changes**

- Pass to each `<WebEditor>`: `autoSave={settings.autoSave}`, `autoSaveDelayMs={settings.autoSaveDelayMs}`, `onPersist={(md) => handlePersist(tab.id, md)}`. Keep existing `onDirtyChange`/`onDownloaded` (note: `onDownloaded` can now also persist-clean; leave as `setDirty(false)`).
- Persist when the tab set changes (open/close/new/reuse) so the list survives reload even before an edit. Add:
```ts
useEffect(() => {
	savePersistedTabsState(state, markdownByTab.current)
}, [state])
```

- [ ] **Step 5: Render settings button + panel**

- Render `<SettingsButton onClick={() => setShowSettings(true)} />` somewhere always-visible. For this sub-project, place it at the top of the right column, before `<TabStrip>` — e.g. wrap the existing right column header. Minimal placement:
```tsx
<div className="flex min-w-0 flex-1 flex-col">
	<div className="flex items-center justify-end gap-1 px-2 pt-1">
		<SettingsButton onClick={() => setShowSettings(true)} />
	</div>
	<TabStrip ... />
	...
</div>
```
- After the outer wrapper, render the panel when open:
```tsx
{showSettings ? (
	<SettingsPanel
		settings={settings}
		onChange={setSettings}
		onClose={() => setShowSettings(false)}
	/>
) : null}
```
- Add Escape-to-close inside `SettingsPanel` (a `useEffect` keydown listener calling `onClose` on `Escape`).

- [ ] **Step 6: Typecheck + tests**

Run: `pnpm --filter @mdit/web ts:check && pnpm --filter @mdit/web test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/components/settings-panel.tsx
git commit -m "feat(web): hydrate+persist tabs, Cmd+S save, settings panel wiring"
```

---

## Task 10: Manual browser verification

**Files:** none.

- [ ] **Step 1: Start dev**, open `http://localhost:3100/?v=1`.

- [ ] **Step 2: Verify each:**
1. Type in the empty tab; after ~1s the `•` clears (auto-saved). Reload → the content is restored in the same tab.
2. Open a second tab (drop a `.md`), edit both; reload → both tabs restored with their content and the active tab preserved.
3. Open Settings (gear) → toggle Auto-save OFF → edit → `•` stays and does NOT clear; reload → the un-persisted edit is lost (expected), earlier saved content remains. Toggle back ON.
4. Change Auto-save delay to 2s → edits take ~2s to clear `•`.
5. Cmd+S → downloads the active tab's `.md` and clears `•`.
6. Settings closes via "Back to app" and Escape.
7. Console shows only the benign theme hydration warning.

- [ ] **Step 3: Stop dev server.**

---

## Task 11: Full checks

- [ ] **Step 1:** `pnpm lint` (fix with `pnpm lint:fix`) → PASS.
- [ ] **Step 2:** `pnpm --filter @mdit/web ts:check && pnpm --filter @mdit/ui ts:check` (if the ui package has ts:check; otherwise the web typecheck covers the SettingRow usage) → PASS.
- [ ] **Step 3:** `pnpm --filter @mdit/web test` → PASS.
- [ ] **Step 4:** Commit any lint fixes.

---

## Self-Review notes

- **Spec coverage:** Cmd+S download (Task 9 step 3), auto-save persist-on-idle (Tasks 7/8/9), reload restore all tabs + active (Tasks 2/3/9 step 1), dirty semantics = edited-since-autosave (Task 8 keeps `onDirtyChange` + clears on persist in Task 9), Settings card with Editor section + auto-save toggle + delay select (Tasks 5/6), settings persistence (Task 4), design-system split — `SettingRow` in `@mdit/ui`, composition in `apps/web` (Tasks 5/6). Non-goals respected (no FS Access API, no IndexedDB, single settings section).
- **Placeholder scan:** none — full code/commands in each step. The two "verify actual base-ui prop names" notes (Task 6) are real verification points against `packages/ui/src/components/select.tsx` / `switch.tsx`, not placeholders — the code given is the expected shape and the note says how to adapt.
- **Type consistency:** `PersistedTabsState`/`PersistedTab` defined in Task 2 used in Tasks 3/9; `WebSettings`/`AUTO_SAVE_DELAYS` in Task 4 used in 6/9; `onPersist(markdown: string)` in Task 8 matches `handlePersist` call in Task 9; `useAutosave` signature in Task 7 matches its use in Task 8.
- **Ordering:** storage → persisted shape → persistence glue → settings → primitive → panel → autosave hook → editor wiring → route integration → verify. Task 8 typecheck depends on Task 9 (noted inline; do 9 before final typecheck).
