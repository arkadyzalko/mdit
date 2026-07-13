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
function resolveParentId(
	ws: Workspace,
	parentId: string | null,
): string | null {
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
	const { workspace, node } = createFile(
		createEmptyWorkspace(),
		null,
		"Untitled",
	)
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
		index === undefined
			? siblings.length
			: Math.max(0, Math.min(index, siblings.length))
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
