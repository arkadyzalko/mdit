import { EditorDndProvider } from "@mdit/editor/dnd"
import { PlateController } from "@mdit/editor/plate"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { DropZone } from "../components/drop-zone"
import { WebEditor } from "../components/web-editor"

export const Route = createFileRoute("/")({
	ssr: false,
	component: Home,
})

function Home() {
	const [file, setFile] = useState<{ name: string; markdown: string } | null>(
		null,
	)

	return (
		<PlateController>
			{file ? (
				<EditorDndProvider>
					<WebEditor fileName={file.name} initialMarkdown={file.markdown} />
				</EditorDndProvider>
			) : (
				<DropZone onFile={(name, markdown) => setFile({ name, markdown })} />
			)}
		</PlateController>
	)
}
