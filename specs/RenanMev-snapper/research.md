# Research: Floating capture → Quick Center

Feature branch: `RenanMev/snapper`
Date: 2026-08-17
Mode: brownfield map (what exists today)

## Framing

Intended work was A2+C1: capture from floating bar → ask in Quick Center.
This research maps the system **as shipped on `origin/main`**.

## Verdict (factual)

**A2+C1 already ships on main** via:
- PR #14 `feat/floating-chat-context-capture` (`d8c001b`, `36562dd`)
- PR #15 `feat/floating-bar-crop-shortcut` (`6938709`, `2f53cb8`)

There is no greenfield path left for “add capture button + upload in Quick Center”.

---

## 1. Floating bar → Quick Center

### Modes
- Island modes: `compact` | `quick-menu` | `checklist` | `edge-collapsed` — `floating-island-shell.tsx` / `BarApp.tsx:82-90`

### Bar actions (`floating-bar.tsx:166-183` → `BarApp.tsx:838-847`)
| Control | Behavior |
|---------|----------|
| Chat | `handleOpenQuickMenu` (`BarApp.tsx:413-456`) |
| Recorte | `handleCaptureContext` (`458-467`) |
| Encolher / Minimizar / Reset | edge, hide, position reset |

### Recorte path (bar)
1. Guard: only `compact` and no transition (`458-464`)
2. `setCaptureAndSendPending(true)` (`465`)
3. `handleOpenQuickMenu()` — morph to `quick-menu` (`466`)
4. `QuickCenterPanel` gets `autoCaptureAndSend={captureAndSendPending}` (`816-817`)

### Morph / close
- Expand: `expandFloatingToQuickMenu` + island morph (`413-440`)
- Close: `closeQuickMenu` clears `captureAndSendPending` (`533`)
- Blur close suppressed while capture active (`620-629`, `690-718`)

---

## 2. Quick Center capture + ask

### Wiring (`quick-center-panel.tsx`)
- Snapshot hook: `useDisplaySnapshot({ windowLabel: "main" })` (`116`)
- Manual: `CaptureMenu` → picker / magnetic / system (`465-472`)
- Pending chip: `CaptureContextChip` (`448-460`)
- Preview: `CapturePreviewDialog` when `draft` (`352-367`)
- Picker: `CaptureSourcePicker` (`370-376`)

### Auto path (from bar Recorte)
- On `ready` + `autoCaptureAndSend`: `startMagneticCapture()` once (`153-171`)
- When `pending.status === "ready"`: `sendPrompt("", false)` — **attachment-only send** (`235-247`)
- Cancel after start: consumes flag without send (`250-253`; covered in tests)

### Send
- `sendPrompt` builds `ChatSendAttachment` from pending (`186-227`)
- Allows empty text if attachment ready (`189`, `511-515`)
- Clears pending only after `prompt.send` accepts (`218-226`)

### Post-response
- Copy / Abrir no chat `/chat/:id` (`532-553`, `303-309`)
- Abrir no painel `/chat` (`316-319`)

---

## 3. `useQuickPrompt` attachments

`hooks/use-quick-prompt.ts`:
- `send(text, { attachment? })` (`66-75`)
- Create conversation JIT (`86-98`)
- Upload `source: "display_capture"` (`100-114`)
- SSE `streamChatResponse` with `attachmentIds` (`116-140`)
- Attachment-only allowed (`72-74`)

Parallel panel path: `use-chat.ts` same upload+stream pattern (`~537-626`).

---

## 4. Capture primitives

| Piece | Role | Cite |
|-------|------|------|
| `display-snapshot.ts` | `getDisplayMedia` → PNG, max size | `:146-217` |
| `use-display-snapshot.ts` | pending/draft, magnetic, picker, crop | `:191-455` |
| Magnetic | overlay crop → pending **without** preview dialog | `:365-411` |
| Picker path | → draft → `CapturePreviewDialog` → confirm | QC `:352+` |
| `chat-attachments-api.ts` | multipart upload; sources include `display_capture` | `:15-76` |
| Shared schema | content **or** `attachmentIds` (max 4) | `packages/shared/src/chat.ts:223-228` |

Panel chat uses `windowLabel: "panel"` (`chat-input.tsx:100`); overlay claim avoids crosstalk (`use-display-snapshot.ts:144-147`).

---

## 5. Tray / shortcuts (adjacent)

| Path | Opens |
|------|-------|
| Tray “Abrir chat” | Panel `/chat` — **not** Quick Center (`system-tray.ts:58-64`) |
| Global Ctrl/Cmd+Shift+L | `toggleAppVisibility` (`use-global-shortcut.ts`) |
| Local Ctrl+Shift+L / Enter on bar | Open/close Quick Center (`BarApp.tsx:658-680`) |

No tray item for Recorte/capture today.

---

## 6. Tests already covering this path

- `floating-bar.test.tsx` — Recorte calls `onCaptureContext`
- `quick-center-context.test.tsx` — autoCapture start, send, cancel
- `use-quick-prompt.test.tsx` — `display_capture` upload
- `2f53cb8` — Chat button does **not** arm auto-capture

---

## Gaps relative to original A2+C1 intent

These are **not** missing core capture→ask; they are adjacent deltas if product wants more:

1. Bar Recorte **auto-sends** attachment alone (no typed question first) — intentional in current code/tests.
2. Tray has no “Recorte / capturar” action.
3. Compact bar has no in-progress capture/stream indicator beyond opening QC.
4. Promote-to-panel keeps conversation id, but **draft text / pending attachment** are QC-local (next sprint A1+A5).

---

## Touchpoint index (if changing this area)

```
BarApp.tsx
components/floating-bar.tsx
components/quick-center/quick-center-panel.tsx
hooks/use-quick-prompt.ts
hooks/use-display-snapshot.ts
lib/context-capture/display-snapshot.ts
lib/chat/chat-attachments-api.ts
components/chat/capture-*.tsx
```
