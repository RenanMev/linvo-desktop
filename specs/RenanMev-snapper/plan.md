# Plan: QC → Panel composer handoff

Status: Draft
Version: 1.0
Last updated: 2026-08-17

## Approach

One-shot cross-window handoff via Tauri event `panel://chat-handoff`, mirroring `panel://session`.

1. Before `openPanel`, Quick Center builds a serializable payload: `{ conversationId, draftText, attachment? }`.
2. Attachment (if pending ready) is encoded as base64 + mime + filename + width/height + sourceLabel.
3. Panel listens (ChatPage or small provider): buffers until `ChatInput` can consume; applies once.
4. `useDisplaySnapshot` gains `hydratePending(...)` to install a ready pending without recapture.
5. `ChatInput` accepts optional external draft apply API (callback ref / props effect) for text + hydrate.

## Components

| Piece | Change | ACs |
|-------|--------|-----|
| `lib/chat/chat-handoff.ts` | types, encode/decode, emit, listen, memory buffer | AC-1..5, E1, E2 |
| `quick-center-panel.tsx` | emit before openPanel on both open actions | AC-1,2,3,4,6,7 |
| `use-display-snapshot.ts` | `hydratePending` | AC-2, E2 |
| `chat-input.tsx` | apply handoff text + hydrate; consume once | AC-1,2,5, E2 |
| `chat-page.tsx` or `PanelApp` | subscribe listen + pass handoff into chat tree | AC-3, E1 |
| tests | unit encode/decode; QC emit; ChatInput apply | AC-1..5, E2 |

## Risks

| Risk | Mitigation |
|------|------------|
| Large base64 on event bus | Cap using existing snapshot max (5MB); on failure apply text only (AC-E2) |
| Race panel boot | Module-level buffer + flush on listen (AC-E1), TTL 2s |
| Double apply | Consume flag / clear buffer on apply (AC-5) |

## Out of plan
- Rust temp-file bridge (defer unless base64 fails in practice)
- Changing capture auto-send from bar

## AC coverage
All [MUST] ACs map to rows above. [SHOULD] AC-6/7 reuse existing close/stop. [WONT] AC-8/9 untouched.
