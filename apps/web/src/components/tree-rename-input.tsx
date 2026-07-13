import { useEffect, useRef, useState } from "react"

export function TreeRenameInput({
	initialName,
	onSubmit,
	onCancel,
}: {
	initialName: string
	onSubmit: (name: string) => void
	onCancel: () => void
}) {
	const [value, setValue] = useState(initialName)
	const ref = useRef<HTMLInputElement>(null)

	useEffect(() => {
		ref.current?.focus()
		ref.current?.select()
	}, [])

	const commit = () => {
		const trimmed = value.trim()
		if (trimmed) onSubmit(trimmed)
		else onCancel()
	}

	return (
		<input
			ref={ref}
			type="text"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault()
					commit()
				} else if (e.key === "Escape") {
					e.preventDefault()
					onCancel()
				}
			}}
			onBlur={commit}
			className="h-6 w-full rounded border border-ring bg-background px-1 text-sm outline-none"
		/>
	)
}
