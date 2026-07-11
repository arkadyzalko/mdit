# Repository Guidelines

## Architecture & Conventions (read before implementing)
- **Web editor (`apps/web`):** read `docs/architecture/web-editor.md` before
  changing anything under `apps/web`. It defines the binding patterns — static
  SPA (no backend), in-memory state (no `@mdit/store`, no filesystem), pure
  `lib/*` logic + tests, the design-system split (generic primitives →
  `@mdit/ui`, composition → `apps/web`), the save/dirty/persistence model, the
  Tauri-free Plate kit, and how code is shared with desktop via `packages/*`.
- Point-in-time designs live in `docs/superpowers/specs/` and plans in
  `docs/superpowers/plans/`; the architecture doc above is the durable summary.

## Build, Test, and Development Commands
- Run commands from the monorepo root unless noted. Root scripts use `task:scope` names.
- `pnpm test:desktop` runs `turbo run test --filter=@mdit/desktop`.
- `pnpm test:packages` runs `turbo run test --filter='./packages/*'`.
- `pnpm test:all` runs `turbo run test`.
- `pnpm check:rust:all` runs `cargo check --workspace --manifest-path Cargo.toml --locked`.
- `pnpm test:rust:all` runs `cargo test --workspace --manifest-path Cargo.toml --locked`.
- `pnpm test:rust:core` runs `cargo test --workspace --manifest-path Cargo.toml --exclude mdit --locked`.
- `pnpm ts:check:desktop` runs `turbo run ts:check --filter=@mdit/desktop`.
- `pnpm ts:check:www` runs `turbo run ts:check --filter=@mdit/www`.
- `pnpm ts:check:all` runs `turbo run ts:check`.

- After changing TypeScript code, run `pnpm lint:fix`.
- After changing Rust code, run `cargo fmt --all --manifest-path Cargo.toml`.
