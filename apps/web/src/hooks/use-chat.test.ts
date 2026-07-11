// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { AiClient } from "../lib/ai-client"
import { useChat } from "./use-chat"

const fakeClient: AiClient = {
	async *sendMessage() {
		yield "Hello"
		yield ", "
		yield "world"
	},
}

describe("useChat", () => {
	it("appends the user message and assembles the streamed reply", async () => {
		const { result } = renderHook(() => useChat(fakeClient))
		act(() => result.current.send("hi"))
		await waitFor(() => expect(result.current.isStreaming).toBe(false))
		expect(result.current.messages).toEqual([
			{ role: "user", content: "hi" },
			{ role: "assistant", content: "Hello, world" },
		])
	})

	it("ignores whitespace-only input", () => {
		const { result } = renderHook(() => useChat(fakeClient))
		act(() => result.current.send("   "))
		expect(result.current.messages).toHaveLength(0)
	})

	it("reset clears the conversation", async () => {
		const { result } = renderHook(() => useChat(fakeClient))
		act(() => result.current.send("hi"))
		await waitFor(() => expect(result.current.isStreaming).toBe(false))
		act(() => result.current.reset())
		expect(result.current.messages).toHaveLength(0)
	})
})
