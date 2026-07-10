export function ensureMdExtension(fileName: string): string {
	if (/\.(md|markdown)$/i.test(fileName)) return fileName
	return `${fileName}.md`
}

export function downloadMarkdown(fileName: string, markdown: string): void {
	const blob = new Blob([markdown], { type: "text/markdown" })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = ensureMdExtension(fileName)
	a.click()
	URL.revokeObjectURL(url)
}
