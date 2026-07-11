# Web AI Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side AI chat panel to the web editor, built against a pluggable `AiClient` interface whose shipped default is a no-network "not configured" stub. No backend.

**Architecture:** A pure `AiClient` contract + stub in `lib/`; a context provider; a `useChat` hook that streams an async-iterable reply into a growing assistant message; a presentational panel composed from `@mdit/ui` primitives; wired into the route as a toggleable right column.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Start (`ssr:false` route), Tailwind v4, `@mdit/ui` (Button, Textarea), lucide-react, Vitest.

## Global Constraints

- **Web-only.** Touch only `apps/web/**`. No backend, no network calls, no API keys. Do not modify `packages/*` or `apps/desktop`.
- **No real model.** The only shipped client is the stub. The contract is the seam for a future backend.
- **Lint/format:** Biome — tabs, double quotes, semicolons `asNeeded`. **TS strict.**
- **Reuse `@mdit/ui`** (`@mdit/ui/components/button`, `@mdit/ui/components/textarea`); don't re-implement primitives.
- **Commits:** conventional (`feat:`, `test:`).
- **Dev:** `pnpm --filter @mdit/web dev` (3100); no macOS `timeout` (poll with curl); hard-reload browser (`?v=N`) after package changes.
- Tests touching DOM use `// @vitest-environment jsdom`.

## Key facts (reference)

- Route `apps/web/src/routes/index.tsx`: `ssr:false`; layout is `<div flex h-screen gap-2 bg-background p-2>` → `<DocSidebar/>` + `<div flex-1 flex-col rounded-xl border>` containing `<TabStrip actions={...}/>` then the editor stack. `TabStrip` has an `actions?: ReactNode` slot (right cluster) already holding `<DownloadButton/>` + `<SettingsButton/>`.
- `@mdit/ui/components/button` → `Button` (`variant`, `size` incl. `"ghost"`/`"icon"`). `@mdit/ui/components/textarea` → `Textarea`. `cn` from `@mdit/ui/lib/utils`.
- `lucide-react` is a dep of `apps/web` (icons: `SparklesIcon`, `SendIcon`/`ArrowUpIcon`, `XIcon`, `PlusIcon`).
- Existing button wrappers to mirror: `apps/web/src/components/settings-button.tsx` (ghost/icon Button + aria-label).

## File structure

**New (`apps/web/src`):** `lib/ai-client.ts`, `lib/ai-client.test.ts`, `hooks/use-ai-client.tsx`, `hooks/use-chat.ts`, `hooks/use-chat.test.ts`, `components/ai-panel.tsx`, `components/ai-panel-toggle.tsx`
**Modified:** `apps/web/src/routes/index.tsx`

---

## Task 1: `AiClient` contract + stub

**Files:** Create `apps/web/src/lib/ai-client.ts`, `apps/web/src/lib/ai-client.test.ts`

**Interfaces — Produces:**
```ts
export type AiMessage = { role: "user" | "assistant"; content: string }
export type AiClient = {
  sendMessage(messages: AiMessage[], signal?: AbortSignal): AsyncIterable<string>
}
export const UNCONFIGURED_MESSAGE: string
export const unconfiguredAiClient: AiClient
```

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/ai-client.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @mdit/web test -- ai-client`
Expected: FAIL ("Cannot find module './ai-client'").

- [ ] **Step 3: Implement**

`apps/web/src/lib/ai-client.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @mdit/web test -- ai-client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ai-client.ts apps/web/src/lib/ai-client.test.ts
git commit -m "feat(web): AiClient contract + unconfigured stub"
```

---

## Task 2: `useChat` hook

**Files:** Create `apps/web/src/hooks/use-chat.ts`, `apps/web/src/hooks/use-chat.test.ts`

**Interfaces:**
- Consumes: `AiClient`, `AiMessage` (`../lib/ai-client`).
- Produces:
  ```ts
  export type ChatState = {
    messages: AiMessage[]
    isStreaming: boolean
    send: (text: string) => void
    stop: () => void
    reset: () => void
  }
  export function useChat(client: AiClient): ChatState
  ```
  `send(text)`: ignores empty/whitespace; appends a user message + an empty assistant message, sets `isStreaming`, consumes `client.sendMessage([...priorMessages, user], signal)` appending each chunk to the assistant message; clears `isStreaming` when done. `stop()`: aborts the in-flight request. `reset()`: clears messages and aborts.

- [ ] **Step 1: Write the failing test**

`apps/web/src/hooks/use-chat.test.ts`:
```ts
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
```

- [ ] **Step 2: Ensure the test dep exists**

Run:
```bash
node -e "require.resolve('@testing-library/react',{paths:['apps/web']})" 2>/dev/null && echo OK || echo MISSING
```
If `MISSING`, add `"@testing-library/react": "^16.1.0"` to `apps/web` devDependencies and `pnpm install`. (It's needed for `renderHook`.)

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @mdit/web test -- use-chat`
Expected: FAIL ("Cannot find module './use-chat'").

- [ ] **Step 4: Implement**

`apps/web/src/hooks/use-chat.ts`:
```ts
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

			const history: AiMessage[] = [
				...messages,
				{ role: "user", content },
			]
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
					abortRef.current = null
					setIsStreaming(false)
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @mdit/web test -- use-chat`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-chat.ts apps/web/src/hooks/use-chat.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): useChat hook (streaming, abort, reset)"
```

---

## Task 3: AI client context provider

**Files:** Create `apps/web/src/hooks/use-ai-client.tsx`

**Interfaces — Produces:**
```ts
export function AiClientProvider(props: { client?: AiClient; children: ReactNode }): JSX.Element
export function useAiClient(): AiClient
```
Default context value = `unconfiguredAiClient`.

- [ ] **Step 1: Implement**

`apps/web/src/hooks/use-ai-client.tsx`:
```tsx
import { createContext, type ReactNode, useContext } from "react"
import { type AiClient, unconfiguredAiClient } from "../lib/ai-client"

const AiClientContext = createContext<AiClient>(unconfiguredAiClient)

export function AiClientProvider({
	client = unconfiguredAiClient,
	children,
}: {
	client?: AiClient
	children: ReactNode
}) {
	return (
		<AiClientContext.Provider value={client}>
			{children}
		</AiClientContext.Provider>
	)
}

export function useAiClient(): AiClient {
	return useContext(AiClientContext)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-ai-client.tsx
git commit -m "feat(web): AiClient context provider"
```

---

## Task 4: AI panel + toggle components

**Files:** Create `apps/web/src/components/ai-panel.tsx`, `apps/web/src/components/ai-panel-toggle.tsx`

**Interfaces:**
- Consumes: `useChat` (`../hooks/use-chat`), `useAiClient` (`../hooks/use-ai-client`), `Button` (`@mdit/ui/components/button`), `Textarea` (`@mdit/ui/components/textarea`), `cn` (`@mdit/ui/lib/utils`).
- Produces:
  ```ts
  export function AiPanel(props: { onClose: () => void }): JSX.Element
  export function AiPanelToggle(props: { active: boolean; onClick: () => void }): JSX.Element
  ```

- [ ] **Step 1: Toggle button**

`apps/web/src/components/ai-panel-toggle.tsx`:
```tsx
import { Button } from "@mdit/ui/components/button"
import { SparklesIcon } from "lucide-react"

export function AiPanelToggle({
	active,
	onClick,
}: {
	active: boolean
	onClick: () => void
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Toggle AI chat"
			aria-pressed={active}
			onClick={onClick}
		>
			<SparklesIcon className="size-4" />
		</Button>
	)
}
```

- [ ] **Step 2: Panel**

`apps/web/src/components/ai-panel.tsx`:
```tsx
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
```
Note: verify `Textarea` accepts `value`/`onChange`/`onKeyDown`/`rows`/`placeholder`/`className` against `packages/ui/src/components/textarea.tsx` (it wraps a native textarea, so it should). Adjust if the prop passthrough differs.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @mdit/web ts:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ai-panel.tsx apps/web/src/components/ai-panel-toggle.tsx
git commit -m "feat(web): AI panel + toggle UI"
```

---

## Task 5: Wire into the route

**Files:** Modify `apps/web/src/routes/index.tsx`

- [ ] **Step 1: Imports + state**

Add imports:
```ts
import { AiPanel } from "../components/ai-panel"
import { AiPanelToggle } from "../components/ai-panel-toggle"
import { AiClientProvider } from "../hooks/use-ai-client"
```
Inside `Home`, add: `const [showAi, setShowAi] = useState(false)`.

- [ ] **Step 2: Add the toggle to the tab bar actions**

In the `<TabStrip actions={...}>` slot, add the toggle before/after the existing buttons:
```tsx
actions={
	<>
		<DownloadButton onClick={downloadActiveTab} />
		<AiPanelToggle active={showAi} onClick={() => setShowAi((v) => !v)} />
		<SettingsButton onClick={() => setShowSettings(true)} />
	</>
}
```

- [ ] **Step 3: Render the panel in a right column + wrap in provider**

Wrap the whole returned tree in `<AiClientProvider>` (default stub). Add the panel as a sibling of the editor column, inside the top-level flex row, so the editor column shrinks when it's shown:
```tsx
return (
	<AiClientProvider>
		<div className="flex h-screen w-full gap-2 bg-background p-2">
			<DocSidebar ... />
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
				<TabStrip ... />
				<div className="relative min-h-0 flex-1" ...>
					{/* editor stack unchanged */}
				</div>
			</div>
			{showAi ? <AiPanel onClose={() => setShowAi(false)} /> : null}
			{showSettings ? <SettingsPanel ... /> : null}
		</div>
	</AiClientProvider>
)
```
Keep all existing children (DocSidebar, TabStrip, editor stack, SettingsPanel) exactly as-is; only add the `AiClientProvider` wrapper, the `AiPanelToggle` in actions, and the `{showAi ? <AiPanel/> : null}` sibling.

- [ ] **Step 4: Typecheck + tests**

Run: `pnpm --filter @mdit/web ts:check && pnpm --filter @mdit/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/index.tsx
git commit -m "feat(web): mount AI panel (toggle + right column)"
```

---

## Task 6: Manual browser verification

- [ ] **Step 1:** `pnpm --filter @mdit/web dev`; open `http://localhost:3100/?v=1`.
- [ ] **Step 2: Verify:**
  1. A sparkles button appears in the top-right action cluster; clicking it opens the right-side panel and the editor area shrinks; clicking again closes it.
  2. Empty state shows "How can I help you today?" + 3 chips.
  3. Clicking a chip sends that prompt; the user bubble appears and the assistant replies with the "not configured" message (stub).
  4. Typing in "Ask…" + Enter sends; Shift+Enter inserts a newline; send button disabled while empty.
  5. "New Chat" (＋) clears the thread back to the empty state.
  6. Console shows only the benign theme hydration warning; no network requests to any AI endpoint (Network tab empty of external calls).
- [ ] **Step 3:** Stop the dev server.

---

## Task 7: Full checks

- [ ] **Step 1:** `pnpm lint` (fix with `pnpm lint:fix`) → PASS.
- [ ] **Step 2:** `pnpm --filter @mdit/web ts:check` → PASS.
- [ ] **Step 3:** `pnpm --filter @mdit/web test` → PASS.
- [ ] **Step 4:** Commit any lint fixes.

---

## Self-Review notes

- **Spec coverage:** pluggable `AiClient` + stub (Task 1), context (Task 3), streaming chat state with abort/reset (Task 2), panel UI with greeting/chips/thread/input + Enter/Shift-Enter/disabled (Task 4), toggle in tab-bar actions + right-column reflow + provider wrap (Task 5). No-network guaranteed (stub only; verified in Task 6 step 6). In-memory only, no persistence/history (non-goal respected). Design-system reuse (Button/Textarea) — panel composition stays in `apps/web`.
- **Placeholder scan:** none — full code in each step. The `@testing-library/react` dep check (Task 2 step 2) and `Textarea` prop check (Task 4 note) are real verification points, not placeholders.
- **Type consistency:** `AiClient`/`AiMessage` (Task 1) used by `useChat` (Task 2), `useAiClient` (Task 3), and `AiPanel` (Task 4). `useChat` return shape matches its use in the panel. `AiPanel`/`AiPanelToggle` props match the route callsite (Task 5).
- **Ordering:** contract → hook → provider → components → route → verify. Task 2 needs `@testing-library/react`; guard added.
