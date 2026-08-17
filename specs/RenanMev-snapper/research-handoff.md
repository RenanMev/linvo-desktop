# Research addendum: QC → panel chat handoff

Date: 2026-08-17
Baseline: `specs/RenanMev-snapper/research.md` (capture already shipped)

## What exists

| Path | Passes | Loses |
|------|--------|-------|
| Abrir no chat | `openPanel(/chat/:id, user)` only | `inputValue`, pending capture, prompt local state |
| Abrir no painel | `openPanel(/chat, user)` only | same |

Cite: `quick-center-panel.tsx:303-318`. Cross-window today: `panel://navigate` + `panel://session` only (`panel-window.ts`, `panel-session-sync.ts`). No draft/attachment bus.

On QC unmount: `prompt.reset()` (`:321-329`); capture hook revokes pending/draft (`use-display-snapshot.ts:261-272`); `inputValue` is local state (`:94`).

Panel composer: fresh `useState("")` + `useDisplaySnapshot({ windowLabel: "panel" })` (`chat-input.tsx:73,100`).

## Implication

Continuity of **already-sent** messages works via `conversationId` + API. Continuity of **unsent composer state** does not exist.
