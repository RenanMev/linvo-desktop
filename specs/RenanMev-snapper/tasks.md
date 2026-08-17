# Tasks: QC → Panel composer handoff

Status: Ready
Version: 1.0

## T1 — chat-handoff module + tests
**ACs:** AC-1, AC-4, AC-5, AC-E1, AC-E2  
**Files:** `apps/desktop/src/lib/chat/chat-handoff.ts`, `chat-handoff.test.ts`  
**Done when:** encode/decode attachment roundtrip; emit/listen (mocked); buffer+consume+TTL; invalid attachment returns text-only result.

## T2 — hydratePending on display snapshot + tests
**ACs:** AC-2, AC-E2  
**Files:** `hooks/use-display-snapshot.ts`, `use-display-snapshot.test.tsx`  
**Done when:** can install a ready pending from `{ file, width, height, previewUrl?, sourceLabel? }` and revoke previous.

## T3 — ChatInput consumes handoff
**ACs:** AC-1, AC-2, AC-5, AC-E2  
**Files:** `components/chat/chat-input.tsx`, `chat-input*.test.tsx`  
**Done when:** given a handoff prop/event payload, sets textarea value and hydrates pending once.

## T4 — Wire Panel listener
**ACs:** AC-3, AC-E1  
**Files:** `pages/chat-page.tsx` and/or `PanelApp.tsx`, tests as needed  
**Done when:** panel applies latest buffered handoff after mount/navigation to chat.

## T5 — Quick Center emits before open
**ACs:** AC-1, AC-2, AC-3, AC-4, AC-6, AC-7  
**Files:** `components/quick-center/quick-center-panel.tsx`, `quick-center-panel.test.tsx` / context tests  
**Done when:** Abrir no painel / Abrir no chat call emit with draft+pending then openPanel; empty state emits nothing or empty no-op payload per AC-4.

## T6 — Validate
**ACs:** all MUST  
**Done when:** targeted vitest pass for touched files; update `validation.md` briefly.
