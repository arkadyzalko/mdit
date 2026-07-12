# Web Workspace Tree (Notion-style) — Design Spec

**Date:** 2026-07-12
**App:** `apps/web` (`@mdit/web`) — the static web editor. Desktop unaffected.
**Status:** approved design; implementation plan to follow.

## Goal

Turn the web editor's flat "tab = file" model into a Notion-style
**workspace**: a persistent tree of nodes (folders and files) shown in the
left card, with tabs as merely the *open* files. Closing a tab no longer
deletes the file; deletion happens only in the tree. Folders and files can
nest arbitrarily (everything is a node, folder or not).

## Background (current model)

Today `WebTab` *is* the file: it carries `name` + `markdown`, is persisted
under `mdit.web.tabs`, and closing a tab removes the only copy. There is no
separation between "stored file" and "open tab", no folders, and no delete
that is distinct from close. See `apps/web/src/lib/web-tabs.ts` and
`persist-tabs.ts`.

## Decisions (locked)

- **Open/close vs delete:** clicking a file in the tree opens/focuses a tab.
  Closing a tab only removes it from the tab bar; the file stays in the
  workspace. Delete happens only from the tree (context menu), with
  confirmation. (Notion/VSCode model.)
- **Tree actions (Notion-style):** hover a row reveals `•••` (context menu:
  New page inside, Rename, Delete) and `+` (new child page). A global `+` at
  the top of the card creates a page at the root. Move by drag & drop. Nesting
  is arbitrary.
- **Migration:** none. Abandon `mdit.web.tabs` and start from an empty
  workspace seeded with one "Untitled" file at the root. The old test
  "Untitled" files are discarded.

## Architecture

Two separately-persisted concerns, both in-memory React state hydrated on
load, following the existing pure-lib + tests convention (see
`docs/architecture/web-editor.md`).

### 1. Workspace tree — `lib/workspace.ts` (pure)

Everything is a node; a node is a `folder` or a `file`.

```ts
type NodeKind = "folder" | "file"

type WorkspaceNode = {
  id: string
  kind: NodeKind
  name: string
  parentId: string | null   // null = root
  order: number             // ordering among siblings
  markdown?: string         // files only
}

type Workspace = { nodes: Record<string, WorkspaceNode> }
```

Stored as a **flat map** keyed by id (not a nested tree) — the shape Notion
uses; it makes move/reorder trivial and avoids deep-clone bugs. The visual
tree is derived from `parentId`.

**Pure reducers (each takes and returns a `Workspace`):**

| Function | Behavior | Edge cases |
|---|---|---|
| `createFile(ws, parentId, name?)` | New file under `parentId` (or root). Default name `"Untitled"`. Returns `{ ws, node }`. | Invalid/non-folder `parentId` → root. `order` = max sibling order + 1. |
| `createFolder(ws, parentId, name?)` | Same, kind `folder`. Returns `{ ws, node }`. | idem. |
| `renameNode(ws, id, name)` | Rename (trimmed). Empty name → keep old. | No-op if node missing. |
| `deleteNode(ws, id)` | Remove node **and all descendants**. Returns `{ ws, removedIds }`. | Recursively collects descendants. No-op if missing. |
| `moveNode(ws, id, newParentId, index?)` | Move into another folder / reorder among siblings. | **Rejects moving into itself or a descendant** (cycle) → no-op. `newParentId` must be a folder or `null`. Reindexes siblings. |
| `getChildren(ws, parentId)` | Children sorted by `order`. | — |
| `getRootNodes(ws)` | Children where `parentId === null`. | — |

**Edge cases that must have tests:**
1. Cycle on move (folder into its own descendant) → no-op.
2. Delete a node that is open → caller uses `removedIds` to close tabs and
   activate a neighbor.
3. Delete leaving the workspace empty → allowed; UI shows an empty state with
   a "New page" button (no phantom Untitled auto-created).
4. Reorder within the same folder (drag between siblings) → `moveNode` with
   `index`.
5. Duplicate names allowed (identity is `id`, not name).

### 2. Tabs — `lib/web-tabs.ts` (rewritten, pure)

A tab becomes a reference to a file node plus UI state. No own `name`/
`markdown` — those come from the node.

```ts
type WebTab = { nodeId: string; dirty: boolean; epoch: number }
type TabsState = { openTabIds: string[]; activeTabId: string | null }
```

Reducers: `openNode`, `closeTab` (removes from `openTabIds` only, activates a
neighbor), `activate`, `setDirty`, `bumpEpoch`, plus `closeTabsForNodes(ids)`
used when a delete removes open files. `epoch` still forces an editor remount
when a tab's node content is replaced.

### Persistence

- `lib/persist-workspace.ts` — `loadWorkspace()/saveWorkspace()`, key
  `mdit.web.workspace`; `loadTabs()/saveTabs()`, key `mdit.web.openTabs`.
  Both SSR/throw-safe via `storage.ts`.
- On first load (no workspace key): seed one `"Untitled"` file at root, open
  it. Autosave writes the edited markdown into the node and persists the
  workspace (reusing the existing debounced autosave hook).

## UI

New components in `apps/web/src/components/`:

- **`workspace-tree.tsx`** — the tree inside the card's "recents" mode.
  Renders root nodes and recurses. Replaces the old flat "Recents" list in
  `DocSidebar`. Header row carries a global `+` (new page at root).
- **`tree-node.tsx`** — one recursive row:
  - chevron `›` for folders (expand/collapse; expansion state in memory, keyed
    by node id);
  - kind icon (folder / file);
  - name (rename inline via `<input>` on menu→Rename or double-click);
  - on hover, right-aligned `•••` (context menu) and `+` (new child page — for
    a file, `+` creates a child inside it, matching Notion where any page can
    hold children);
  - click a file → open/focus its tab; click a folder → toggle expand.
- **`tree-node-menu.tsx`** — the `•••` menu (base-ui menu primitive). Items:
  **New page inside**, **Rename**, **Delete** (Delete confirms via
  `window.confirm`, consistent with the dirty-tab close prompt).

**Drag & drop (move):** native HTML5 DnD (`draggable` + `onDragStart/Over/
Drop`), no new dependency. Drop **onto a folder** → move inside; drop
**between rows** → reorder/move at that level (line indicator). Invalid targets
(a node's own descendants) are not droppable; `moveNode` also rejects cycles as
a backstop.

**Tabs referencing nodes** (`index.tsx`, `tab-strip.tsx`): `TabStrip` shows
`node.name` (+ "•" when dirty). Close removes from `openTabIds` only. Open:
clicking a file focuses it if already open, else appends and activates. The
`WebEditor` is unchanged (`fileName`/`initialMarkdown` now sourced from the
node); `onChange`/`onPersist` write into `node.markdown` and persist.

**`DocSidebar`** stays the animated two-mode card (recents ↔ settings). The
recents mode now hosts `WorkspaceTree` + top `+` instead of the flat list. The
settings expand animation already shipped is unchanged.

## Design system

If no menu primitive exists in `@mdit/ui`, extract a base-ui `Menu`/
`DropdownMenu` there (reusable web + desktop, identical styling per the
web↔desktop rule). Tree/domain logic stays in `apps/web`, never in `@mdit/ui`.
Icons/chevrons via `lucide-react`.

## Out of scope (YAGNI)

VSCode-style 1-click preview tabs; tree search; per-page emoji/icons;
undo of tree operations. Revisit later if wanted.

## Testing

- `lib/workspace.test.ts` — every reducer + all five edge cases above.
- `lib/web-tabs.test.ts` — rewritten for the node-reference model
  (open/focus, close ≠ delete, close-on-delete, neighbor activation, epoch).
- `lib/persist-workspace.test.ts` — round-trip + first-load seed + discard of
  the old `mdit.web.tabs` key.
- Component behavior (create/rename/delete/move, open/close) verified in the
  browser during implementation.
