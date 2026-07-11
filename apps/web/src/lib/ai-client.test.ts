import { describe, expect, it } from "vitest"
import { UNCONFIGURED_MESSAGE, unconfiguredAiClient } from "./ai-client"

async function collect(iter: AsyncIterable<string>): Promise<string> {
	let out = ""
	for await (const chunk of iter) out += chunk
	return out
}

describe("unconfiguredAiClient", () => {
	it("yields exactly the not-configured message", async () => {
		const text = await collect(
			unconfiguredAiClient.sendMessage([{ role: "user", content: "hi" }]),
		)
		expect(text).toBe(UNCONFIGURED_MESSAGE)
		expect(text.length).toBeGreaterThan(0)
	})
})
