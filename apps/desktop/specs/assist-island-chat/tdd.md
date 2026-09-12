# TDD: Assist como chat live

Status: Draft
Feature: `apps/desktop/specs/assist-island-chat`
Last updated: 2026-09-11

Gate 1 fechado (D-10, D-11, D-14). Cada fatia: teste vermelho → código mínimo → verde → só então a próxima.

Não há Playwright neste app. Runner: Vitest 3 (`unit` em node para `src/lib/**/*.test.ts`, `components` em jsdom para `*.test.tsx`).

```bash
pnpm --filter @linvo/desktop test
pnpm --filter @linvo/desktop test:watch
```

API fake: `VITE_API_URL=http://localhost:3001` (já no `vitest.config.ts`).

## Convenções (copiar, não inventar)

| Padrão | Onde está |
|--------|-----------|
| `deferred<T>()` + async generator de stream | `src/hooks/use-chat.test.tsx` |
| `toAsyncGenerator(chunks)` | `src/hooks/use-quick-prompt.test.tsx` |
| `sseResponse(blocks)` + spy `authorizedFetch` | `src/lib/chat/stream-artifact.test.ts` |
| `vi.mock("@/lib/panel-window")` | `src/components/quick-center/quick-center-panel.test.tsx` |
| Mock Tauri global | `src/test/setup.ts` → `src/test/mocks/tauri.ts` |
| `userEvent.setup()` + `waitFor` | suítes `*.test.tsx` |

Mocks de `chat-api` na UI da ilha seguem `use-chat.test.tsx:11-17`: `createConversation`, `listMessages`, `streamChatResponse`, `submitToolResult`, `regenerateMessage`.

Não mockar `useChat` nos testes de `IslandChat` — mockar a API. O perfil Assist é o hook de verdade.

## O que já deve permanecer verde (não reescrever)

- `src/hooks/use-chat.test.tsx` — ownership de stream, anexo, abort por troca de conversa
- `src/lib/chat/sse-parser.test.ts`
- `src/lib/chat/stream-artifact.test.ts`
- `src/lib/chat/chat-api-attachments.test.ts`
- `src/components/chat/chat-input-context.test.tsx` — capture no `ChatInput`
- `src/lib/floating-island-transition.test.ts` / `floating-island-shell.test.tsx` — morph (fora desta spec)

## Slice 0 — Alinhar a suíte ao runtime (sem feature nova)

**Por quê:** F-17. `BarApp.test.tsx` procura `"Quick Center"` e o dialog é `"Chat"`. Sem isto, todo o resto parece falha de morph.

### Testes (vermelho hoje)

Arquivo: `src/BarApp.test.tsx` (editar asserts, não a feature).

| id | Assert |
|----|--------|
| T0.1 | Abrir quick-menu encontra `getByRole("dialog", { name: "Assist" })` **ou** o label atual `"Chat"` até o Slice 5; **não** `"Quick Center"` |
| T0.2 | Fechar usa o aria-label real do botão X (`Fechar chat` hoje / `Fechar Assist` depois) |

O rename já está decidido (D-8), mas só entra no código no Slice 5. Aqui, alinhar o teste com `"Chat"` — o que o runtime faz **hoje** — para recuperar o sinal sem misturar duas mudanças. Slice 5 troca para Assist.

Rodar: `pnpm --filter @linvo/desktop test -- BarApp.test.tsx`

**Verde:** suíte BarApp passa contra `IslandPanel`. Zero código de produto além de strings de teste.

## Slice 1 — Store da ilha (KAN-27 base)

Arquivo **novo:** `src/lib/chat/active-conversation-store.test.ts`

| id | Caso | Assert (falha se a API mudar; hoje o código já passa) |
|----|------|------|
| T1.1 | load vazio | `null` |
| T1.2 | save + load | round-trip do id |
| T1.3 | `save(null)` | chave sumiu |
| T1.4 | `localStorage` lança | load → `null`, save não explode |

Se T1.1–T1.4 já passam, não há código de produto. É a rede de segurança do Slice 3.

## Slice 2 — Stream na ilha (KAN-26)

Arquivo **novo:** `src/components/quick-center/island-chat.test.tsx`

Helpers: `streamChunks`, `render(<IslandChat />)`, `localStorage.clear()` no `beforeEach`.

| id | Caso | Assert |
|----|------|--------|
| T2.1 | send “oi” | `createConversation` 1×; chunks concatenados visíveis |
| T2.2 | durante T2.1 | `openPanel` **não** chamado (`vi.mock` panel-window) |
| T2.3 | id em localStorage + `listMessages` hidrata | não chama `createConversation`; mostra conteúdo cacheado |
| T2.4 | `disabled` | composer não envia |
| T2.5 | placeholder / textbox existe | ilha é um chat, não um prompt legado sem lista |

Rodar até T2.1–T2.5 verdes **antes** de Parar. Parte já funciona (F-1); o valor é a rede.

Arquivo **novo:** `src/components/quick-center/island-panel.test.tsx` (mínimo)

| id | Caso | Assert |
|----|------|--------|
| T2.6 | `aria-label` do dialog é Chat ou Assist, nunca Quick Center |
| T2.7 | Esc chama `onClose` |
| T2.8 | “Abrir na janela grande” com id salvo → `openPanel("/chat/"+id)` |

## Slice 3 — Parar (KAN-26b) [código de produto]

### 3a. Hook — vermelho

Arquivo: `src/hooks/use-chat.test.tsx` (acrescentar)

| id | Caso | Assert |
|----|------|--------|
| T3.1 | stream com `deferred` gate; chamar `stopResponding()` | `AbortSignal.aborted === true`; `isResponding === false`; texto já yieldado permanece em `messages` |

Isto **falha** hoje: `stopResponding` não existe no return (F-4).

Verde: implementar `stopResponding` em `use-chat.ts` (abort + mesmo caminho de cancelamento interno).

### 3b. Input — vermelho

Arquivo: `src/components/chat/chat-input.test.tsx`

| id | Caso | Assert |
|----|------|--------|
| T3.2 | `isResponding` + `onStop` | botão `Parar` visível; click chama `onStop` |
| T3.3 | `isResponding === false` | Parar **ausente**; Enviar presente |

Verde: `ChatInput` + `ChatPanel` recebem `onStop` / `isResponding` (já tem `isResponding`).

### 3c. Ilha — vermelho depois do hook

Arquivo: `island-chat.test.tsx`

| id | Caso | Assert |
|----|------|--------|
| T3.4 | stream aberto com gate | Parar visível; click aborta o signal passado a `streamChatResponse` |

`IslandChat` precisa passar `stopResponding` ao panel.

## Slice 4 — Copiar na ilha (KAN-19 / AC-19)

Arquivo: `src/components/chat/chat-message.test.tsx` **ou** `island-chat.test.tsx`

Mock de clipboard: o legado usa `writeClipboardText` — seguir o mesmo módulo que `quick-center-panel.test.tsx:142-157`.

| id | Caso | Assert |
|----|------|--------|
| T4.1 | última assistente `done` + `variant="assist"` | botão Copiar visível |
| T4.2 | click | clipboard recebe o `content`; texto Copiado |
| T4.3 | `openPanel` não chamado |
| T4.4 | ainda `isResponding` | Copiar não é o botão primário do composer (Parar é) |

Verde: CTA na mensagem / barra da ilha. Não recolocar `QuickCenterPanel`.

## Slice 5 — Nova pergunta + rename (KAN-27, KAN-31)

Arquivo: `island-panel.test.tsx`

| id | Caso | Assert |
|----|------|--------|
| T5.1 | botão “Nova pergunta” existe; **não** há listbox/lista de 40 conversas |
| T5.2 | com id salvo e mensagens; click Nova pergunta | lista vazia; `loadActiveConversationId() === null` |
| T5.3 | próximo send | `createConversation` de novo |
| T5.4 | `getByRole("dialog", { name: "Assist" })` |
| T5.5 | `queryByLabelText("Quick Center")` é null |
| T5.6 | se stream ativo, Nova pergunta aborta (reusa T3) |

Atualizar `BarApp.test.tsx` de `"Chat"` → `"Assist"` neste slice (não antes, se o Slice 0 ficou em Chat).

## Slice 6 — Tray (KAN-28)

Precisa de um ponto testável: ou `BarApp` registra o handler, ou uma função pura `resolveTrayChatAction(phase)`.

Preferir: extrair `createFloatingTrayHandlers({ expandAssist, openWorkspace, ... })` em `src/lib/tray-handlers.ts` e testar **sem** montar Tauri menu.

Arquivo **novo:** `src/lib/tray-handlers.test.ts`

| id | Caso | Assert |
|----|------|--------|
| T6.1 | `openChat()` | chama `expandAssist`; **não** chama `openPanel` |
| T6.2 | `openWorkspace()` | chama `openPanel("/chat")` |
| T6.3 | `buildTrayMenuItems` em floating contém “Abrir workspace” e “Abrir chat” |

Arquivo: `src/lib/system-tray.test.ts` — incluir o label novo na lista esperada.

Verde: `AuthGate` não aponta `openChat` para o panel em fase floating; `BarApp` registra `expandAssist = handleOpenQuickMenu` (+ `showMainBar` se a janela estiver oculta).

Integração opcional em `BarApp.test.tsx`: disparar o handler registrado e ver `expandFloatingToQuickMenu`.

## Slice 7 — Citações (KAN-29)

**7a. Shared primeiro**

Arquivo: `packages/shared/src/chat.test.ts`

| id | Caso | Assert |
|----|------|--------|
| T7.1 | mensagem sem `citations` parseia |
| T7.2 | `citations` com kind rule/procedure/document parseia |
| T7.3 | `citations: []` parseia e continua `[]` (não vira `undefined`) |
| T7.3b | kind desconhecido: o item inválido cai fora, o resto da mensagem segue usável (invariante 4 do `data-model.md`) |

Verde: schema em `chat.ts`. Desktop ainda não mostra UI.

**7b. SSE**

Arquivo **novo:** `src/lib/chat/stream-citations.test.ts` (copiar `stream-artifact.test.ts`)

| id | Caso | Assert |
|----|------|--------|
| T7.4 | `event: citation` válido dispara callback |
| T7.5 | payload inválido não dispara |

**7c. UI**

Arquivo **novo:** `src/components/chat/chat-citations.test.tsx`

| id | Caso | Assert |
|----|------|--------|
| T7.6 | chips com `label` |
| T7.7 | `citations` omitido → nenhum chip **e** nenhum fallback |
| T7.8 | `citations: []` → “Não encontrei na base”, zero chips |
| T7.9 | click `document` → `openPanel("/settings/workspace/"+id)`; nunca `/documents` |
| T7.10 | click `procedure` → `openPanel("/settings/workspace/"+id+"/procedures")` |

**7d. Mapeamento (regressão silenciosa)**

Arquivo: `src/lib/chat/map-message.test.ts` (novo, ou caso em suíte existente)

| id | Caso | Assert |
|----|------|--------|
| T7.11 | `Message` da API com `citations: []` | `mapApiMessageToChat` devolve `[]`, **não** `undefined` |
| T7.12 | `Message` sem o campo | `ChatMessage.citations === undefined` |

Sem isto, o Slice 7 passa no componente e falha no histórico hidratado.

**API (linvo-api), no mesmo slice:**

Migration primeiro: `citations Json?` + `captureSummary Json?` em `Message`. Os testes abaixo não têm onde gravar antes disso.

| id | Caso | Assert |
|----|------|--------|
| T7.13 | search com hits | SSE `citation` por hit (`kind: "document"`, `label = title`); mensagem persistida com array |
| T7.14 | search vazio | coluna gravada como `[]`, **não** `Prisma.DbNull`; DTO sai `citations: []` |
| T7.15 | turno sem search | coluna `DbNull`; DTO **omite** o campo |
| T7.16 | round-trip mapper | `[]` gravado → `[]` lido. Falha se `parseCitations` copiar o `length > 0 ? data : undefined` do `parseToolUses` |

## Slice 8 — Resumo do print (KAN-30)

Arquivo **novo:** `src/components/chat/capture-summary.test.tsx`

| id | Caso | Assert |
|----|------|--------|
| T8.1 | 3 strings → 3 bullets acima do texto da resposta assistente |
| T8.2 | campo ausente → nada |
| T8.3 | Copiar visível com resposta `done` mesmo sem summary; clipboard recebe só a resposta, sem os bullets |

**API:**

| id | Caso | Assert |
|----|------|--------|
| T8.4 | turno com imagem | primeiro `chunk` pode sair **antes** de `capture_summary` |
| T8.5 | extração lenta / timeout | nenhum `capture_summary`; stream completa |
| T8.6 | turno sem imagem | zero eventos `capture_summary` |

## Slice 9 — Aposentar o legado

Quando T2–T6 verdes:

1. Remover imports mortos de `QuickCenterPanel`.
2. Apagar `quick-center-panel.tsx` + os dois testes do legado **somente se** captura, Parar e Copiar tiverem cobertura na ilha / `ChatInput`.
3. Manter `use-quick-prompt.ts` (onboarding).
4. `rg "Quick Center" apps/desktop` — hits só em CSS/id internos ou nesta pasta `specs/`.

## Ordem obrigatória

```
0  BarApp.test alinhado
1  store.test (rede)
2  island-chat stream + island-panel chrome
3  stopResponding → ChatInput Parar → island Parar
4  Copiar
5  Nova pergunta + Assist
6  Tray
7  citations (shared → migration → API emite → map-message → UI)
8  captureSummary (API paralelo + UI)
9  apagar QuickCenterPanel
```

Não começar 7 antes de 3: citações em cima de um chat sem Parar/Copiar não fecha o turno.

## Critério de pronto (Gate T)

```bash
pnpm --filter @linvo/desktop test
pnpm --filter @linvo/shared test
# no linvo-api: specs do runner / search-knowledge / capture-summary
```

- Zero falhas
- Migration do `Message` aplicada; `[]` sobrevive ao round-trip (T7.14–T7.16)
- `rg "Quick Center" apps/desktop/src` não encontra string de UI (aria/tooltip/texto)
- `rg "openPanel\\(\"/chat" apps/desktop/src/components/quick-center` só no maximize / “Abrir na janela grande”
- `use-chat.test.tsx` ainda cobre ownership de stream
