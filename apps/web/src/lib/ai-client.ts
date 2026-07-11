export type AiMessage = { role: "user" | "assistant"; content: string }

export type AiClient = {
	// Streams the assistant reply as text chunks. `signal` aborts a request.
	sendMessage(
		messages: AiMessage[],
		signal?: AbortSignal,
	): AsyncIterable<string>
}

export const UNCONFIGURED_MESSAGE =
	"AI isn't configured yet. Connect a backend — a serverless function that holds the API key, or your own key — to enable chat."

// Default client used when no real backend is wired. Makes no network calls.
export const unconfiguredAiClient: AiClient = {
	async *sendMessage() {
		yield UNCONFIGURED_MESSAGE
	},
}
