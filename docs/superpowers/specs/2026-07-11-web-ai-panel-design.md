# Web Editor — AI Panel (UI only, pluggable backend) Design

**Date:** 2026-07-11
**Status:** Approved, ready for implementation plan
**Sub-project 3 of 3** (after save/settings, visual redesign)

## Goal

Add a right-side AI chat panel to the web editor, matching the reference
(greeting, suggested action chips, a chat thread, and an "Ask…" input). It is
**UI only against a pluggable client** — there is no backend. The static SPA
must keep working; a real model is wired later by injecting a different client
implementation.

## Non-negotiable constraint

The web editor is a static SPA on GitHub Pages with **no server**. An API key
must never ship in the client. So this sub-project builds the panel against a
`AiClient` interface; the shipped default is a stub that returns a short
"not configured" message. No network calls are added.

## Pluggable client contract

```ts
type AiMessage = { role: "user" | "assistant"; content: string }

type AiClient = {
  // Streams the assistant reply as text chunks. Implementations may yield the
  // whole reply as a single chunk. `signal` aborts an in-flight request.
  sendMessage(
    messages: AiMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<string>
}
```

- A React context (`AiClientProvider`) supplies the active client;
  `useAiClient()` reads it. Default value = `unconfiguredAiClient`.
- `unconfiguredAiClient` yields one chunk: a friendly message explaining the AI
  isn't configured and how to enable it (connect a serverless function or use
  your own API key). No fetch, no key.
- Swapping in a real client later = wrap the app (or the panel) in
  `<AiClientProvider client={realClient}>`. Nothing else changes.

## Behavior

- **Toggle:** a button (sparkles icon) in the tab bar's action cluster
  toggles the panel. When open, the panel occupies a fixed-width right column
  (~340px) and the editor area shrinks; when closed, it's removed.
- **Empty state:** greeting ("How can I help you today?") + 3 suggested action
  chips (e.g. "Summarize", "Improve writing", "Fix grammar"). Clicking a chip
  fills the input with a prefilled prompt and sends it. Chips are generic
  prompts — no editor-content integration in this sub-project (YAGNI).
- **Thread:** user and assistant messages as bubbles. While the assistant is
  responding, chunks append live (streaming); a "thinking" indicator shows
  until the first chunk. An in-flight request can be stopped (abort).
- **Input:** a `Textarea` ("Ask…") + send button. Enter sends, Shift+Enter
  inserts a newline. Empty/whitespace messages are ignored. Input is disabled
  while a response streams.
- **Conversation is in-memory** for the session (not persisted). "New Chat"
  clears the thread. History browsing is out of scope (YAGNI).

## Design-system split

Reuse `@mdit/ui` primitives: `Button`, `Textarea`. The panel composition and
chat state are web-app-specific (they depend on the `AiClient` contract), so
they live in `apps/web`. If a message-bubble or chip proves reusable later it
can move to `@mdit/ui`, but not now (single consumer).

## Architecture & files

**New in `apps/web/src`:**
- `lib/ai-client.ts` — `AiMessage`, `AiClient` types + `unconfiguredAiClient`
  stub. Pure, unit-tested.
- `lib/ai-client.test.ts` — the stub yields exactly one "not configured" chunk.
- `hooks/use-ai-client.tsx` — `AiClientProvider` + `useAiClient()` context.
- `hooks/use-chat.ts` — chat state over an `AiClient`: `messages`, `isStreaming`,
  `send(text)`, `stop()`, `reset()`. Appends the user message, consumes the
  client's async-iterable reply into a growing assistant message, supports
  abort.
- `hooks/use-chat.test.ts` — with a fake streaming client: `send` adds the user
  message, assembles the streamed assistant reply, toggles `isStreaming`;
  `reset` clears; whitespace-only `send` is a no-op.
- `components/ai-panel.tsx` — the panel UI (header with "New Chat" + close,
  empty state with chips, message list, input). Composes primitives + `useChat`.
- `components/ai-panel-toggle.tsx` — the sparkles toggle button for the tab bar.

**Modified:**
- `apps/web/src/routes/index.tsx` — `showAi` state; render `AiPanelToggle` in the
  tab bar `actions`; render `AiPanel` in a right column when open (editor
  shrinks); wrap the app in `AiClientProvider` (default stub).

## Testing

- Unit: `ai-client` stub output; `use-chat` send/stream/reset/abort/no-op with a
  fake client.
- Manual (browser): toggle opens/closes the panel and the editor reflows; empty
  state shows chips; clicking a chip sends a prompt and the stub replies with the
  "not configured" message; typing + Enter sends, Shift+Enter newlines; "New
  Chat" clears; console clean.

## Non-goals (YAGNI)

- No real model / network / API key handling (that's the later "wire a backend"
  step — the contract is the seam).
- No conversation persistence or history list.
- No editor-content actions (selection → AI); chips are plain prompts for now.
- No attachments/file upload in the input.

## Verification note

Streaming and keyboard behavior are covered by unit tests (fake client); the
panel layout/reflow and chip→send flow are verified by driving the browser,
consistent with prior web work.
