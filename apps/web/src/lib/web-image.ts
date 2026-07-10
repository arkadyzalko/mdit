export function isImageFile(file: File): boolean {
	return file.type.startsWith("image/")
}

export async function fileToWebpDataUrl(
	file: File,
	quality = 0.8,
): Promise<string> {
	const bitmap = await createImageBitmap(file)
	const canvas = document.createElement("canvas")
	canvas.width = bitmap.width
	canvas.height = bitmap.height
	const ctx = canvas.getContext("2d")
	if (!ctx) throw new Error("Canvas 2D context unavailable")
	ctx.drawImage(bitmap, 0, 0)
	bitmap.close()
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/webp", quality),
	)
	if (!blob) throw new Error("WebP encoding failed")
	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(blob)
	})
}
