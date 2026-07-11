# Web Editor — Save, Auto-save & Settings Design

**Date:** 2026-07-11
**Status:** Approved, ready for implementation plan
**Sub-project 1 of 3** (others: visual redesign; AI panel)

## Goal

Give the web editor (`apps/web`) a real "save" model, since it has no
filesystem binding (documents are read into memory via drop):

- **Cmd+S** downloads the active tab's `.md` (the only way to write to disk).
- **Auto-save** persists each tab's content to the browser (`localStorage`)
  after the user stops typing (debounced), clearing the dirty marker.
- **Reload restores** all open tabs, their content, and the active tab.
- A **Settings panel** (card layout, sections on the left + content on the
  right, "Back to app") hosts the auto-save configuration.

Reusable, domain-agnostic UI primitives live in the `@mdit/ui` design system,
not in `apps/web`.

## Background / current state

- `apps/web` opens `.md` via drop → `file.text()` into an in-memory
  `WebTabsState` (`apps/web/src/lib/web-tabs.ts`). No `FileSystemFileHandle`,
  so writing back to the original file is not possible.
- Each tab renders its own Plate editor inside `WebEditor`
  (`apps/web/src/components/web-editor.tsx`). The route
  (`apps/web/src/routes/index.tsx`) holds tab state via `useState`.
- `dirty` is tracked per tab by comparing the editor's serialized content to a
  baseline (`WebEditor`), reported up via `onDirtyChange(dirty)`.
- No settings / localStorage usage exists yet.
- `@mdit/ui` is a mature design system exporting primitives via
  `@mdit/ui/components/*` — including `Switch`, `Select`, `Button`,
  `Separator`, `Dialog`, `Label`.

## Semantics

- **Persisted state (localStorage) = the saved state.** Auto-save writes it.
- **`dirty`** now means "edited since the last auto-save". It is NOT persisted;
  on reload everything is clean (what's in storage IS the saved content).
- **Cmd+S** = download active tab's `.md` (unchanged behavior of the existing
  Download button; also marks clean, like Download does today).
- Downloading and auto-save are independent: auto-save keeps the browser copy
  current; Cmd+S/Download exports to disk.

## Data & persistence

### localStorage keys
- `mdit.web.tabs` — `{ tabs: PersistedTab[]; activeTabId: string }`
  where `PersistedTab = { id, name, markdown, isFile, epoch }`
  (`markdown` = the tab's current serialized content; no `dirty`).
- `mdit.web.settings` — `WebSettings` (below).

### WebSettings
```ts
type WebSettings = {
  autoSave: boolean       // default true
  autoSaveDelayMs: number // default 1000; options 500 | 1000 | 2000
}
```

### Load/restore on startup
- On mount, read `mdit.web.tabs`. If present and non-empty, hydrate
  `WebTabsState` from it (all tabs, content, active tab); else start with a
  single empty `Untitled` tab (current behavior).
- All restored tabs start clean (`dirty: false`).

### Auto-save flow
- `WebEditor` reports its current serialized markdown when content changes
  (debounced by `autoSaveDelayMs`) via a new callback
  `onPersist(markdown: string)` — but only when auto-save is on.
- The route, on `onPersist`, updates that tab's stored `markdown`, marks the
  tab clean, and writes `mdit.web.tabs` to localStorage.
- When auto-save is off, `onDirtyChange` still drives the `•` marker, but no
  persistence happens; Cmd+S/Download remains the way to save to disk.

## Settings panel

- Card layout matching the reference: left column of section names, right
  content area, a "Back to app" affordance. For now a single section:
  **Editor**, containing:
  - **Auto-save** — `Switch` (default on).
  - **Auto-save delay** — `Select` (0.5s / 1s / 2s), shown only when auto-save
    is on. Default 1s.
- Opened via a gear (settings) button. For this sub-project the trigger lives
  in the header/sidebar; the visual redesign sub-project will place it in the
  header per the reference. Overlay closes via "Back to app" / Escape.
- Settings persist to `mdit.web.settings` immediately on change.

## Design system split (`@mdit/ui` vs `apps/web`)

**Reuse from `@mdit/ui`:** `Switch`, `Select`, `Button`, `Separator`,
`Label`.

**New generic primitives → add to `@mdit/ui`** (domain-agnostic, reusable by
desktop + web):
- `SettingRow` — a labeled row: title + optional description on the left, a
  control slot on the right. Mirrors the reference's toggle rows. Props:
  `{ title, description?, children (control), htmlFor? }`.

**Stays app-specific in `apps/web`** (composition + domain state):
- `settings.ts` / `use-settings.ts` — the `WebSettings` shape, defaults,
  load/save, and hook.
- `settings-panel.tsx` — composes `SettingRow` + primitives into the Editor
  section; owns the section list and Back-to-app.
- `settings-button.tsx` — the gear trigger.
- persistence + autosave hooks (below).

Rule: generic, logic-free primitive → `@mdit/ui`; composition/domain state →
`apps/web`.

## Architecture & files

**New in `packages/ui/src/components/`:**
- `setting-row.tsx` — the `SettingRow` primitive.

**New in `apps/web/src/`:**
- `lib/storage.ts` — typed, SSR-safe localStorage get/set JSON helpers.
- `lib/persist-tabs.ts` — `loadPersistedTabs()`, `savePersistedTabs(state)`,
  and conversion between `WebTabsState` and the persisted shape.
- `lib/persist-tabs.test.ts` — round-trip + empty/corrupt-storage tests.
- `lib/settings.ts` — `WebSettings`, defaults, `loadSettings()`,
  `saveSettings()`.
- `lib/settings.test.ts` — defaults + persistence + clamping of unknown values.
- `hooks/use-settings.ts` — `useSettings()` → `{ settings, setSettings }`.
- `hooks/use-autosave.ts` — `useAutosave(onPersist, delayMs, enabled)` returning
  a `schedule()` to call on change; debounced.
- `components/settings-panel.tsx`, `components/settings-button.tsx`.

**Modified:**
- `apps/web/src/lib/web-tabs.ts` — add persisted (de)serialization helpers:
  `toPersisted(state)` / `fromPersisted(persisted)`; a `markClean(state, id)`
  if not already covered by `setDirty(..., false)`.
- `apps/web/src/components/web-editor.tsx` — add `onPersist(markdown)` +
  wire debounced auto-save; Cmd+S handled at route level (see below). Keep
  `onDirtyChange`.
- `apps/web/src/routes/index.tsx` — initialize tab state from persisted
  storage; render `SettingsButton`/`SettingsPanel`; add a global Cmd+S handler
  (download active tab's markdown); pass settings into each `WebEditor`;
  persist on `onPersist`.

## Keyboard

- **Cmd+S / Ctrl+S** (global `keydown`, `preventDefault`): download the active
  tab's `.md` and mark it clean. Registered at the route level so it works
  regardless of focus.

## Testing

- Unit: `persist-tabs` round-trip (state → persisted → state), empty storage →
  null, corrupt JSON → null (no throw). `settings` defaults + persistence +
  unknown-delay clamping.
- Unit: `web-tabs` `toPersisted`/`fromPersisted`.
- Manual (browser): type → auto-save persists (dirty clears) → reload restores
  tabs + content + active tab; toggle auto-save off → editing keeps `•`, no
  persist; Cmd+S downloads active tab; change delay → debounce timing changes;
  Settings opens/closes.

## Non-goals (YAGNI)

- No File System Access API (write-back to the original file) — separate future
  option.
- No cross-device sync; localStorage only.
- No multi-section settings beyond Editor for now (Appearance/theme can come
  with the visual redesign sub-project).
- No IndexedDB; localStorage is sufficient for single-file markdown.

## Verification note

`@dnd-kit/react` PointerSensor and Plate keystroke synthesis are hard to drive
in the automated browser harness; dirty/persist behavior is verified via unit
tests plus a scripted `beforeinput` edit + reload check, consistent with prior
web work.
