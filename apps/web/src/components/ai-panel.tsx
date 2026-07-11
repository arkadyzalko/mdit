import { Button } from "@mdit/ui/components/button"
import { Textarea } from "@mdit/ui/components/textarea"
import { cn } from "@mdit/ui/lib/utils"
import { ArrowUpIcon, PlusIcon, XIcon } from "lucide-react"
import { type KeyboardEvent, useState } from "react"
import { useAiClient } from "../hooks/use-ai-client"
import { useChat } from "../hooks/use-chat"

const SUGGESTIONS = [
	"Summarize this document",
	"Improve the writing",
	"Fix grammar and spelling",
]

export function AiPanel({ onClose }: { onClose: () => void }) {
	const client = useAiClient()
	const { messages, isStreaming, send, reset } = useChat(client)
	const [input, setInput] = useState("")

	const submit = (text: string) => {
		if (!text.trim() || isStreaming) return
		send(text)
		setInput("")
	}

	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			submit(input)
		}
	}

	return (
		<div className="flex h-full w-[340px] shrink-0 flex-col rounded-xl border border-border bg-muted/30">
			<div className="flex items-center justify-between border-border border-b px-3 py-2">
				<span className="font-medium text-foreground text-sm">New Chat</span>
				<div className="flex items-center gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="New chat"
						onClick={reset}
					>
						<PlusIcon className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Close AI chat"
						onClick={onClose}
					>
						<XIcon className="size-4" />
					</Button>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
				{messages.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<p className="font-medium text-foreground">
							How can I help you today?
						</p>
						<div className="flex flex-col gap-2">
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => submit(s)}
									className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
								>
									{s}
								</button>
							))}
						</div>
					</div>
				) : (
					messages.map((m, i) => (
						<div
							key={`${m.role}-${i}`}
							className={cn(
								"max-w-[85%] rounded-lg px-3 py-2 text-sm",
								m.role === "user"
									? "self-end bg-primary text-primary-foreground"
									: "self-start bg-muted text-foreground",
							)}
						>
							{m.content || (isStreaming ? "…" : "")}
						</div>
					))
				)}
			</div>

			<div className="border-border border-t p-2">
				<div className="flex items-end gap-2">
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Ask…"
						rows={1}
						className="max-h-32 min-h-9 flex-1 resize-none"
					/>
					<Button
						type="button"
						size="icon"
						aria-label="Send message"
						disabled={!input.trim() || isStreaming}
						onClick={() => submit(input)}
					>
						<ArrowUpIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}
