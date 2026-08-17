# Project Constitution

Version: 1.0.0
Last updated: 2026-08-17

## Architecture Principles

- Shared contracts first: types and Zod schemas live in `@linvo/shared`; desktop consumes them, does not fork shapes.
- Multi-window Tauri: `main` (auth/floating), `panel` (chat/settings), optional `checklist`; React orchestrates, Rust owns window primitives.
- Prefer extending existing floating / chat / capture pipelines over new parallel stacks.
- Specs and contracts constrain implementation; do not invent API endpoints the backend does not already expose.

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Monorepo | pnpm workspaces | `apps/desktop`, `packages/shared` |
| UI | React 19 + Vite + Tailwind | HashRouter in panel window |
| Desktop shell | Tauri v2 | Plugins: tray, shortcut, clipboard, notification |
| Contracts | Zod in `@linvo/shared` | Canonical API shapes |
| Chat transport | REST + SSE | `VITE_API_URL` |
| Tests | Vitest | Co-located `*.test.ts(x)` |

## Security Constraints

- Authentication: authenticated floating/panel surfaces require a valid session JWT; never log tokens.
- Input validation: external/API payloads validated with Zod at boundaries (`@linvo/shared` or local parsers).
- Secrets: no hardcoded API keys; BYO keys only via existing settings/keychain paths.
- Capture/clipboard: treat display media and clipboard as sensitive; upload only after explicit user confirm when a preview/crop step exists.
- CSP and opener: do not weaken Tauri security for convenience without an explicit decision.

## Naming Conventions

- Files: kebab-case (`use-quick-prompt.ts`)
- Variables/functions: camelCase
- Types/interfaces: PascalCase
- Shared schema fields: follow existing API snake/camel as defined in `@linvo/shared`

## Banned Patterns

- No comments in code unless the human explicitly asks
- No `any` in new TypeScript
- No duplicate capture/chat stacks when an existing module already covers the path
- No Material-style FAB parallel to FloatingBar
- No new markdown docs outside `specs/` / approved product docs for a feature
- No commit unless the human asks

## File Structure Rules

```
apps/desktop/src/
  components/     # UI by domain (floating, chat, quick-center, panel)
  hooks/          # React hooks
  lib/            # Pure logic, APIs, window helpers
  pages/          # Panel routes
  context/        # Providers
packages/shared/src/  # Zod contracts
specs/            # SDD artifacts per feature branch
```

## Open Questions / Deferred Decisions

- None for floating capture → Quick Center (reuse existing attachment upload + SSE).
