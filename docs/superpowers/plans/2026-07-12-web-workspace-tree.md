# Web Workspace Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web editor's flat "tab = file" model with a persistent Notion-style workspace tree (folders + files, arbitrary nesting) where tabs are the *open* files; closing a tab never deletes, deletion happens only in the tree.

**Architecture:** Two separately-persisted concerns hydrated into React state: (1) a `Workspace` = flat map of `WorkspaceNode`s (`lib/workspace.ts`, pure reducers), (2) `TabsState` = open node references (`lib/web-tabs.ts`, rewritten). The left sidebar card's "recents" mode hosts a recursive tree (`workspace-tree.tsx` / `tree-node.tsx`) with hover `•••` menu + `+`, native-HTML5 drag & drop to move. The `WebEditor` and the settings-card animation are unchanged; editor content is sourced from and written back into the active tab's node.

**Tech Stack:** React 19 + TypeScript, TanStack Start (`ssr:false` route), `@mdit/ui` (`DropdownMenu` already exists — no primitive extraction needed), `lucide-react`, `motion/react` (already used by the card), Vitest (jsdom), Biome (tabs, double quotes, `asNeeded` semicolons).

## Global Constraints

- App is `apps/web` (`@mdit/web`). Desktop is untouched.
- Pure logic lives in `lib/*` with Vitest tests; components compose it. (Per `docs/architecture/web-editor.md`.)
- No new runtime dependency. Drag & drop uses native HTML5 DnD, not dnd-kit.
- Reuse the existing `@mdit/ui` `DropdownMenu` primitive; do not fork a new menu. Shared UI stays identical web+desktop.
- Storage keys: workspace = `mdit.web.workspace`, open tabs = `mdit.web.openTabs`. The old `mdit.web.tabs` key is abandoned (no migration).
- SSR/throw-safe storage only via `apps/web/src/lib/storage.ts` helpers (`readJSON`/`writeJSON`).
- TS strict: no unused vars, no `any`. Biome must pass. Node identity is `id` (duplicate names allowed).
- Everything is a node; a node is `folder` or `file`; a `file` may hold children (Notion model). `+` on any node creates a child inside it.
- Deleting a folder deletes all descendants and closes their tabs. Deleting to empty is allowed (empty state, no phantom Untitled).

---

## Task 1: Workspace data model + pure reducers

**Files:**
- Create: `apps/web/src/lib/workspace.ts`
- Test: `apps/web/src/lib/workspace.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module). Uses `crypto.randomUUID()`.
- Produces:
  - `type NodeKind = "folder" | "file"`
  - `type WorkspaceNode = { id: string; kind: NodeKind; name: string; parentId: string | null; order: number; markdown?: string }`
  - `type Workspace = { nodes: Record<string, WorkspaceNode> }`
  - `createEmptyWorkspace(): Workspace`
  - `seedWorkspace(): { workspace: Workspace; fileId: string }` — one root "Untitled" file
  - `getChildren(ws: Workspace, parentId: string | null): WorkspaceNode[]` (sorted by `order`)
  - `getRootNodes(ws: Workspace): WorkspaceNode[]`
  - `createFile(ws, parentId: string | null, name?: string): { workspace: Workspace; node: WorkspaceNode }`
  - `createFolder(ws, parentId: string | null, name?: string): { workspace: Workspace; node: WorkspaceNode }`
  - `renameNode(ws, id: string, name: string): Workspace`
  - `deleteNode(ws, id: string): { workspace: Workspace; removedIds: string[] }`
  - `moveNode(ws, id: string, newParentId: string | null, index?: number): Workspace`
  - `setNodeMarkdown(ws, id: string, markdown: string): Workspace`
  - `isDescendant(ws, maybeAncestorId: string, nodeId: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
	createFile,
	createFolder,
	deleteNode,
	getChildren,
	getRootNodes,
	isDescendant,
	moveNode,
	renameNode,
	seedWorkspace,
	setNodeMarkdown,
} from "./workspace"

describe("workspace reducers", () => {
	it("seeds one root Untitled file", () => {
		const { workspace, fileId } = seedWorkspace()
		const roots = getRootNodes(workspace)
		expect(roots).toHaveLength(1)
		expect(roots[0].id).toBe(fileId)
		expect(roots[0].kind).toBe("file")
		expect(roots[0].name).toBe("Untitled")
	})

	it("creates files/folders under a parent, ordered by insertion", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "Docs")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const a = createFile(workspace, folder.id, "A")
		workspace = a.workspace
		const b = createFile(workspace, folder.id, "B")
		workspace = b.workspace
		const kids = getChildren(workspace, folder.id)
		expect(kids.map((n) => n.name)).toEqual(["A", "B"])
	})

	it("createFile with an invalid parent falls back to root", () => {
		const { workspace } = createFile(seedWorkspace().workspace, "nope", "X")
		expect(getRootNodes(workspace).some((n) => n.name === "X")).toBe(true)
	})

	it("createFile can nest inside a file (files may hold children)", () => {
		const { workspace, fileId } = seedWorkspace()
		const { workspace: ws2, node } = createFile(workspace, fileId, "Child")
		expect(node.parentId).toBe(fileId)
		expect(getChildren(ws2, fileId).map((n) => n.name)).toEqual(["Child"])
	})

	it("renames, ignoring empty names", () => {
		const { workspace, fileId } = seedWorkspace()
		expect(renameNode(workspace, fileId, "  Renamed  ").nodes[fileId].name).toBe(
			"Renamed",
		)
		expect(renameNode(workspace, fileId, "   ").nodes[fileId].name).toBe(
			"Untitled",
		)
	})

	it("deletes a folder with all descendants and reports removedIds", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFile(workspace, folder.id, "C")
		workspace = child.workspace
		const grand = createFile(workspace, child.node.id, "G")
		workspace = grand.workspace
		const { workspace: after, removedIds } = deleteNode(workspace, folder.id)
		expect(after.nodes[folder.id]).toBeUndefined()
		expect(new Set(removedIds)).toEqual(
			new Set([folder.id, child.node.id, grand.node.id]),
		)
	})

	it("moveNode into a descendant is a no-op (cycle guard)", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFolder(workspace, folder.id, "Child")
		workspace = child.workspace
		const moved = moveNode(workspace, folder.id, child.node.id)
		expect(moved.nodes[folder.id].parentId).toBe(null) // unchanged
	})

	it("moveNode reorders siblings by index", () => {
		let { workspace } = createFile(seedWorkspace().workspace, null, "A")
		const a = getRootNodes(workspace).find((n) => n.name === "A")!
		const bRes = createFile(workspace, null, "B")
		workspace = bRes.workspace
		// move B to index 0 among root nodes
		workspace = moveNode(workspace, bRes.node.id, null, 0)
		expect(getRootNodes(workspace).map((n) => n.name).slice(0, 2)).toEqual([
			"B",
			"A",
		])
		expect(a).toBeDefined()
	})

	it("isDescendant detects nesting", () => {
		let { workspace } = createFolder(seedWorkspace().workspace, null, "F")
		const folder = getRootNodes(workspace).find((n) => n.kind === "folder")!
		const child = createFile(workspace, folder.id, "C")
		workspace = child.workspace
		expect(isDescendant(workspace, folder.id, child.node.id)).toBe(true)
		expect(isDescendant(workspace, child.node.id, folder.id)).toBe(false)
	})

	it("setNodeMarkdown updates only the target file", () => {
		const { workspace, fileId } = seedWorkspace()
		const after = setNodeMarkdown(workspace, fileId, "# Hi")
		expect(after.nodes[fileId].markdown).toBe("# Hi")
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test workspace`
Expected: FAIL (module `./workspace` not found).

- [ ] **Step 3: Write the implementation**

```ts
export type NodeKind = "folder" | "file"

export type WorkspaceNode = {
	id: string
	kind: NodeKind
	name: string
	parentId: string | null
	order: number
	markdown?: string
}

export type Workspace = { nodes: Record<string, WorkspaceNode> }

export function createEmptyWorkspace(): Workspace {
	return { nodes: {} }
}

// Resolve the parent a new node should attach to: null (root) stays root; a
// missing or unknown id falls back to root. Any existing node may hold
// children (Notion model), so we do NOT require the parent to be a folder.
function resolveParentId(ws: Workspace, parentId: string | null): string | null {
	if (parentId === null) return null
	return ws.nodes[parentId] ? parentId : null
}

function nextOrder(ws: Workspace, parentId: string | null): number {
	const siblings = getChildren(ws, parentId)
	return siblings.length === 0
		? 0
		: Math.max(...siblings.map((n) => n.order)) + 1
}

export function getChildren(
	ws: Workspace,
	parentId: string | null,
): WorkspaceNode[] {
	return Object.values(ws.nodes)
		.filter((n) => n.parentId === parentId)
		.sort((a, b) => a.order - b.order)
}

export function getRootNodes(ws: Workspace): WorkspaceNode[] {
	return getChildren(ws, null)
}

function createNode(
	ws: Workspace,
	kind: NodeKind,
	parentId: string | null,
	name: string,
): { workspace: Workspace; node: WorkspaceNode } {
	const resolvedParent = resolveParentId(ws, parentId)
	const node: WorkspaceNode = {
		id: crypto.randomUUID(),
		kind,
		name: name.trim() || "Untitled",
		parentId: resolvedParent,
		order: nextOrder(ws, resolvedParent),
		...(kind === "file" ? { markdown: "" } : {}),
	}
	return {
		workspace: { nodes: { ...ws.nodes, [node.id]: node } },
		node,
	}
}

export function createFile(
	ws: Workspace,
	parentId: string | null,
	name = "Untitled",
) {
	return createNode(ws, "file", parentId, name)
}

export function createFolder(
	ws: Workspace,
	parentId: string | null,
	name = "Untitled",
) {
	return createNode(ws, "folder", parentId, name)
}

export function seedWorkspace(): { workspace: Workspace; fileId: string } {
	const { workspace, node } = createFile(createEmptyWorkspace(), null, "Untitled")
	return { workspace, fileId: node.id }
}

export function renameNode(ws: Workspace, id: string, name: string): Workspace {
	const node = ws.nodes[id]
	if (!node) return ws
	const trimmed = name.trim()
	if (!trimmed) return ws
	return { nodes: { ...ws.nodes, [id]: { ...node, name: trimmed } } }
}

function collectDescendants(ws: Workspace, id: string, acc: string[]): void {
	acc.push(id)
	for (const child of getChildren(ws, id)) {
		collectDescendants(ws, child.id, acc)
	}
}

export function deleteNode(
	ws: Workspace,
	id: string,
): { workspace: Workspace; removedIds: string[] } {
	if (!ws.nodes[id]) return { workspace: ws, removedIds: [] }
	const removedIds: string[] = []
	collectDescendants(ws, id, removedIds)
	const remaining = { ...ws.nodes }
	for (const removedId of removedIds) delete remaining[removedId]
	return { workspace: { nodes: remaining }, removedIds }
}

export function isDescendant(
	ws: Workspace,
	maybeAncestorId: string,
	nodeId: string,
): boolean {
	let current = ws.nodes[nodeId]
	while (current?.parentId) {
		if (current.parentId === maybeAncestorId) return true
		current = ws.nodes[current.parentId]
	}
	return false
}

export function moveNode(
	ws: Workspace,
	id: string,
	newParentId: string | null,
	index?: number,
): Workspace {
	const node = ws.nodes[id]
	if (!node) return ws
	const resolvedParent = resolveParentId(ws, newParentId)
	// Reject moving into itself or any descendant (would create a cycle).
	if (resolvedParent === id) return ws
	if (resolvedParent !== null && isDescendant(ws, id, resolvedParent)) return ws

	// Build the new sibling order for the destination parent.
	const siblings = getChildren(ws, resolvedParent).filter((n) => n.id !== id)
	const insertAt =
		index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length))
	const ordered = [
		...siblings.slice(0, insertAt),
		{ ...node, parentId: resolvedParent },
		...siblings.slice(insertAt),
	]

	const nodes = { ...ws.nodes }
	ordered.forEach((n, i) => {
		nodes[n.id] = { ...nodes[n.id], parentId: resolvedParent, order: i }
	})
	return { nodes }
}

export function setNodeMarkdown(
	ws: Workspace,
	id: string,
	markdown: string,
): Workspace {
	const node = ws.nodes[id]
	if (!node || node.kind !== "file") return ws
	return { nodes: { ...ws.nodes, [id]: { ...node, markdown } } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test workspace`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @mdit/web ts:check && pnpm biome check apps/web/src/lib/workspace.ts apps/web/src/lib/workspace.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/workspace.ts apps/web/src/lib/workspace.test.ts
git commit -m "feat(web): add workspace tree data model and pure reducers"
```

---

## Task 2: Rewrite tabs as node references

**Files:**
- Modify (rewrite): `apps/web/src/lib/web-tabs.ts`
- Test (rewrite): `apps/web/src/lib/web-tabs.test.ts` (create if absent)

**Interfaces:**
- Consumes: `Workspace`, `WorkspaceNode` from Task 1 (only for `tabLabel` which reads a node's name/dirty; tabs themselves store just ids).
- Produces:
  - `type WebTab = { nodeId: string; dirty: boolean; epoch: number }`
  - `type TabsState = { openTabIds: string[]; activeTabId: string | null }`
  - `createEmptyTabsState(): TabsState`
  - `openNode(state: TabsState, nodeId: string): TabsState` — focus if already open, else append + activate
  - `closeTab(state: TabsState, nodeId: string): TabsState` — remove from open list only, activate left neighbor (or right if leftmost)
  - `closeTabsForNodes(state: TabsState, nodeIds: string[]): TabsState` — used after a delete
  - `activate(state: TabsState, nodeId: string): TabsState`
  - `setTabDirty(state: TabsState, nodeId: string, dirty: boolean): TabsState`
  - `bumpTabEpoch(state: TabsState, nodeId: string): TabsState`
  - `tabLabel(name: string, dirty: boolean): string` — `dirty ? \`${name} •\` : name`
  - Note: this module no longer owns persistence (moved to Task 3) or `name`/`markdown`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
	activate,
	closeTab,
	closeTabsForNodes,
	createEmptyTabsState,
	openNode,
	setTabDirty,
	tabLabel,
} from "./web-tabs"

describe("tabs as node references", () => {
	it("starts empty", () => {
		const s = createEmptyTabsState()
		expect(s.openTabIds).toEqual([])
		expect(s.activeTabId).toBe(null)
	})

	it("opens a node and activates it; re-opening focuses without duplicating", () => {
		let s = openNode(createEmptyTabsState(), "a")
		s = openNode(s, "b")
		expect(s.openTabIds).toEqual(["a", "b"])
		expect(s.activeTabId).toBe("b")
		s = openNode(s, "a")
		expect(s.openTabIds).toEqual(["a", "b"]) // no dupe
		expect(s.activeTabId).toBe("a")
	})

	it("closing a tab removes it from the open list and activates a neighbor", () => {
		let s = openNode(openNode(openNode(createEmptyTabsState(), "a"), "b"), "c")
		s = activate(s, "b")
		s = closeTab(s, "b")
		expect(s.openTabIds).toEqual(["a", "c"])
		expect(s.activeTabId).toBe("a") // left neighbor
	})

	it("closing the active leftmost tab activates the new leftmost", () => {
		let s = openNode(openNode(createEmptyTabsState(), "a"), "b")
		s = activate(s, "a")
		s = closeTab(s, "a")
		expect(s.openTabIds).toEqual(["b"])
		expect(s.activeTabId).toBe("b")
	})

	it("closing the last tab leaves no active tab", () => {
		let s = openNode(createEmptyTabsState(), "a")
		s = closeTab(s, "a")
		expect(s.openTabIds).toEqual([])
		expect(s.activeTabId).toBe(null)
	})

	it("closeTabsForNodes closes all deleted nodes at once", () => {
		let s = openNode(openNode(openNode(createEmptyTabsState(), "a"), "b"), "c")
		s = activate(s, "b")
		s = closeTabsForNodes(s, ["b", "c"])
		expect(s.openTabIds).toEqual(["a"])
		expect(s.activeTabId).toBe("a")
	})

	it("setTabDirty toggles dirty per node; tabLabel appends a dot", () => {
		expect(tabLabel("Doc", false)).toBe("Doc")
		expect(tabLabel("Doc", true)).toBe("Doc •")
		let s = openNode(createEmptyTabsState(), "a")
		s = setTabDirty(s, "a", true)
		expect(s.openTabIds).toEqual(["a"]) // structure unchanged
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test web-tabs`
Expected: FAIL (old exports/shape don't match).

- [ ] **Step 3: Write the implementation**

```ts
export type WebTab = { nodeId: string; dirty: boolean; epoch: number }

export type TabsState = {
	openTabIds: string[]
	activeTabId: string | null
}

// Per-tab UI state (dirty/epoch) kept separate from open order so open/close
// operations stay simple array ops. The route holds the WebTab records; these
// reducers only manage which nodes are open and which is active.

export function createEmptyTabsState(): TabsState {
	return { openTabIds: [], activeTabId: null }
}

export function openNode(state: TabsState, nodeId: string): TabsState {
	if (state.openTabIds.includes(nodeId)) {
		return { ...state, activeTabId: nodeId }
	}
	return {
		openTabIds: [...state.openTabIds, nodeId],
		activeTabId: nodeId,
	}
}

export function activate(state: TabsState, nodeId: string): TabsState {
	if (!state.openTabIds.includes(nodeId)) return state
	return { ...state, activeTabId: nodeId }
}

export function closeTab(state: TabsState, nodeId: string): TabsState {
	const index = state.openTabIds.indexOf(nodeId)
	if (index === -1) return state
	const remaining = state.openTabIds.filter((id) => id !== nodeId)
	if (remaining.length === 0) {
		return { openTabIds: [], activeTabId: null }
	}
	let activeTabId = state.activeTabId
	if (state.activeTabId === nodeId) {
		activeTabId = remaining[index - 1] ?? remaining[0]
	}
	return { openTabIds: remaining, activeTabId }
}

export function closeTabsForNodes(
	state: TabsState,
	nodeIds: string[],
): TabsState {
	let next = state
	for (const id of nodeIds) next = closeTab(next, id)
	return next
}

export function setTabDirty(): TabsState {
	// dirty is stored on the WebTab records in the route, not in TabsState;
	// kept as a no-op reducer signature for symmetry/testing is unnecessary.
	throw new Error("setTabDirty is managed in the route, not here")
}

export function tabLabel(name: string, dirty: boolean): string {
	return dirty ? `${name} •` : name
}
```

Wait — the test calls `setTabDirty(s, "a", true)` and expects state back. Keep dirty in the route's `WebTab[]`, but to satisfy the tested reducer API, store dirty in `TabsState` too is overkill. Resolve by having `setTabDirty` be a real no-op-on-structure reducer that just returns state unchanged (dirty is tracked elsewhere), matching the test which only asserts `openTabIds` is unchanged:

```ts
export function setTabDirty(state: TabsState, _nodeId: string, _dirty: boolean): TabsState {
	// Dirty/epoch are tracked on the route's WebTab records; the open/active
	// structure is unaffected by a dirty change. Returned as-is so callers can
	// treat all tab mutations uniformly.
	return state
}

export function bumpTabEpoch(state: TabsState, _nodeId: string): TabsState {
	return state
}
```

(Remove the throwing version. The `_`-prefixed params document intent; Biome allows unused when prefixed — if it does not, omit the params and let callers ignore extra args, or drop these two helpers and track epoch/dirty purely in the route. Prefer keeping them as pass-throughs so the route has a single vocabulary.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test web-tabs`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @mdit/web ts:check && pnpm biome check apps/web/src/lib/web-tabs.ts apps/web/src/lib/web-tabs.test.ts`
Expected: no errors. If Biome flags unused params, drop them per the note above.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/web-tabs.ts apps/web/src/lib/web-tabs.test.ts
git commit -m "feat(web): model tabs as references to workspace nodes"
```

---

## Task 3: Persistence for workspace + open tabs

**Files:**
- Create: `apps/web/src/lib/persist-workspace.ts`
- Test: `apps/web/src/lib/persist-workspace.test.ts`
- Delete: `apps/web/src/lib/persist-tabs.ts` (old flat-tab persistence; superseded)

**Interfaces:**
- Consumes: `readJSON`/`writeJSON` from `storage.ts`; `Workspace`/`seedWorkspace` from Task 1; `TabsState`/`createEmptyTabsState` from Task 2.
- Produces:
  - `WORKSPACE_STORAGE_KEY = "mdit.web.workspace"`, `OPEN_TABS_STORAGE_KEY = "mdit.web.openTabs"`
  - `loadWorkspace(): { workspace: Workspace; seededFileId: string | null }` — returns stored workspace, or a fresh seed (with the seeded file id) when absent/empty
  - `saveWorkspace(ws: Workspace): void`
  - `loadTabs(): TabsState`
  - `saveTabs(state: TabsState): void`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import {
	loadTabs,
	loadWorkspace,
	OPEN_TABS_STORAGE_KEY,
	saveTabs,
	saveWorkspace,
	WORKSPACE_STORAGE_KEY,
} from "./persist-workspace"
import { seedWorkspace } from "./workspace"

describe("workspace persistence", () => {
	beforeEach(() => localStorage.clear())

	it("seeds a fresh workspace when nothing is stored", () => {
		const { workspace, seededFileId } = loadWorkspace()
		expect(seededFileId).not.toBeNull()
		expect(Object.keys(workspace.nodes)).toHaveLength(1)
	})

	it("round-trips a saved workspace and reports no seed", () => {
		const { workspace } = seedWorkspace()
		saveWorkspace(workspace)
		const loaded = loadWorkspace()
		expect(loaded.seededFileId).toBeNull()
		expect(loaded.workspace.nodes).toEqual(workspace.nodes)
	})

	it("ignores the abandoned mdit.web.tabs key", () => {
		localStorage.setItem("mdit.web.tabs", JSON.stringify({ tabs: [{ id: "x" }] }))
		const { seededFileId } = loadWorkspace()
		expect(seededFileId).not.toBeNull() // still seeds; old key not read
	})

	it("round-trips open tabs; defaults to empty", () => {
		expect(loadTabs().openTabIds).toEqual([])
		saveTabs({ openTabIds: ["a", "b"], activeTabId: "b" })
		expect(loadTabs()).toEqual({ openTabIds: ["a", "b"], activeTabId: "b" })
	})

	it("uses the documented storage keys", () => {
		saveWorkspace(seedWorkspace().workspace)
		saveTabs({ openTabIds: [], activeTabId: null })
		expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull()
		expect(localStorage.getItem(OPEN_TABS_STORAGE_KEY)).not.toBeNull()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test persist-workspace`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```ts
import { readJSON, writeJSON } from "./storage"
import {
	createEmptyTabsState,
	type TabsState,
} from "./web-tabs"
import { seedWorkspace, type Workspace } from "./workspace"

export const WORKSPACE_STORAGE_KEY = "mdit.web.workspace"
export const OPEN_TABS_STORAGE_KEY = "mdit.web.openTabs"

export function loadWorkspace(): {
	workspace: Workspace
	seededFileId: string | null
} {
	const stored = readJSON<Workspace>(WORKSPACE_STORAGE_KEY)
	if (stored && stored.nodes && Object.keys(stored.nodes).length > 0) {
		return { workspace: stored, seededFileId: null }
	}
	const { workspace, fileId } = seedWorkspace()
	return { workspace, seededFileId: fileId }
}

export function saveWorkspace(ws: Workspace): void {
	writeJSON(WORKSPACE_STORAGE_KEY, ws)
}

export function loadTabs(): TabsState {
	const stored = readJSON<TabsState>(OPEN_TABS_STORAGE_KEY)
	if (stored && Array.isArray(stored.openTabIds)) return stored
	return createEmptyTabsState()
}

export function saveTabs(state: TabsState): void {
	writeJSON(OPEN_TABS_STORAGE_KEY, state)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test persist-workspace`
Expected: PASS.

- [ ] **Step 5: Delete the old persistence module and confirm no references**

```bash
rm apps/web/src/lib/persist-tabs.ts
grep -rn "persist-tabs\|loadPersistedTabsState\|savePersistedTabsState\|TABS_STORAGE_KEY" apps/web/src
```
Expected: only matches inside `routes/index.tsx` (fixed in Task 7). If the old `web-tabs.ts` still exports `toPersisted`/`fromPersisted`/`PersistedTab`, they were removed in Task 2 — confirm no other file imports them.

- [ ] **Step 6: Typecheck (route will still be broken until Task 7 — scope check to lib) + lint**

Run: `pnpm biome check apps/web/src/lib/persist-workspace.ts apps/web/src/lib/persist-workspace.test.ts`
Expected: no errors. (Full `ts:check` may fail due to `routes/index.tsx` still using old APIs; that is expected and fixed in Task 7.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/persist-workspace.ts apps/web/src/lib/persist-workspace.test.ts
git rm apps/web/src/lib/persist-tabs.ts
git commit -m "feat(web): persist workspace tree and open tabs; drop flat-tab storage"
```

---

## Task 4: Inline rename input primitive (web)

**Files:**
- Create: `apps/web/src/components/tree-rename-input.tsx`
- Test: `apps/web/src/components/tree-rename-input.test.tsx`

**Interfaces:**
- Consumes: nothing (self-contained controlled input).
- Produces: `TreeRenameInput({ initialName, onSubmit, onCancel }: { initialName: string; onSubmit: (name: string) => void; onCancel: () => void })` — autofocuses, selects all; Enter submits (trimmed, non-empty), Escape cancels, blur submits.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TreeRenameInput } from "./tree-rename-input"

describe("TreeRenameInput", () => {
	it("submits the trimmed value on Enter", () => {
		const onSubmit = vi.fn()
		render(
			<TreeRenameInput initialName="Old" onSubmit={onSubmit} onCancel={vi.fn()} />,
		)
		const input = screen.getByRole("textbox") as HTMLInputElement
		fireEvent.change(input, { target: { value: "  New  " } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(onSubmit).toHaveBeenCalledWith("New")
	})

	it("cancels on Escape", () => {
		const onCancel = vi.fn()
		render(
			<TreeRenameInput initialName="Old" onSubmit={vi.fn()} onCancel={onCancel} />,
		)
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })
		expect(onCancel).toHaveBeenCalled()
	})

	it("does not submit an empty name on Enter (cancels instead)", () => {
		const onSubmit = vi.fn()
		const onCancel = vi.fn()
		render(
			<TreeRenameInput initialName="Old" onSubmit={onSubmit} onCancel={onCancel} />,
		)
		const input = screen.getByRole("textbox")
		fireEvent.change(input, { target: { value: "   " } })
		fireEvent.keyDown(input, { key: "Enter" })
		expect(onSubmit).not.toHaveBeenCalled()
		expect(onCancel).toHaveBeenCalled()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mdit/web test tree-rename-input`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

```tsx
import { useEffect, useRef, useState } from "react"

export function TreeRenameInput({
	initialName,
	onSubmit,
	onCancel,
}: {
	initialName: string
	onSubmit: (name: string) => void
	onCancel: () => void
}) {
	const [value, setValue] = useState(initialName)
	const ref = useRef<HTMLInputElement>(null)

	useEffect(() => {
		ref.current?.focus()
		ref.current?.select()
	}, [])

	const commit = () => {
		const trimmed = value.trim()
		if (trimmed) onSubmit(trimmed)
		else onCancel()
	}

	return (
		<input
			ref={ref}
			type="text"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault()
					commit()
				} else if (e.key === "Escape") {
					e.preventDefault()
					onCancel()
				}
			}}
			onBlur={commit}
			className="h-6 w-full rounded border border-ring bg-background px-1 text-sm outline-none"
		/>
	)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mdit/web test tree-rename-input`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @mdit/web ts:check && pnpm biome check apps/web/src/components/tree-rename-input.tsx apps/web/src/components/tree-rename-input.test.tsx`
Expected: no errors. (`ts:check` may still fail on `routes/index.tsx` until Task 7; if so, verify this file has no errors of its own via the Biome check and move on.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tree-rename-input.tsx apps/web/src/components/tree-rename-input.test.tsx
git commit -m "feat(web): add inline rename input for the workspace tree"
```

---

## Task 5: Recursive tree node (row + chevron + hover controls + menu)

**Files:**
- Create: `apps/web/src/components/tree-node.tsx`

**Interfaces:**
- Consumes: `WorkspaceNode` (Task 1); `getChildren` (Task 1); `TreeRenameInput` (Task 4); `@mdit/ui` `DropdownMenu*`; `lucide-react` icons; `cn` from `@mdit/ui/lib/utils`.
- Produces:
  `TreeNode({ node, workspace, depth, activeNodeId, expandedIds, renamingId, dragOverId, onToggleExpand, onOpenFile, onNewChild, onRequestRename, onRename, onCancelRename, onDelete, onDragStart, onDragOverNode, onDropOnNode, onDragEnd }: TreeNodeProps)` where the callbacks are plain props (state lives in `WorkspaceTree`, Task 6). Renders itself then recurses over `getChildren` when expanded. `depth` drives left padding (12px per level).

- [ ] **Step 1: Write the component**

```tsx
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@mdit/ui/components/dropdown-menu"
import { cn } from "@mdit/ui/lib/utils"
import {
	ChevronRightIcon,
	FileTextIcon,
	FolderIcon,
	MoreHorizontalIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react"
import { getChildren, type WorkspaceNode, type Workspace } from "../lib/workspace"
import { TreeRenameInput } from "./tree-rename-input"

export type TreeNodeCallbacks = {
	onToggleExpand: (id: string) => void
	onOpenFile: (id: string) => void
	onNewChild: (parentId: string) => void
	onRequestRename: (id: string) => void
	onRename: (id: string, name: string) => void
	onCancelRename: () => void
	onDelete: (id: string) => void
	onDragStart: (id: string) => void
	onDragOverNode: (id: string) => void
	onDropOnNode: (id: string) => void
	onDragEnd: () => void
}

type TreeNodeProps = TreeNodeCallbacks & {
	node: WorkspaceNode
	workspace: Workspace
	depth: number
	activeNodeId: string | null
	expandedIds: Set<string>
	renamingId: string | null
	dragOverId: string | null
}

export function TreeNode(props: TreeNodeProps) {
	const {
		node,
		workspace,
		depth,
		activeNodeId,
		expandedIds,
		renamingId,
		dragOverId,
	} = props
	const children = getChildren(workspace, node.id)
	const hasChildren = children.length > 0
	const isExpanded = expandedIds.has(node.id)
	const isFolder = node.kind === "folder"
	const isActive = node.id === activeNodeId
	const isRenaming = node.id === renamingId
	const isDragOver = node.id === dragOverId

	const handleRowClick = () => {
		if (isRenaming) return
		if (isFolder) props.onToggleExpand(node.id)
		else props.onOpenFile(node.id)
	}

	return (
		<div>
			<div
				// biome-ignore lint/a11y/useKeyWithClickEvents: chevron/label have their own handlers; row click is a convenience
				className={cn(
					"group flex h-8 items-center gap-1 rounded-lg pr-1 text-sm transition-colors",
					isActive
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-muted",
					isDragOver && "ring-1 ring-ring",
				)}
				style={{ paddingLeft: depth * 12 + 4 }}
				draggable={!isRenaming}
				onDragStart={(e) => {
					e.stopPropagation()
					props.onDragStart(node.id)
				}}
				onDragOver={(e) => {
					e.preventDefault()
					props.onDragOverNode(node.id)
				}}
				onDrop={(e) => {
					e.preventDefault()
					e.stopPropagation()
					props.onDropOnNode(node.id)
				}}
				onDragEnd={props.onDragEnd}
				onClick={handleRowClick}
			>
				<button
					type="button"
					aria-label={isExpanded ? "Collapse" : "Expand"}
					className={cn(
						"flex size-4 shrink-0 items-center justify-center rounded transition-transform hover:bg-muted-foreground/10",
						isExpanded && "rotate-90",
						!isFolder && !hasChildren && "invisible",
					)}
					onClick={(e) => {
						e.stopPropagation()
						props.onToggleExpand(node.id)
					}}
				>
					<ChevronRightIcon className="size-3.5" />
				</button>

				{isFolder ? (
					<FolderIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
				) : (
					<FileTextIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
				)}

				{isRenaming ? (
					<TreeRenameInput
						initialName={node.name}
						onSubmit={(name) => props.onRename(node.id, name)}
						onCancel={props.onCancelRename}
					/>
				) : (
					<span className="flex-1 truncate">{node.name}</span>
				)}

				{!isRenaming ? (
					<div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
						<DropdownMenu>
							<DropdownMenuTrigger
								className="flex size-6 items-center justify-center rounded hover:bg-muted-foreground/10"
								aria-label="Node actions"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreHorizontalIcon className="size-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={() => props.onNewChild(node.id)}>
									<PlusIcon className="size-4" />
									New page inside
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => props.onRequestRename(node.id)}>
									Rename
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onClick={() => props.onDelete(node.id)}
								>
									<Trash2Icon className="size-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<button
							type="button"
							aria-label="New page inside"
							className="flex size-6 items-center justify-center rounded hover:bg-muted-foreground/10"
							onClick={(e) => {
								e.stopPropagation()
								props.onNewChild(node.id)
							}}
						>
							<PlusIcon className="size-4" />
						</button>
					</div>
				) : null}
			</div>

			{isExpanded && hasChildren ? (
				<div>
					{children.map((child) => (
						<TreeNode key={child.id} {...props} node={child} depth={depth + 1} />
					))}
				</div>
			) : null}
		</div>
	)
}
```

- [ ] **Step 2: Verify the `DropdownMenuItem` `variant="destructive"` prop exists**

Run: `grep -n "variant" apps/web/../../packages/ui/src/components/dropdown-menu.tsx | head`
Expected: a `variant` prop with a `destructive` option on `DropdownMenuItem`. If it does NOT exist, drop `variant="destructive"` and instead add `className="text-destructive"` to that item. Adjust the code accordingly before continuing.

- [ ] **Step 3: Typecheck + lint (component only)**

Run: `pnpm biome check apps/web/src/components/tree-node.tsx`
Expected: no errors. (Full `ts:check` still blocked by `routes/index.tsx` until Task 7.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tree-node.tsx
git commit -m "feat(web): add recursive workspace tree node with hover menu"
```

---

## Task 6: WorkspaceTree container (state: expansion, rename, drag)

**Files:**
- Create: `apps/web/src/components/workspace-tree.tsx`

**Interfaces:**
- Consumes: `Workspace`, `getRootNodes`, `moveNode`, `isDescendant` (Task 1); `TreeNode` + `TreeNodeCallbacks` (Task 5); `PlusIcon` from `lucide-react`.
- Produces:
  `WorkspaceTree({ workspace, activeNodeId, onWorkspaceChange, onOpenFile, onDeleteNode, onCreateChild, onCreateRoot }: { workspace: Workspace; activeNodeId: string | null; onWorkspaceChange: (ws: Workspace) => void; onOpenFile: (id: string) => void; onDeleteNode: (id: string) => void; onCreateChild: (parentId: string) => void; onCreateRoot: () => void })`.
  - Owns local UI state: `expandedIds: Set<string>`, `renamingId: string | null`, `draggingId: string | null`, `dragOverId: string | null`.
  - Rename commits via `renameNode` → `onWorkspaceChange`. (Import `renameNode` from Task 1.)
  - Drop calls `moveNode(workspace, draggingId, targetId)` (drop onto a node = move inside it) guarded by `isDescendant`, then `onWorkspaceChange`.
  - Header row: title + a global `+` calling `onCreateRoot`.
  - `onCreateChild`/`onDeleteNode`/`onOpenFile`/`onCreateRoot` are delegated to the route (Task 7) because they also touch tab state; tree-only concerns (expand/rename/move) are handled internally.

- [ ] **Step 1: Write the component**

```tsx
import { cn } from "@mdit/ui/lib/utils"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import {
	getRootNodes,
	isDescendant,
	moveNode,
	renameNode,
	type Workspace,
} from "../lib/workspace"
import { TreeNode } from "./tree-node"

export function WorkspaceTree({
	workspace,
	activeNodeId,
	onWorkspaceChange,
	onOpenFile,
	onDeleteNode,
	onCreateChild,
	onCreateRoot,
}: {
	workspace: Workspace
	activeNodeId: string | null
	onWorkspaceChange: (ws: Workspace) => void
	onOpenFile: (id: string) => void
	onDeleteNode: (id: string) => void
	onCreateChild: (parentId: string) => void
	onCreateRoot: () => void
}) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const [renamingId, setRenamingId] = useState<string | null>(null)
	const [draggingId, setDraggingId] = useState<string | null>(null)
	const [dragOverId, setDragOverId] = useState<string | null>(null)

	const roots = getRootNodes(workspace)

	const toggleExpand = (id: string) =>
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})

	const handleDrop = (targetId: string) => {
		if (draggingId && draggingId !== targetId) {
			if (!isDescendant(workspace, draggingId, targetId)) {
				onWorkspaceChange(moveNode(workspace, draggingId, targetId))
				// Expand the drop target so the moved node is visible.
				setExpandedIds((prev) => new Set(prev).add(targetId))
			}
		}
		setDraggingId(null)
		setDragOverId(null)
	}

	const callbacks = {
		onToggleExpand: toggleExpand,
		onOpenFile,
		onNewChild: (parentId: string) => {
			setExpandedIds((prev) => new Set(prev).add(parentId))
			onCreateChild(parentId)
		},
		onRequestRename: (id: string) => setRenamingId(id),
		onRename: (id: string, name: string) => {
			onWorkspaceChange(renameNode(workspace, id, name))
			setRenamingId(null)
		},
		onCancelRename: () => setRenamingId(null),
		onDelete: onDeleteNode,
		onDragStart: (id: string) => setDraggingId(id),
		onDragOverNode: (id: string) => setDragOverId(id),
		onDropOnNode: handleDrop,
		onDragEnd: () => {
			setDraggingId(null)
			setDragOverId(null)
		},
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col gap-1"
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				// Drop on empty space → move to root.
				e.preventDefault()
				if (draggingId) {
					onWorkspaceChange(moveNode(workspace, draggingId, null))
				}
				setDraggingId(null)
				setDragOverId(null)
			}}
		>
			<div className="flex items-center justify-between px-2 pt-1 pb-1">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Workspace
				</span>
				<button
					type="button"
					aria-label="New page"
					className={cn(
						"flex size-6 items-center justify-center rounded text-muted-foreground",
						"hover:bg-muted hover:text-foreground",
					)}
					onClick={onCreateRoot}
				>
					<PlusIcon className="size-4" />
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{roots.length === 0 ? (
					<button
						type="button"
						onClick={onCreateRoot}
						className="mx-2 mt-1 rounded-lg px-2 py-1.5 text-left text-muted-foreground text-sm hover:bg-muted"
					>
						+ New page
					</button>
				) : (
					roots.map((node) => (
						<TreeNode
							key={node.id}
							{...callbacks}
							node={node}
							workspace={workspace}
							depth={0}
							activeNodeId={activeNodeId}
							expandedIds={expandedIds}
							renamingId={renamingId}
							dragOverId={dragOverId}
						/>
					))
				)}
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Typecheck + lint (component only)**

Run: `pnpm biome check apps/web/src/components/workspace-tree.tsx`
Expected: no errors. (Full `ts:check` still blocked by `routes/index.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace-tree.tsx
git commit -m "feat(web): add workspace tree container with expand/rename/move"
```

---

## Task 7: Wire the route — workspace + tabs + editor, and update DocSidebar/TabStrip

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/components/doc-sidebar.tsx`
- Modify: `apps/web/src/components/tab-strip.tsx`

**Interfaces:**
- Consumes: Tasks 1–6 exports; existing `WebEditor`, `SettingsContent`, `AiPanel`, toolbar buttons.
- Produces: a working app where the sidebar shows the tree and tabs reflect open nodes.

This is the integration task. It has no new unit tests; correctness is verified in the browser (Step 8). Follow the sub-steps exactly.

- [ ] **Step 1: Replace tab/persistence state in `routes/index.tsx`**

Replace the imports and the `Home` state block. New state:

```tsx
// imports (replace the old web-tabs / persist-tabs imports)
import {
	loadTabs,
	loadWorkspace,
	saveTabs,
	saveWorkspace,
} from "../lib/persist-workspace"
import {
	activate,
	closeTab,
	closeTabsForNodes,
	createEmptyTabsState,
	openNode,
	tabLabel,
} from "../lib/web-tabs"
import {
	createFile,
	deleteNode,
	getChildren,
	setNodeMarkdown,
	type Workspace,
	type WorkspaceNode,
} from "../lib/workspace"
import { WorkspaceTree } from "../components/workspace-tree"
```

State (replace the `useState(loadPersistedTabsState …)` block):

```tsx
const [workspace, setWorkspace] = useState<Workspace>(
	() => loadWorkspace().workspace,
)
const [tabs, setTabs] = useState(() => {
	const { seededFileId } = loadWorkspace()
	const stored = loadTabs()
	// On a fresh seed, open the seeded file; otherwise restore the saved tabs.
	if (seededFileId) return openNode(createEmptyTabsState(), seededFileId)
	return stored.openTabIds.length > 0 ? stored : createEmptyTabsState()
})
// Per-open-tab UI state (dirty + epoch), keyed by node id.
const tabMeta = useRef<Record<string, { dirty: boolean; epoch: number }>>({})
const [, forceRerender] = useState(0)
```

> NOTE: `loadWorkspace()` is called twice above (once for workspace, once for `seededFileId`). To avoid double-seeding (two different seeded ids), call it ONCE and derive both:

```tsx
const initial = useRef(loadWorkspace()).current
const [workspace, setWorkspace] = useState<Workspace>(initial.workspace)
const [tabs, setTabs] = useState(() => {
	if (initial.seededFileId)
		return openNode(createEmptyTabsState(), initial.seededFileId)
	const stored = loadTabs()
	return stored.openTabIds.length > 0 ? stored : createEmptyTabsState()
})
```

- [ ] **Step 2: Persist workspace + tabs on change**

```tsx
useEffect(() => saveWorkspace(workspace), [workspace])
useEffect(() => saveTabs(tabs), [tabs])
```

- [ ] **Step 3: Node helpers + handlers**

```tsx
const nodeById = (id: string | null): WorkspaceNode | undefined =>
	id ? workspace.nodes[id] : undefined

const openFile = (id: string) => {
	const node = workspace.nodes[id]
	if (!node || node.kind !== "file") return
	setTabs((s) => openNode(s, id))
}

const closeActiveOrTab = (id: string) => {
	// close only removes the tab; the node stays in the workspace
	setTabs((s) => closeTab(s, id))
}

const handleDelete = (id: string) => {
	const node = workspace.nodes[id]
	if (!node) return
	const childCount = getChildren(workspace, id).length
	const msg =
		childCount > 0
			? `Delete "${node.name}" and everything inside it?`
			: `Delete "${node.name}"?`
	if (!window.confirm(msg)) return
	const { workspace: nextWs, removedIds } = deleteNode(workspace, id)
	setWorkspace(nextWs)
	setTabs((s) => closeTabsForNodes(s, removedIds))
	for (const removedId of removedIds) delete tabMeta.current[removedId]
}

const createChild = (parentId: string) => {
	const { workspace: nextWs, node } = createFile(workspace, parentId)
	setWorkspace(nextWs)
	setTabs((s) => openNode(s, node.id))
}

const createRoot = () => {
	const { workspace: nextWs, node } = createFile(workspace, null)
	setWorkspace(nextWs)
	setTabs((s) => openNode(s, node.id))
}
```

- [ ] **Step 4: Editor persistence writes into the node**

Replace the old `handlePersist`/`markdownByTab` flow. The editor's `onPersist`/`onChange` now write into the node's markdown:

```tsx
const liveMarkdown = useRef<Record<string, string>>({})

const handlePersist = (id: string, markdown: string) => {
	liveMarkdown.current[id] = markdown
	setWorkspace((ws) => setNodeMarkdown(ws, id, markdown))
	setTabDirtyMeta(id, false)
}

const setTabDirtyMeta = (id: string, dirty: boolean) => {
	const prev = tabMeta.current[id] ?? { dirty: false, epoch: 0 }
	if (prev.dirty === dirty) return
	tabMeta.current[id] = { ...prev, dirty }
	forceRerender((n) => n + 1)
}

const downloadActiveTab = () => {
	const id = tabs.activeTabId
	const node = nodeById(id)
	if (!id || !node) return
	const markdown =
		liveMarkdown.current[id] ?? node.markdown ?? ""
	downloadMarkdown(node.name, markdown)
	setTabDirtyMeta(id, false)
}
```

- [ ] **Step 5: Render — tabs from open nodes, editors per open tab**

Replace the `TabStrip` props and the editor list. Build tab items from `tabs.openTabIds` → nodes:

```tsx
const openNodes = tabs.openTabIds
	.map((id) => workspace.nodes[id])
	.filter((n): n is WorkspaceNode => Boolean(n))
```

TabStrip:

```tsx
<TabStrip
	tabs={openNodes.map((n) => ({
		id: n.id,
		label: tabLabel(n.name, tabMeta.current[n.id]?.dirty ?? false),
	}))}
	activeTabId={tabs.activeTabId}
	onActivate={(id) => setTabs((s) => activate(s, id))}
	onClose={closeActiveOrTab}
	onNew={createRoot}
	actions={/* unchanged: Download, AiPanelToggle, SettingsButton */}
/>
```

Editors (one per open tab, active shown):

```tsx
{openNodes.map((node) => {
	const isActive = node.id === tabs.activeTabId
	const epoch = tabMeta.current[node.id]?.epoch ?? 0
	return (
		<div
			key={`${node.id}:${epoch}`}
			className={isActive ? "h-full w-full" : "hidden"}
		>
			<PlateController>
				<EditorDndProvider>
					<WebEditor
						fileName={node.name}
						initialMarkdown={node.markdown ?? ""}
						autoSave={settings.autoSave}
						autoSaveDelayMs={settings.autoSaveDelayMs}
						onChange={(md) => {
							liveMarkdown.current[node.id] = md
						}}
						onPersist={(md) => handlePersist(node.id, md)}
						onDirtyChange={(dirty) => setTabDirtyMeta(node.id, dirty)}
					/>
				</EditorDndProvider>
			</PlateController>
		</div>
	)
})}
```

- [ ] **Step 6: Update `DocSidebar` to host the tree**

`DocSidebar` currently renders a flat "Recents" list in its recents mode. Replace that `motion.div key="recents"` body with `<WorkspaceTree … />`, threading new props through `DocSidebar`:

```tsx
// doc-sidebar.tsx — add to props:
workspace: Workspace
activeNodeId: string | null
onWorkspaceChange: (ws: Workspace) => void
onOpenFile: (id: string) => void
onDeleteNode: (id: string) => void
onCreateChild: (parentId: string) => void
onCreateRoot: () => void
```

Replace the recents `motion.div` inner content (the `Recents` header + `<nav>` list + `<DownloadMac />`) with:

```tsx
<motion.div
	key="recents"
	className="flex h-full min-h-0 flex-col gap-1"
	initial={{ opacity: 0, x: -12 }}
	animate={{ opacity: 1, x: 0 }}
	exit={{ opacity: 0, x: -12 }}
	transition={{ duration: 0.16, ease: "easeOut" }}
>
	<div className="min-h-0 flex-1">
		<WorkspaceTree
			workspace={workspace}
			activeNodeId={activeNodeId}
			onWorkspaceChange={onWorkspaceChange}
			onOpenFile={onOpenFile}
			onDeleteNode={onDeleteNode}
			onCreateChild={onCreateChild}
			onCreateRoot={onCreateRoot}
		/>
	</div>
	<DownloadMac />
</motion.div>
```

Remove the now-unused `tabs`/`activeTabId`/`onActivate`/`WebTab`/`FileTextIcon`/`tabLabel` imports from `doc-sidebar.tsx` (the flat list is gone). Keep the settings mode (`key="settings"`) untouched.

Then in `index.tsx`, pass the new props to `<DocSidebar>`:

```tsx
<DocSidebar
	workspace={workspace}
	activeNodeId={tabs.activeTabId}
	onWorkspaceChange={setWorkspace}
	onOpenFile={openFile}
	onDeleteNode={handleDelete}
	onCreateChild={createChild}
	onCreateRoot={createRoot}
	showSettings={showSettings}
	settings={settings}
	onChangeSettings={setSettings}
	onCloseSettings={() => setShowSettings(false)}
/>
```

- [ ] **Step 7: Fix the drop-to-open-file handler on the editor pane**

The editor pane already accepts dropped `.md` files. Keep that, but route a dropped markdown file into a NEW workspace node instead of the old `openMarkdownFile` tab logic:

```tsx
const openMarkdownFile = async (file: File) => {
	const markdown = await file.text()
	const { workspace: nextWs, node } = createFile(workspace, null, file.name)
	setWorkspace(setNodeMarkdown(nextWs, node.id, markdown))
	setTabs((s) => openNode(s, node.id))
}
```

Remove old imports now unused in `index.tsx`: `createInitialTabsState`, `newTab`, `openFileInTabs`, `setDirty`, `savePersistedTabsState`, `loadPersistedTabsState`, `DocSidebar`'s old props, and `markdownByTab`.

- [ ] **Step 8: Full typecheck, lint, build, and browser verification**

Run:
```bash
pnpm --filter @mdit/web ts:check
pnpm biome check apps/web/src
pnpm --filter @mdit/web test
pnpm --filter @mdit/web build
```
Expected: all pass (tests: workspace + web-tabs + persist-workspace + tree-rename-input + the pre-existing settings/chat suites).

Then run the dev server (`pnpm --filter @mdit/web dev`) and verify in the browser:
1. Fresh load (after `localStorage.clear()`): one "Untitled" file in the tree, open in a tab.
2. Hover a row → `•••` and `+` appear. `+` creates a child (row nests, tab opens).
3. `•••` → Rename → inline input; Enter commits, tree + tab label update.
4. `•••` → Delete on a folder with children → confirm → node and descendants gone, their tabs closed.
5. Close a tab (× on the tab) → file REMAINS in the tree (not deleted).
6. Click a file in the tree → opens/focuses its tab.
7. Drag a node onto a folder → moves inside; drag onto empty space → moves to root; drag onto own descendant → no-op.
8. Reload page → tree + open tabs restored from localStorage.
9. Settings still opens with the expand animation and two-column nav.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/components/doc-sidebar.tsx apps/web/src/components/tab-strip.tsx
git commit -m "feat(web): wire workspace tree — tree sidebar, node-backed tabs, delete/rename/move"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** data model (T1), tabs-as-refs (T2), persistence + discard old key (T3), rename input (T4), tree node with hover `•••`/`+` menu (T5), tree container with expand/rename/drag-move (T6), route wiring + DocSidebar/TabStrip + editor + drop-to-create + browser checks (T7). All spec sections map to a task.
- **Type consistency:** `Workspace`, `WorkspaceNode`, `TabsState`, `WebTab`, and every reducer signature are identical across tasks. `tabLabel(name, dirty)` signature is the same in T2 and T7.
- **`DocSidebar` prop change is breaking:** T7 updates both the component and its single caller in the same task, so no intermediate broken state ships in a committed task other than the intentional lib-only commits in T2/T3 (route is fixed by T7; the plan flags that full `ts:check` is expected to fail between T2 and T7 and only gates on per-file Biome until then).
- **Double-seed hazard:** T7 Step 1 explicitly calls `loadWorkspace()` once via a ref to avoid generating two different seeded ids.
- **`variant="destructive"` uncertainty:** T5 Step 2 verifies the prop and provides a className fallback.
