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
	onDirtyChange?: () => void
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

	// Plate fires onValueChange once on mount (initial value settle); ignore
	// that first call so a freshly opened/created tab isn't marked dirty.
	const hasSettled = useRef(false)
	const handleValueChange = () => {
		if (!hasSettled.current) {
			hasSettled.current = true
			return
		}
		onDirtyChange?.()
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
					downloadMarkdown(
						fileName,
						editor.api.markdown.serialize({ value: editor.children as Value }),
					)
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
