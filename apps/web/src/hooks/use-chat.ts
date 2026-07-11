import { useCallback, useRef, useState } from "react"
import type { AiClient, AiMessage } from "../lib/ai-client"

export type ChatState = {
	messages: AiMessage[]
	isStreaming: boolean
	send: (text: string) => void
	stop: () => void
	reset: () => void
}

export function useChat(client: AiClient): ChatState {
	const [messages, setMessages] = useState<AiMessage[]>([])
	const [isStreaming, setIsStreaming] = useState(false)
	const abortRef = useRef<AbortController | null>(null)

	const send = useCallback(
		(text: string) => {
			const content = text.trim()
			if (!content || abortRef.current) return

			const history: AiMessage[] = [...messages, { role: "user", content }]
			// user message + empty assistant placeholder to stream into
			setMessages([...history, { role: "assistant", content: "" }])
			setIsStreaming(true)

			const controller = new AbortController()
			abortRef.current = controller
			;(async () => {
				try {
					for await (const chunk of client.sendMessage(
						history,
						controller.signal,
					)) {
						setMessages((prev) => {
							const next = prev.slice()
							const last = next[next.length - 1]
							if (last && last.role === "assistant") {
								next[next.length - 1] = {
									...last,
									content: last.content + chunk,
								}
							}
							return next
						})
					}
				} catch {
					// aborted or client error: leave whatever streamed so far
				} finally {
					// Only clear if this request is still the active one. A
					// stop()/reset() immediately followed by a new send() installs
					// a new controller; without this identity check, this aborted
					// request's finally would wipe the new controller, leaving the
					// new stream unstoppable and the re-entrancy guard defeated.
					if (abortRef.current === controller) {
						abortRef.current = null
						setIsStreaming(false)
					}
				}
			})()
		},
		[client, messages],
	)

	const stop = useCallback(() => {
		abortRef.current?.abort()
		abortRef.current = null
		setIsStreaming(false)
	}, [])

	const reset = useCallback(() => {
		abortRef.current?.abort()
		abortRef.current = null
		setMessages([])
		setIsStreaming(false)
	}, [])

	return { messages, isStreaming, send, stop, reset }
}
