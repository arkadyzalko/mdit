# Web Editor Architecture & Conventions (`apps/web`)

**Audience:** any coding agent (Claude Code, Codex, etc.) or human working on the
browser editor. These are binding patterns — follow them so every change stays
consistent. This document describes the **fork's web additions**; the upstream
desktop app (`apps/desktop`) is a separate model (see "Web vs Desktop" below).

Keep this file up to date when an architectural decision changes.

## What `apps/web` is

A **browser-based, single-file-per-tab Markdown editor** built on the shared
Plate.js editor engine (`@mdit/editor`). It is a **static SPA** (TanStack Start
with `ssr: false` on the editor route) deployed to **GitHub Pages** — there is
**no server and no backend**. All state lives in the browser.

Do not introduce a server dependency into `apps/web` without an explicit
architecture decision recorded here. If a feature needs a backend (e.g. AI), the
UI must be built against a pluggable interface that can later be pointed at an
externally-hosted function; the static deploy must keep working without it.

## Core principles

1. **No filesystem, no vault.** The web editor has no notion of a workspace or
   files on disk. Documents are opened by reading dropped files into memory
   (`file.text()`), and "saving to disk" only means triggering a download.
   Do NOT reuse `@mdit/store` (the desktop vault/tab/persistence store) here —
   it models paths, `documentId`s, and filesystem persistence the web has none
   of. The web keeps its own tiny in-memory state.

2. **Reuse the shared editor, not the desktop app.** Reuse `@mdit/editor`
   (editor surface, plugin kits, markdown serializer, minimap, dnd core) and
   `@mdit/ui` (design-system primitives). Never import from `apps/desktop`.
   When desktop and web need the same non-Tauri logic, extract it into a
   package (`@mdit/editor` or `@mdit/ui`) and have both import it — see
   "Sharing code" below.

3. **Pure logic separated from React.** Domain/state transitions live in pure,
   unit-tested functions in `apps/web/src/lib/*` (e.g. `web-tabs.ts`,
   `persist-tabs.ts`, `settings.ts`). React components and hooks consume them.
   New behavior gets a pure function + a Vitest test before it gets wired into a
   component.

4. **Markdown compatibility is non-negotiable.** Saved/downloaded output must be
   plain CommonMark + GFM readable by other viewers. Always use the existing
   `@mdit/editor/markdown` serializer/deserializer; never write a new one.

## Layering (where code goes)

```
packages/ui           ← generic, logic-free design-system primitives (Button, Switch, SettingRow, ...)
packages/editor       ← shared Plate editor engine, kits, markdown, minimap, dnd core, web-kit
apps/web/src/lib      ← pure domain logic + storage (no React): web-tabs, persist-tabs, settings, storage, download, web-image, releases
apps/web/src/hooks    ← React hooks wrapping lib logic: use-settings, use-autosave
apps/web/src/components← app-specific composition (WebEditor, TabStrip, DocSidebar, SettingsPanel, DownloadMac, ...)
apps/web/src/routes   ← the route that wires state + components together (index.tsx)
```

**Design-system rule (strict):** a generic, domain-agnostic, logic-free UI
primitive belongs in `@mdit/ui` (so desktop and web share it). App-specific
composition and domain state belong in `apps/web`. Example: `SettingRow`
(label + description + control slot) is a primitive → `@mdit/ui`; the
`SettingsPanel` that composes rows for the editor's specific settings → `apps/web`.
Before adding a new primitive component in `apps/web`, check `@mdit/ui` first and
prefer adding/using it there.

## State model

- The route (`apps/web/src/routes/index.tsx`) owns tab state via
  `useState<WebTabsState>`, initialized from persisted storage:
  `loadPersistedTabsState() ?? createInitialTabsState()`.
- `WebTabsState = { tabs: WebTab[]; activeTabId: string }`. All mutations go
  through the **pure reducer functions** in `web-tabs.ts`
  (`openFileInTabs`, `newTab`, `closeTab`, `setDirty`, ...), which return new
  state (immutable — never mutate inputs).
- Each open tab renders its **own** `PlateController` + `EditorDndProvider` +
  `WebEditor`. Inactive tabs stay **mounted** but hidden with CSS (`hidden`),
  never conditionally unmounted, so each Plate editor keeps its content and undo
  history when switching tabs.
- The editor's React key is `` `${tab.id}:${tab.epoch}` ``. `epoch` is bumped by
  `web-tabs` when a tab is *reused* for a newly-dropped file, forcing a remount
  so the editor picks up the new content (Plate does not re-init on a prop change
  alone).

## Save / dirty / persistence

- **"Saved" has two independent meanings:** (a) **persisted to the browser**
  (`localStorage`) — this is what auto-save does and what clears the dirty
  marker; (b) **downloaded to disk** — the only way to get a real file out, via
  Cmd/Ctrl+S or the Download button.
- **Dirty** = the editor's current serialized markdown differs from a **baseline**
  (the content as loaded / last saved). `WebEditor` tracks the baseline in a ref
  and reports dirty via `onDirtyChange(dirty)`. Do NOT track dirty by counting
  change events — that is fragile against Plate's mount/normalization behavior.
  Whenever you add a "save" path, **reset the baseline** to the just-saved content
  (both auto-save and Download do this).
- **`WebEditor` reports live content on every change** via `onChange(markdown)`
  (undebounced). The route stores this per tab so Cmd+S always saves the current
  content, regardless of whether/when the debounced auto-save fired or whether
  auto-save is enabled. Never make Cmd+S depend solely on the debounced value.
- **Auto-save** is a debounced (`useAutosave`) persist that writes
  `localStorage` and marks the tab clean; it is configurable in Settings
  (on/off + delay). Persisted state IS the saved state, so `dirty` is not
  persisted — restored tabs load clean.
- **localStorage keys:** `mdit.web.tabs`, `mdit.web.settings`. All localStorage
  access goes through `lib/storage.ts` (SSR-safe + throw-safe JSON helpers) —
  never touch `localStorage` directly in a component.

## Plate plugin kit (the web is Tauri-free)

- Web uses `createWebEditorKit()` from `@mdit/editor/web-kit`, a browser-safe
  plugin set. Plugins that require a Tauri host on desktop are either omitted or
  given a minimal browser host/stub (link, media, slash). When adding a plugin:
  prefer the host-free kit variant; if it needs a host, add a browser host in
  `packages/editor/src/web-kit/` rather than importing desktop's.
- **SSR gotcha:** `@platejs/math` statically imports `katex`'s CSS, which breaks
  dev SSR (Node can't load `.css`). The editor route is `ssr: false` and
  `vite.config.ts` sets `ssr.noExternal: ["@platejs/math", "katex"]`. Any new
  browser-only plugin that imports package CSS may need the same treatment.

## Sharing code with desktop

- When logic is needed by both desktop and web and is **not** Tauri/store-coupled,
  extract it into `@mdit/editor` (or `@mdit/ui`) and have **both** import it.
  Precedent: the block drag-and-drop core lives in `@mdit/editor/dnd`; desktop
  re-exports those modules from its own files so its import paths stay stable and
  there is a single source of truth.
- Do the reverse-dependency check: `packages/*` must never import from `apps/*`.

## Deployment

- The web editor deploys to GitHub Pages via `.github/workflows/deploy-web.yml`
  on pushes touching `apps/web`, `packages/editor`, or `packages/ui`. It builds a
  static SPA (`spa: { enabled: true }`) with `base` = `/<repo>/` (set by
  `GH_PAGES_BASE`), and writes `index.html`/`404.html` from the prerendered shell
  for client-side routing. Keep the app buildable as a pure static SPA.
- Desktop releases (macOS `.dmg`) are produced by `.github/workflows/release.yaml`
  (Tauri, manual dispatch) and published as GitHub Releases on **this fork**
  (`arkadyzalko/mdit`). The web `DownloadMac` CTA reads those releases via the
  GitHub API (`lib/releases.ts`, pinned to the fork — never upstream).

## Web vs Desktop (do not cross the streams)

| Concern | Desktop (`apps/desktop`) | Web (`apps/web`) |
| --- | --- | --- |
| Runtime | Tauri (Rust + webview) | Static SPA on GitHub Pages |
| Storage | Filesystem vault + `@mdit/store` | In-memory + `localStorage` |
| Tabs | Store slices, `documentId`, history | Pure `web-tabs.ts`, in-memory |
| Open a doc | Filesystem paths | Drop file → read into memory |
| Save | Write to disk | Persist to `localStorage`; download to export |
| Plugin hosts | Tauri hosts | Browser stubs / host-free kits |

Never import `apps/desktop` code into `apps/web` (or vice versa). Shared code
goes through `packages/*`.

## Verification expectations

- Pure `lib/*` logic: Vitest unit tests (jsdom env when they touch `localStorage`
  or the DOM, via `// @vitest-environment jsdom`).
- Behavior that only shows up in the running editor (Plate keystrokes, dnd,
  auto-save timing): verify by running the dev server and driving the browser,
  because synthetic keystroke/pointer events do not reliably exercise Plate /
  `@dnd-kit/react` in a headless harness.
- Before finishing: `pnpm lint`, `pnpm --filter @mdit/web ts:check`,
  `pnpm --filter @mdit/web test` must all pass. Style is Biome (tabs, double
  quotes, semicolons `asNeeded`).
