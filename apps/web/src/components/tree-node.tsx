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
import {
	getChildren,
	type Workspace,
	type WorkspaceNode,
} from "../lib/workspace"
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
								<DropdownMenuItem
									onClick={() => props.onRequestRename(node.id)}
								>
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
						<TreeNode
							key={child.id}
							{...props}
							node={child}
							depth={depth + 1}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}
