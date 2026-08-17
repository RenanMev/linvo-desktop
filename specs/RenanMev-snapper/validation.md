# Validation: QC → Panel composer handoff

Date: 2026-08-17

## Traceability

| AC | Evidence |
|----|----------|
| AC-1 draft text | `emitComposerHandoff` + `ChatInput` handoff effect; test `emits composer handoff…` / `applies composer handoff text once` |
| AC-2 pending capture | `encode/decode` + `hydratePending`; tests in `chat-handoff.test.ts` / `use-display-snapshot.test.tsx` |
| AC-3 Abrir no chat | emit before `openPanel(/chat/:id)`; panel listens in `ChatPage` |
| AC-4 empty no-op | `buildChatHandoffPayload` returns null → no emit |
| AC-5 one-shot | buffer consume + `onComposerHandoffConsumed` clears state |
| AC-E1 late panel | `storeChatHandoffBuffer` + `consumeChatHandoffBuffer` on ChatPage mount |
| AC-E2 corrupt attachment | decode try/catch in ChatInput; text still applied |
| AC-6/7 | reuse existing close/stop |

## Tests run

`vitest` targeted suites: **58 passed** (handoff, snapshot, chat-input, quick-center panel/context).
