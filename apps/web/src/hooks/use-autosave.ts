import { useCallback, useEffect, useRef } from "react"

export function useAutosave(
	onPersist: (markdown: string) => void,
	{ delayMs, enabled }: { delayMs: number; enabled: boolean },
) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const onPersistRef = useRef(onPersist)
	onPersistRef.current = onPersist

	const clear = useCallback(() => {
		if (timer.current !== null) {
			clearTimeout(timer.current)
			timer.current = null
		}
	}, [])

	useEffect(() => clear, [clear])

	return useCallback(
		(markdown: string) => {
			if (!enabled) return
			clear()
			timer.current = setTimeout(() => {
				timer.current = null
				onPersistRef.current(markdown)
			}, delayMs)
		},
		[clear, delayMs, enabled],
	)
}
