# Web Editor — Internal Tabs Design

**Date:** 2026-07-11
**Status:** Approved, ready for implementation plan

## Goal

Change the web editor (`apps/web`) so it opens directly into an **empty
editable document** instead of a full-screen drop-zone, and support **multiple
documents via an internal browser-style tab bar**. Dropping a `.md` file opens
it in the current tab when that tab is empty, otherwise in a new tab.

This is a web-only change. Desktop is untouched.

## Current state

`apps/web/src/routes/index.tsx` holds a single nullable `file` state. Before a
drop it renders a full-screen `DropZone`; after a drop it renders one
`WebEditor` wrapped in `EditorDndProvider`. There is no multi-document support.

## Non-goals (YAGNI)

- No persistence of tabs across reloads (in-memory only).
- No reordering tabs by drag.
- No reusing `@mdit/store` or any desktop vault/document model.
- No file-system access beyond the existing drop + download flow.

## Data model

Lightweight, in-memory, React-local state (no `@mdit/store`, no Tauri):

```ts
type WebTab = {
  id: string            // client-generated uuid (crypto.randomUUID)
  name: string          // "Untitled" or the dropped file's name
  initialMarkdown: string
  isFile: boolean       // true once it represents an opened file
  dirty: boolean        // edited since last download
}

type WebTabsState = {
  tabs: WebTab[]
  activeTabId: string
}
```

- **Empty tab** predicate: `!tab.isFile && !tab.dirty` (the untouched
  `Untitled` tab). Only an empty *active* tab is reused by a drop.
- **Initial state:** a single empty `Untitled` tab; the app opens straight
  into the editor.

## Behavior

### Drop of a `.md` file (global handler on the editor container)

1. If the active tab is empty (`!isFile && !dirty`): replace its content with
   the file — set `initialMarkdown`, `name = file.name`, `isFile = true`.
2. Otherwise: create a new tab for the file and activate it.

Image drops (non-`.md`) are unchanged: they insert an inline WebP into the
active tab's editor and do **not** create a tab.

### New tab (`+`)

Always creates a fresh empty `Untitled` tab and activates it (browser-like:
the button always does something visible). Reuse-of-empty is only applied to
the drop path.

### Close tab (`x`, or middle-click)

- If the tab is `dirty`: `confirm("Discard unsaved changes?")`; close only on OK.
- If clean: close immediately.
- Closing the active tab activates its left neighbor (or right if it was
  leftmost).
- Closing the last remaining tab recreates a fresh empty `Untitled` tab (the
  app is never tabless).

### Dirty tracking

- A tab becomes `dirty` on the first `onValueChange` of its editor.
- A tab returns to clean (`dirty = false`) after a successful Download of that
  tab.

### Download

Acts on the **active** tab only (serializes that editor's value), then marks
the active tab clean.

## Components & files

### New

- `apps/web/src/lib/web-tabs.ts` — pure state functions (unit-tested, no React):
  - `createEmptyTab(): WebTab`
  - `isTabEmpty(tab): boolean`
  - `openFileInTabs(state, { name, markdown }): WebTabsState` (reuse-vs-new rule)
  - `newTab(state): WebTabsState`
  - `closeTab(state, id): WebTabsState` (neighbor activation, last-tab recreate)
  - `markDirty(state, id) / markClean(state, id): WebTabsState`
- `apps/web/src/lib/web-tabs.test.ts` — covers all pure functions.
- `apps/web/src/components/tab-strip.tsx` — presentational tab bar mirroring the
  desktop `TabStrip` look (rounded chips, `motion` enter/exit, active/hover
  states, `x` on hover, middle-click to close, trailing `+`). Props: `tabs`,
  `activeTabId`, `onActivate(id)`, `onClose(id)`, `onNew()`. No store access.

### Modified

- `apps/web/src/routes/index.tsx` — owns `WebTabsState`; renders `<TabStrip>`
  above a stack of `WebEditor`s (active visible, others `hidden` via CSS so each
  tab keeps its editor state); hosts the global `.md` drop handler. Removes the
  full-screen `DropZone` branch.
- `apps/web/src/components/web-editor.tsx` — new props `onDirtyChange(dirty)`
  (fired from `onValueChange`) and `onDownloaded()` (clears dirty). Keeps its
  `EditorDndProvider` wrapper per editor. Empty untouched tabs show a discreet
  placeholder hint in addition to Plate's default `'/' for commands...`.

### Removed

- `apps/web/src/components/drop-zone.tsx` — the full-screen drop-zone is gone;
  the empty editor tab is the initial surface and drop is handled globally.

## Rendering strategy

All open tabs stay **mounted**; inactive ones are hidden with CSS (`hidden`)
rather than unmounted, so each tab's Plate editor preserves its content and
undo history when switching tabs.

## Testing

- Unit tests for `web-tabs.ts` (the reuse-vs-new rule, close/neighbor/last-tab,
  dirty/clean transitions).
- Manual browser verification: open empty → type → drop file (new tab), drop on
  empty tab (reuse), switch tabs (content preserved), close dirty (confirm),
  download (active tab).

## Verification note

`@dnd-kit/react`'s PointerSensor can't be reliably driven by the automated
browser harness, so drag-based interactions are verified via unit tests + visual
rendering checks, consistent with the existing minimap/drag-handle work.
