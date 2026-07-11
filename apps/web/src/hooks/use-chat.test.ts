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

	it("keeps the new request tracked after reset-then-send (no controller clobber)", async () => {
		// A client whose stream is gated so we can interleave reset + send while
		// the first request is still 'in flight'.
		let releaseFirst: () => void = () => {}
		const firstGate = new Promise<void>((r) => {
			releaseFirst = r
		})
		let call = 0
		const gatedClient: AiClient = {
			async *sendMessage(_messages, signal) {
				call += 1
				if (call === 1) {
					await firstGate // block the first request until released
					if (signal?.aborted) return
					yield "late-first"
				} else {
					yield "second-ok"
				}
			},
		}

		const { result } = renderHook(() => useChat(gatedClient))
		act(() => result.current.send("one")) // first request starts, blocked
		expect(result.current.isStreaming).toBe(true)

		act(() => result.current.reset()) // abort first, clear
		act(() => result.current.send("two")) // second request starts immediately

		// Let the first (aborted) request's finally run now.
		await act(async () => {
			releaseFirst()
			await Promise.resolve()
		})

		// The second request must complete normally — its controller wasn't
		// clobbered by the first request's finally.
		await waitFor(() => expect(result.current.isStreaming).toBe(false))
		expect(result.current.messages).toEqual([
			{ role: "user", content: "two" },
			{ role: "assistant", content: "second-ok" },
		])
	})
})
