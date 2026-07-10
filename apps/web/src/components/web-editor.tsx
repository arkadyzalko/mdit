import { createMarkdownDeserializerWithFallback } from "@mdit/editor/markdown"
import { HeadingMinimap } from "@mdit/editor/minimap"
import { usePlateEditor, type Value } from "@mdit/editor/plate"
import { EditorSurface } from "@mdit/editor/shared"
import { createWebEditorKit } from "@mdit/editor/web-kit"
import { Button } from "@mdit/ui/components/button"
import { useMemo } from "react"
import { downloadMarkdown } from "../lib/download"

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
			<Button
				type="button"
				className="absolute top-3 right-12 z-40"
				onClick={() =>
					downloadMarkdown(
						fileName,
						editor.api.markdown.serialize({ value: editor.children as Value }),
					)
				}
			>
				Download
			</Button>
			<EditorSurface editor={editor} rightRail={<HeadingMinimap />} />
		</div>
	)
}
