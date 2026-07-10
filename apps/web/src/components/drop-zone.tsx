import { useRef, useState } from "react"

export function DropZone({
	onFile,
}: {
	onFile: (name: string, markdown: string) => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)

	const handleFile = async (file: File) => {
		const text = await file.text()
		onFile(file.name, text)
	}

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setDragging(true)
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				e.preventDefault()
				setDragging(false)
				const file = e.dataTransfer.files[0]
				if (file) void handleFile(file)
			}}
			onClick={() => inputRef.current?.click()}
			className={`flex h-screen w-full cursor-pointer items-center justify-center text-center ${
				dragging ? "bg-accent" : "bg-background"
			}`}
		>
			<div className="text-muted-foreground">
				<p className="text-lg">Drop a .md file here</p>
				<p className="text-sm">or click to choose</p>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept=".md,.markdown,text/markdown"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0]
					if (file) void handleFile(file)
				}}
			/>
		</div>
	)
}
