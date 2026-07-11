import { DragDropProvider, DragOverlay, PointerSensor } from "@dnd-kit/react"
import { useEditorRef } from "platejs/react"
import type { ReactNode } from "react"
import { useCallback } from "react"
import { handleEditorBlockDrop } from "./block-move"
import {
	EditorBlockDragOverlay,
	isEditorSourceData,
} from "./editor-drag-overlay"
import { EditorDropLine } from "./editor-drop-indicator"
import { isPoint } from "./editor-drop-indicator.helpers"
import { EditorDropOwnershipProvider } from "./editor-drop-ownership"
import { useEditorDropState } from "./use-editor-drop-state"

type DragStartEvent = Parameters<
	NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragStart"]>
>[0]
type DragMoveEvent = Parameters<
	NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragMove"]>
>[0]
type DragEndEvent = Parameters<
	NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0]

type DragOverlaySource = {
	data?: unknown
	element?: Element | null
} | null

const DND_SENSORS = [
	PointerSensor.configure({
		activationConstraints: { distance: { value: 4 } },
	}),
]

function renderDragOverlay(source: DragOverlaySource) {
	if (source && isEditorSourceData(source.data) && source.element) {
		return <EditorBlockDragOverlay sourceElement={source.element} />
	}
	return null
}

// Block drag-and-drop provider for the editor. Unlike the desktop provider,
// this handles only in-editor block reordering (no file explorer / no store).
export function EditorDndProvider({ children }: { children: ReactNode }) {
	const editor = useEditorRef()
	const {
		editorDropIndicator,
		isPointerInEditor,
		startDragging,
		updateDragging,
		completeDragging,
	} = useEditorDropState()

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const point = isPoint(event.operation.position.current)
				? event.operation.position.current
				: null
			startDragging(point)
		},
		[startDragging],
	)

	const handleDragMove = useCallback(
		(event: DragMoveEvent) => {
			updateDragging(isPoint(event.to) ? event.to : null)
		},
		[updateDragging],
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const finalPoint = isPoint(event.operation.position.current)
				? event.operation.position.current
				: null
			const { syntheticTarget } = completeDragging(finalPoint)
			if (event.canceled) return
			handleEditorBlockDrop({
				editor,
				activeData: event.operation.source?.data,
				overData: syntheticTarget ?? event.operation.target?.data,
			})
		},
		[completeDragging, editor],
	)

	return (
		<DragDropProvider
			sensors={DND_SENSORS}
			onDragStart={handleDragStart}
			onDragMove={handleDragMove}
			onDragEnd={handleDragEnd}
		>
			<EditorDropOwnershipProvider isPointerInEditor={isPointerInEditor}>
				{children}
				{editorDropIndicator ? (
					<EditorDropLine indicator={editorDropIndicator} />
				) : null}
				<DragOverlay>{renderDragOverlay}</DragOverlay>
			</EditorDropOwnershipProvider>
		</DragDropProvider>
	)
}
