# Mdit fork — Web editor + side minimap

**Date:** 2026-07-09
**Status:** Approved design, ready for implementation planning
**Strategy:** Fork of [hjinco/mdit](https://github.com/hjinco/mdit) (Apache 2.0), adding features — not rebuilding.

## Summary

We are building on top of `hjinco/mdit`, an existing, mature, actively-maintained
Notion-style Markdown editor ("Notion UX + Obsidian file ownership"). It already
implements ~90% of the original goal: a Tauri + React desktop app with a WYSIWYG
block editor over plain local `.md` files.

Rather than rebuild, we **fork and add**. We keep everything (AI, graph view,
backlinks, git-sync, vault indexing) and add two things it lacks:

1. **A web editor** — the same editing experience running in the browser on a single
   dropped `.md` file, then downloaded back.
2. **A side minimap** — a fixed vertical strip of heading ticks on the right edge of
   the editor, with a floating overlay of clickable titles on hover.

## Fork setup

- **origin**: `github.com/arkadyzalko/mdit` (our fork)
- **upstream**: `github.com/hjinco/mdit` (original, to pull future updates)
- Working dir: `~/Projects/mdit`
- License: Apache 2.0 — retain notices; our additions inherit the license.

## What the upstream already provides (kept as-is)

| Area | Upstream implementation |
|---|---|
| Desktop | Tauri v2, macOS (Windows/mobile on their roadmap) |
| UI | React 19 + TypeScript + Vite, monorepo (pnpm + turbo) |
| Editor engine | **Plate.js** (`platejs` v53) — NOT Tiptap |
| Markdown | remark-gfm + frontmatter; Obsidian-style callouts, wiki-links |
| Images | WebP (Rust crate `image` + `webp`) |
| Editing UX | Inline WYSIWYG, slash `/` menu, drag handles (@dnd-kit), floating toolbar (@platejs/floating), tables, math (KaTeX), emoji, dates |
| Files | Folder sidebar (`packages/file-tree`), tabs (`packages/store`), search, light/dark themes (`next-themes`) |
| Beyond original scope | Backlinks + graph view (`packages/graph-view`, d3-force), AI (`packages/ai`, `packages/chat`, own API keys / Ollama), git-sync (`packages/git-sync`), vault indexing (Rust crates) |

Relevant packages/crates:
- `packages/editor` — the Plate-based editor (exports per feature: basic, code, table, media, slash, toc, markdown, …)
- `apps/desktop` — the Tauri desktop app
- `apps/www` — **marketing site only** (TanStack Start on Cloudflare); it has NO editor today
- `packages/store` — app state (tabs, workspace, watch)
- `packages/file-tree`, `packages/command-menu`, `packages/ui`

Note on their TOC: `packages/editor/src/toc` is a **block-level table-of-contents**
(a `/table of contents` block inside the document, via `@platejs/toc`). It is NOT the
side minimap we are adding — the two coexist.

## Code quality assessment (why forking is safe)

- **Tests**: 108 TS/TSX test files over 573 sources (~19%); 36 of 56 Rust files have
  tests (64%), concentrated in the critical core (markdown, tabs, git-sync, indexing).
- **TS strictness**: `strict`, `strictNullChecks`, `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- **Tooling**: Biome (lint+format), Husky pre-commit, CI (`pr-checks`, `release`).
- **Architecture**: "ports" dependency-injection pattern separates pure logic from I/O
  (e.g. `GitPorts`), so core logic is testable without disk/git. Features are isolated
  packages with testable cores.
- **File sizes**: mostly small and focused; largest real source file ~1,455 lines.

Verdict: mature engineering, safe to fork and extend.

## Addition 1 — Web editor (single-file)

**Scope:** the web version opens ONE dropped/picked `.md`, edits it with the full Plate
experience, and downloads it back. No sidebar, no vault, no backlinks/graph/git-sync
on web (those depend on a local folder). Architecture left open to add a folder mode
(File System Access API) later without rewriting.

**Approach:**
- Reuse `packages/editor` (the Plate editor) — it must be usable outside Tauri.
- Introduce a platform-agnostic file access seam so the editor does not call Tauri APIs
  directly. Desktop keeps its Tauri-backed implementation; web gets a browser one.
  - `readFile`: from the dropped `File` → text.
  - `writeFile`: trigger a browser download of the edited Markdown.
  - Folder/watch operations: declared unsupported on web (UI hides sidebar).
- **Images on web**: paste/drop → convert to **WebP** in-browser (`<canvas>`
  `toBlob('image/webp', quality)`) → base64 → embed inline
  `![](data:image/webp;base64,...)`, so the file stays self-contained.
  (Desktop keeps `assets/*.webp` relative paths.)
  - Compatibility note: WebP data URIs render in browsers and most modern viewers
    (GitHub, VS Code, Obsidian); very old viewers may not. Acceptable trade-off.
- **Hosting:** the web editor lives in the web app. Decide during planning whether it
  becomes a new route in `apps/www` or a separate `apps/web` (keeping `www` purely
  marketing). Leaning toward a dedicated editor route/app to avoid coupling with the
  marketing site.

**Landing (web):** a drop-zone ("drop a `.md` or click to choose"). After opening:
editor + side minimap + a **Download** button. One file per session (no tabs on web).

## Addition 2 — Side minimap (heading ticks)

Reproduces the reference screenshots. Distinct from the existing block-level TOC.

- **Collapsed**: a narrow fixed-width vertical strip at the right edge of the editor,
  **one tick per heading**. Tick width/indent reflects level (H1 widest, deeper =
  shorter/indented). The current section's tick is highlighted.
- **Hover**: a floating **overlay** popover appears **on top of the document content**,
  anchored right — it does NOT widen the strip or push content. Shows real heading
  titles in a hierarchical tree, clickable to jump to a section. Hides on mouse leave.
- **Scroll-sync**: scrolling the document moves the highlight; clicking a title scrolls
  the document to it.
- **Where**: **both desktop and web, always visible.** It is an editor feature, so it
  appears wherever the editor appears.
- **Data source**: derived from the editor's heading nodes (level + position), updating
  automatically on edit. No persistence — pure view. Reuse Plate's heading/TOC state
  primitives where possible (`@platejs/toc` exposes a heading list).

## Non-goals for this iteration

- Removing or trimming any upstream feature (explicitly: we keep AI, graph, git-sync).
- Web folder/vault mode, web backlinks/graph, web tabs (architecture stays open to
  them, but not built now).
- Windows/mobile builds (upstream roadmap, not ours here).

## Open items to resolve during planning

- Exact seam for platform file access: does upstream already abstract Tauri file calls
  in `packages/store` / `packages/local-fs-origin`, or must we introduce the seam? This
  determines how much of `packages/editor` is already browser-safe.
- Web app placement: new route in `apps/www` vs. new `apps/web`.
- Whether the side minimap can reuse `@platejs/toc` heading-list state or needs its own
  heading extraction.
