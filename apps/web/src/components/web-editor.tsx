import { createMarkdownDeserializerWithFallback } from "@mdit/editor/markdown"
import { HeadingMinimap } from "@mdit/editor/minimap"
import { usePlateEditor, type Value } from "@mdit/editor/plate"
import { EditorSurface } from "@mdit/editor/shared"
import { createWebEditorKit } from "@mdit/editor/web-kit"
import { useMemo } from "react"

export function WebEditor({
	fileName,
	initialMarkdown,
}: {
	fileName: string
	initialMarkdown: string
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

	return (
		<div className="relative h-screen w-full">
			<EditorSurface editor={editor} rightRail={<HeadingMinimap />} />
		</div>
	)
}
