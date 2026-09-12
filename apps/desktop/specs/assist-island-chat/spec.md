# Spec: Assist como chat live na ilha

Status: Draft
Version: 0.1
Mode: Delta
Baseline: `research.md` F-1..F-23
Last updated: 2026-09-11

Gate 1: este spec + `data-model.md` + `decision_log.md` + `tdd.md`.
Decisões: D-1..D-16, todas fechadas.

## Change Summary

A ilha 380×520 deixa de ser um prompt de uma string e passa a ser o chat de atendimento (`useChat`), com parar, copiar, anexos, uma conversa ativa e histórico longo só no painel. Tray “Abrir chat” abre o Assist. Strings visíveis dizem Assist. Citações e resumo de print são campos **opcionais** no contrato, mas o `linvo-api` passa a **emiti-los e persisti-los** (D-9, D-10) — isso inclui duas colunas novas em `Message`.

## Baseline Assertion

- Ilha já monta `useChat` + `ChatPanel` — F-1
- `QuickCenterPanel` fora do runtime — F-2
- Send não abre painel — F-3
- Sem Parar e sem Copiar na ilha — F-4, F-11
- Capture chip já na ilha — F-5
- Sem sidebar; conversa persistida; sem Nova pergunta — F-6, F-7
- Tray abre painel — F-8
- Sem citations / captureSummary no shared — F-9, F-10
- Testes e parte da UI ainda dizem Quick Center — F-12, F-16, F-17
- Markdown GFM editorial — F-13
- 380×520 + scroll interno — F-14
- `Message` na API não tem coluna para citação nem para resumo — F-19
- O padrão de persistência do repo colapsa `[]` em null — F-20
- Só `search_knowledge` consulta a base; `rule` não tem emissor — F-21
- `map-message.ts` copia campo a campo — F-22
- `/documents` lista PDFs gerados, não a base — F-23

## User Stories

### Primary

Como atendente, quero perguntar na ilha, ver o texto chegar em stream, parar se estiver errado, anexar um print e copiar a resposta, com o painel fechado.

Como atendente, quero começar outra pergunta sem uma lista de threads, e reabrir a ilha na conversa em que eu estava se eu não pedi “Nova pergunta”.

### Secondary

Como atendente, quero o item da bandeja “Abrir chat” expandir o Assist, e um item separado para o workspace.

Como atendente, quero chips de citação quando a API mandar, e “Não encontrei na base” só quando ela mandar lista vazia (D-11).

## Boundaries

**Always do**
- Painel fechado no send, no stream, no Parar e no Copiar
- Um `AbortController` por stream; Parar não apaga o texto parcial
- `captureWindowLabel="main"`
- Testes da fatia vermelhos antes do código (`tdd.md`)

**Ask first**
- npm nova
- Campo obrigatório no HTTP
- Extração de print sequencial na API (antes do stream da fala)

**Never do**
- `openPanel` no happy path da ilha
- Sidebar de conversas na ilha
- `rehype-raw` / `dangerouslySetInnerHTML` no markdown
- Reativar `QuickCenterPanel` como UI da ilha

## Acceptance Criteria

### AC-26a: Stream na ilha 380×520 [MODIFIED] [MUST]

**Was:** `useQuickPrompt` + uma string.  
**Now:** `IslandChat` + `useChat` + lista de mensagens. Já parcialmente no código (F-1).

Given a ilha aberta em `quick-menu` e a API saudável  
When o atendente envia uma pergunta  
Then os chunks aparecem na lista dentro da ilha, a janela `panel` não abre, e uma resposta longa rola em `ChatMessageList` (`overflow-y-auto`).

Given os testes em `src/lib/chat/*.test.ts` e `use-chat.test.tsx`  
When a fatia fecha  
Then continuam verdes.

### AC-26b: Parar geração [ADDED] [MUST]

Given um stream em curso na ilha (ou no painel)  
When o atendente aciona Parar  
Then `useChat.stopResponding()` aborta o signal, `isResponding` vira false, o texto parcial permanece na mensagem, e o composer libera.

Given `isResponding === true`  
When o input renderiza  
Then o botão primário do composer é Parar, não Enviar.

### AC-26c: Capture chip [MODIFIED] [MUST]

**Was:** chip no `QuickCenterPanel`.  
**Now:** `ChatInput` com `captureWindowLabel="main"` (já no código).

Given a ilha pronta (`ready`) e `captureRequested`  
When monta  
Then o recorte arma depois do morph, não durante. Cancelar o overlay não desmonta o Assist (overlap KAN-23; não reimplementar o overlay nesta spec).

### AC-26d: Markdown [MODIFIED] [MUST]

Given uma resposta com lista e **negrito**  
When renderiza na ilha  
Then usa `ChatMarkdown` GFM sem HTML cru (D-3).

### AC-27: Perfil Assist — uma conversa agora [ADDED] [MUST]

Given a ilha  
When renderiza  
Then não há lista de threads / sidebar de histórico.

Given uma conversa ativa com mensagens  
When o atendente clica **Nova pergunta**  
Then o composer e a lista ficam vazios, `linvo:island-active-conversation` é removido, e o próximo send chama `createConversation` de novo. A conversa antiga continua acessível no painel.

Given a ilha fechada e reaberta sem Nova pergunta  
When havia um id salvo  
Then retoma essa conversa (“Retomando conversa...” enquanto carrega).

Given stream em curso  
When Nova pergunta  
Then aborta e depois limpa (D-6).

### AC-28: Tray abre Assist [ADDED] [MUST]

Given fase `floating` e usuário autenticado  
When o item “Abrir chat” da bandeja dispara  
Then a janela `main` fica visível e o modo vai a `quick-menu` (Assist). `panel_open` **não** é invocado.

Given o mesmo menu  
When o item **Abrir workspace** dispara  
Then `openPanel("/chat")` (ou `/chat/:id` se houver conversa ativa na ilha — preferir `/chat` genérico; o maximize da ilha já faz o deep-link).

Given “Abrir configurações”  
When dispara  
Then inalterado (`/settings/general`).

### AC-19: Copiar como CTA primário na ilha [ADDED] [MUST]

Given a última mensagem assistente com `status === "done"` e texto não vazio  
When a ilha está visível  
Then existe um botão **Copiar** visível sem hover obrigatório. Clique escreve o conteúdo no clipboard e o rótulo vira **Copiado**. `openPanel` não é chamado.

Given stream ainda em curso  
When a mensagem está parcial  
Then Copiar não é o CTA primário (Parar é).

### AC-18: Happy path sem `openPanel("/chat")` [MODIFIED] [MUST]

Given send, stream, Parar, Copiar, Nova pergunta, Esc  
When qualquer um desses ocorre na ilha  
Then nenhum chama `openPanel("/chat")`.

Ainda permitido: botão “Abrir na janela grande”, tray “Abrir workspace”, `AuthGate` em fluxos que não sejam o live.

### AC-29: Citações [ADDED] [MUST] (shared + API + UI)

Emissores na v1 (verificado no código, não suposto):

| Fonte | `kind` | `id` / `label` |
|-------|--------|----------------|
| `search_knowledge` → `retriever.search` | `document` | `chunk.id` / `chunk.title` — hoje o `id` é descartado em `formatResults` |
| `open_procedure` | `procedure` | id / nome do procedimento |
| regras de negócio | `rule` | **sem emissor na v1** — o kind fica no schema, mas regra entra pelo system prompt, não por busca |

Given `retriever.search` devolveu chunks  
When o turno emite SSE  
Then cada hit vira `citation` `{ id, kind: "document", label: chunk.title }`. O `formatResults` para o LLM continua string; o cliente ganha o array em paralelo.

Given `search_knowledge` rodou e voltou vazia  
When o turno termina  
Then a mensagem persistida tem `citations: []` (array vazio de verdade, **não** `null`) e a ilha mostra “Não encontrei na base”.

Given o turno **não** chamou `search_knowledge`  
When o turno termina  
Then a coluna fica `null`, o DTO **omite** `citations`, e a ilha não mostra fallback nem chips.

Given `message.citations` com itens válidos  
When a mensagem assistente termina  
Then chips com `label`. Clique → `openPanel` na rota do kind (D-14). Payload omitido → nenhuma UI de citação.

Given evento SSE `citation` malformado  
When o parser lê  
Then ignora o evento; o stream de texto segue.

### AC-30: Resumo do print [ADDED] [MUST]

Given o turno tem `userImages.length > 0`  
When a API abre o stream da fala  
Then dispara extração de até 3 bullets **em paralelo** (não espera ela para o primeiro `chunk`). Se concluir a tempo, emite `capture_summary` e persiste `captureSummary` na mensagem. Se estourar ~1,2s ou falhar, omite; a fala não espera.

Given o desktop recebe `captureSummary` de 1..3 strings  
When a **mensagem assistente** daquele turno renderiza (o campo mora na assistente, não na do usuário)  
Then mostra até 3 bullets colapsáveis **acima** do texto da resposta. Copiar habilita quando a resposta está `done`, mesmo que os bullets ainda não tenham chegado ou nunca cheguem. Copiar leva só o texto da resposta, não os bullets.

Given turno sem imagem, ou extração omitida  
When renderiza  
Then zero bullets; desktop não chama LLM.

### AC-31: Rename visível [MODIFIED] [MUST]

Given qualquer superfície visível ao usuário (dialog da ilha, tooltips do chrome da ilha, testes de UI da ilha)  
When procura a string `Quick Center`  
Then não encontra.

O dialog da ilha tem `aria-label="Assist"`. O botão fechar é “Fechar Assist”. Ids/classes `quick-center-*` podem permanecer (D-8).

### AC-T: Suíte aponta para o produto novo [MODIFIED] [MUST]

Given `BarApp.test.tsx`  
When abre o `quick-menu`  
Then encontra o dialog Assist (não “Quick Center”).

Given `island-chat.test.tsx` e `island-panel.test.tsx`  
When a v1 fecha  
Then cobrem stream, Parar, Copiar, Nova pergunta, maximize → panel, Esc.

`QuickCenterPanel` pode ser removido no final da v1 se nenhum import restar; onboarding não usa esse componente.

## Invariants

1. Um stream por `useChat` instance; trocar de conversa aborta o anterior (já testado).
2. Ilha e painel podem ter conversas ativas diferentes (`active-conversation-store` separado).
3. Maximize da ilha abre a **mesma** conversa (`loadActiveConversationId`).
4. Composer desliga se API down ou sessão expirada (`IslandChat disabled`).
5. Sem `rehype-raw`.
6. Sem secrets no payload de evento da ilha (auth é outro SDD).
7. `citations: []` e `citations` ausente são estados **diferentes** ponta a ponta: coluna Prisma → mapper → DTO → SSE → `ChatMessage` → UI. Qualquer camada que colapse um no outro quebra o AC-29.

## Superfície de alteração

Nada disto é ordem de implementação — a ordem está em `tdd.md`.

### Arquivos **novos**

| Path | Responsabilidade |
|------|------------------|
| `src/components/quick-center/island-chat.test.tsx` | Stream, restore, Parar, persistência do id |
| `src/components/quick-center/island-panel.test.tsx` | Dialog Assist, Esc, maximize, Nova pergunta |
| `src/lib/chat/active-conversation-store.test.ts` | load/save/clear |
| `src/components/auth/auth-gate.tray.test.tsx` **ou** teste no `BarApp` / chrome | Tray → expand, não `panel_open` |
| `src/components/chat/chat-citations.tsx` | Chips + fallback |
| `src/components/chat/chat-citations.test.tsx` | Chips / vazio / omitido |
| `src/lib/chat/stream-citations.test.ts` | Evento SSE `citation` |
| `src/lib/chat/map-message.test.ts` | `[]` sobrevive ao mapeamento; campo ausente vira `undefined` |
| `src/components/chat/capture-summary.tsx` | Bullets colapsáveis |
| `src/components/chat/capture-summary.test.tsx` | 3 itens; ausente = não renderiza; Copiar não espera |

### Arquivos **modificados**

| Path | O que muda |
|------|------------|
| `src/hooks/use-chat.ts` | Exportar `stopResponding` |
| `src/hooks/use-chat.test.tsx` | Caso abort via `stopResponding`; texto parcial |
| `src/components/chat/chat-input.tsx` | Parar quando `isResponding`; receber `onStop` |
| `src/components/chat/chat-input.test.tsx` | Parar visível / chama `onStop` |
| `src/components/chat/chat-panel.tsx` | `onStop`; Copiar no perfil assist; citations; summary |
| `src/components/chat/chat-message.tsx` | Chips; Copiar na última assistente quando `variant="assist"` |
| `src/lib/chat/types.ts` | `ChatMessage` ganha `citations?` e `captureSummary?` |
| `src/lib/chat/map-message.ts` | Copia campo a campo — sem incluir os dois novos, o histórico hidratado **perde** citações silenciosamente |
| `src/components/quick-center/island-chat.tsx` | Passar `stopResponding`; `variant="assist"` |
| `src/components/quick-center/island-panel.tsx` | `aria-label="Assist"`; botão Nova pergunta; copy de fechar |
| `src/components/auth/auth-gate.tsx` | Não registrar `openChat` → panel |
| `src/BarApp.tsx` | Registrar tray `openChat` = expand Assist |
| `src/lib/tray-handlers.ts` | `openWorkspace: () => Promise<void>` |
| `src/lib/system-tray.ts` | Item “Abrir workspace” |
| `src/lib/system-tray.test.ts` | Label novo + destinos se testável |
| `src/BarApp.test.tsx` | Dialog Assist; tray se couber |
| `packages/shared/src/chat.ts` | `messageCitationSchema`, `citations?`, `captureSummary?` |
| `packages/shared/src/chat.test.ts` | Aceita / rejeita citations; omitido vs `[]` |

### linvo-api — **modificados** (KAN-29 / KAN-30)

| Path | O que muda |
|------|------------|
| `prisma/schema.prisma` + migration | `Message` ganha `citations Json?` e `captureSummary Json?`. **Não existem hoje** (só `toolUses`, `activities`, `artifacts`, `modelMessages`) |
| `src/assist/tools/search-knowledge.tool.ts` | Além da string para o LLM, devolver hits estruturados (`id`, `title`) — hoje `formatResults` descarta o `id` |
| `src/assist/assist.types.ts` | Hook `onCitation`; `captureSummary` no resultado do turno |
| `src/chat/chat-turn.runner.ts` | SSE `citation` e `capture_summary`; persistir nos dois campos da mensagem |
| `src/chat/chat.service.ts` | `finalizeAssistantMessage` grava os dois campos. **Atenção:** o padrão atual é `length > 0 ? json : Prisma.DbNull` — para `citations` isso apagaria o `[]` do D-11. Gravar `[]` como array; só usar `DbNull` quando não houve busca |
| `src/chat/chat.mapper.ts` | `parseCitations` **não** pode copiar `parseToolUses` (`length > 0 ? data : undefined`), pelo mesmo motivo: `[]` precisa sobreviver até o DTO |
| extração de print (módulo novo, p.ex. `src/assist/capture-summary.ts`) | `generateObject` 1..3 strings, timeout ~1,2s, **paralelo** ao stream |
| specs da tool / runner / mapper | miss → `citations: []`; hit → array; sem busca → omitido; round-trip `[]` ≠ omitido; sem imagem → sem summary; timeout não atrasa o primeiro chunk |

### Testes existentes a **atualizar**

| Path | Ajuste |
|------|--------|
| `src/BarApp.test.tsx` | `"Quick Center"` → Assist; botão Fechar Assist |
| `src/components/quick-center/quick-center-panel.test.tsx` | Remover no fim da v1, depois de island-* verde |
| `src/components/quick-center/quick-center-context.test.tsx` | Migrar asserts de captura para `chat-input-context` / island se ainda só no legado |
| `src/lib/system-tray.test.ts` | Incluir “Abrir workspace” no menu floating |

### **Não** alterar na v1

| Path | Por quê |
|------|---------|
| Morph / `floating-island-transition.ts` / SDD-ILHA | Outro trabalho |
| `use-quick-prompt.ts` | Onboarding |
| `src/pages/chat-page.tsx` | KAN-4 |
| `panel-sidebar.tsx` | Histórico longo fica lá |
| Tela `knowledge/:id` | D-14: lista do workspace basta |
| Retriever → pgvector | spec `knowledge-pgvector-rag` |
| Pasta `quick-center/` rename | KAN-8 |

## Gate checklist

- [ ] Gate R: `research.md` aceito (F-1..F-23)
- [x] Gate 1: D-1..D-16 fechadas
- [ ] Gate 2: fatias em `tdd.md` (desktop + API)
- [ ] Gate T: testes desktop e API do turno SSE; AC-31; AC-18; AC-29; AC-30
