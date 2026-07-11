import { createMarkdownDeserializerWithFallback } from "@mdit/editor/markdown"
import { insertResolvedImage } from "@mdit/editor/media"
import { HeadingMinimap } from "@mdit/editor/minimap"
import { usePlateEditor, type Value } from "@mdit/editor/plate"
import { EditorSurface } from "@mdit/editor/shared"
import { createWebEditorKit } from "@mdit/editor/web-kit"
import { Button } from "@mdit/ui/components/button"
import { useMemo, useRef } from "react"
import { downloadMarkdown } from "../lib/download"
import { fileToWebpDataUrl, isImageFile } from "../lib/web-image"

export function WebEditor({
	fileName,
	initialMarkdown,
	onDirtyChange,
	onDownloaded,
}: {
	fileName: string
	initialMarkdown: string
	// Called with whether the document currently differs from what was loaded.
	onDirtyChange?: (dirty: boolean) => void
	onDownloaded?: () => void
}) {
	const plugins = useMemo(() => createWebEditorKit(), [])

	const value = useMemo<Value>(() => {
		const deserialize = createMarkdownDeserializerWithFallback({
			mdxPlugins: plugins,
			noMdxPlugins: plugins,
		})
		return deserialize({ content: initialMarkdown, path: fileName })
	}, [plugins, initialMarkdown, fileName])

	const editor = usePlateEditor({ plugins, value })

	// Baseline to compare against: the editor's serialization of the document as
	// loaded. Comparing serialized content (rather than counting onValueChange
	// calls) means spurious change events on mount don't mark the tab dirty, and
	// editing back to the original clears it. Computed lazily once from the
	// initial editor state so it reflects exactly what the editor round-trips.
	const baseline = useRef<string | null>(null)
	if (baseline.current === null) {
		baseline.current = editor.api.markdown.serialize({
			value: editor.children as Value,
		})
	}
	const handleValueChange = () => {
		const current = editor.api.markdown.serialize({
			value: editor.children as Value,
		})
		onDirtyChange?.(current !== baseline.current)
	}

	const insertImageFile = async (file: File) => {
		const dataUrl = await fileToWebpDataUrl(file)
		insertResolvedImage(editor, { url: dataUrl }, { nextBlock: true })
	}

	return (
		<div
			className="relative h-full w-full"
			data-editor-scroll-root
			onPaste={(e) => {
				const file = Array.from(e.clipboardData.files)[0]
				if (file && isImageFile(file)) {
					e.preventDefault()
					void insertImageFile(file)
				}
			}}
			onDrop={(e) => {
				const file = Array.from(e.dataTransfer.files)[0]
				if (file && isImageFile(file)) {
					e.preventDefault()
					e.stopPropagation()
					void insertImageFile(file)
				}
			}}
		>
			<Button
				type="button"
				className="absolute top-3 right-12 z-40"
				onClick={() => {
					const markdown = editor.api.markdown.serialize({
						value: editor.children as Value,
					})
					downloadMarkdown(fileName, markdown)
					// The downloaded content is now the clean baseline.
					baseline.current = markdown
					onDownloaded?.()
				}}
			>
				Download
			</Button>
			<EditorSurface
				editor={editor}
				onValueChange={handleValueChange}
				rightRail={<HeadingMinimap />}
			/>
		</div>
	)
}
