import { handleEditorBlockDrop } from "@mdit/editor/dnd"
import { insertResolvedImage, resolveEditorImageLink } from "@mdit/editor/media"
import { KEYS, type Path, PathApi, type PlateEditor } from "@mdit/editor/plate"
import { extname } from "pathe"
import { desktopImageImportHost } from "@/components/editor/hosts/image-import-runtime"
import { isImageFile } from "@/utils/file-icon"
import {
	type DndDragEndEvent,
	type EditorDropTargetData,
	type FileEntryDragData,
	isEditorDropTarget,
	isFileEntryDragData,
} from "./dnd-types"

type BlockNode = {
	id?: string
	type?: string
	[key: string]: unknown
}

type BlockEntry = [BlockNode, Path]

type HandleEditorDropParams = {
	event: DndDragEndEvent
	editor: PlateEditor
	selectedEntryPaths: Set<string>
	overrideTargetData?: EditorDropTargetData | null
}

type HandleFileDropToEditorParams = {
	activeData: FileEntryDragData
	editor: PlateEditor
	overData: EditorDropTargetData
	selectedEntryPaths: Set<string>
}

function collectImagePaths(
	activeData: FileEntryDragData,
	selectedEntryPaths: Set<string>,
) {
	const activePath = activeData.path
	if (!activePath || activeData.isDirectory) {
		return []
	}

	const selection = Array.from(selectedEntryPaths)
	const candidatePaths = selection.includes(activePath)
		? selection
		: [activePath]

	return candidatePaths.filter((path) => {
		const extension = extname(path)
		return extension ? isImageFile(extension) : false
	})
}

function findBlockEntryById(
	editor: PlateEditor,
	id: string,
): BlockEntry | undefined {
	return editor.api.node({
		at: [],
		block: true,
		match: (node) => (node as BlockNode).id === id,
	}) as BlockEntry | undefined
}

async function handleFileDropToEditor({
	activeData,
	editor,
	overData,
	selectedEntryPaths,
}: HandleFileDropToEditorParams): Promise<boolean> {
	const imagePaths = collectImagePaths(activeData, selectedEntryPaths)
	if (!overData.id || imagePaths.length === 0) {
		return true
	}

	const targetEntry = findBlockEntryById(editor, overData.id)
	if (!targetEntry) {
		return true
	}

	const [targetNode, targetPath] = targetEntry
	const isCodeOrTable =
		targetNode.type === editor.getType(KEYS.codeBlock) ||
		targetNode.type === editor.getType(KEYS.table)
	const position = overData.position ?? "bottom"
	const insertPath = isCodeOrTable ? PathApi.next(targetPath) : targetPath

	for (const imagePath of imagePaths) {
		const imageData = await resolveEditorImageLink(
			imagePath,
			desktopImageImportHost,
		)
		if (!imageData) {
			continue
		}

		insertResolvedImage(editor, imageData, {
			at: insertPath,
			nextBlock: position === "bottom" && !isCodeOrTable,
		})
	}

	return true
}

export async function handleEditorDrop({
	event,
	editor,
	selectedEntryPaths,
	overrideTargetData,
}: HandleEditorDropParams): Promise<boolean> {
	const overData = overrideTargetData ?? event.operation.target?.data
	if (!isEditorDropTarget(overData)) {
		return false
	}

	const activeData = event.operation.source.data
	if (isFileEntryDragData(activeData)) {
		return handleFileDropToEditor({
			activeData,
			editor,
			overData,
			selectedEntryPaths,
		})
	}

	// In-editor block reordering lives in the shared editor package.
	return handleEditorBlockDrop({ editor, activeData, overData })
}
