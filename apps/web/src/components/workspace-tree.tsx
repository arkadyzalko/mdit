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
