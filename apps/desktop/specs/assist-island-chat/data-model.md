# Data model: conversa da ilha + citações

Status: Draft
Baseline: `research.md` F-7, F-9, F-10, F-19..F-23
Last updated: 2026-09-11
Feature: `apps/desktop/specs/assist-island-chat`

O **desktop** não ganha tabela: ganha uma chave de store e campos opcionais no contrato de mensagem. O **`linvo-api`** ganha duas colunas em `Message` — sem elas não há onde persistir (D-9, D-10).

## Store local (MODIFIED — documentar o que já existe)

Chave: `linvo:island-active-conversation`  
API: `loadActiveConversationId` / `saveActiveConversationId`  
Arquivo: `src/lib/chat/active-conversation-store.ts`

| Operação | Efeito |
|----------|--------|
| `save(id)` | `localStorage.setItem` com o id |
| `save(null)` | `removeItem` — Nova pergunta (D-6) |
| `load()` | string ou `null`; catch → `null` |

Mensagens **não** moram nesta chave. Continuam em `chat-local-store` (comandos Tauri `chat_save_messages` / `chat_load_messages`), particionadas por `conversationId`.

Invariante: esta chave é **só da ilha**. A conversa ativa do painel (router / `useConversations`) é outra. Sobrescrever uma com a outra faria a ilha pular de assunto (comentário atual do arquivo).

## Schema `@linvo/shared` (ADDED)

Arquivo: `packages/shared/src/chat.ts`

```ts
messageCitationKindSchema = z.enum(["rule", "procedure", "document"])

messageCitationSchema = z.object({
  id: z.string().min(1),
  kind: messageCitationKindSchema,
  label: z.string().min(1),
  href: z.string().min(1).optional(),
})

messageSchema  +=  citations: z.array(messageCitationSchema).optional()
messageSchema  +=  captureSummary: z.array(z.string().min(1)).max(3).optional()
```

Todos os campos novos são opcionais. Mensagem antiga continua parseando.

O desktop também precisa carregar os campos até a UI — hoje a cópia é campo a campo:

| Arquivo | Mudança |
|---------|---------|
| `src/lib/chat/types.ts` | `ChatMessage` ganha `citations?` / `captureSummary?` |
| `src/lib/chat/map-message.ts` | Incluir os dois no `mapApiMessageToChat`; senão o histórico do `listMessages` perde tudo em silêncio |
| `src/lib/chat/chat-local-store.ts` | Nada. `isChatMessage` não valida campos extras e `JSON.parse` preserva o objeto inteiro |

## Persistência no `linvo-api` (ADDED)

`model Message` hoje tem `toolUses`, `activities`, `artifacts`, `modelMessages` — todos `Json?`. Faltam dois:

```prisma
citations      Json?
captureSummary Json?
```

### O `[]` é significativo — não colapsar

`chat.service.ts:241` grava `toolUses && toolUses.length > 0 ? json : Prisma.DbNull`, e `chat.mapper.ts:65` lê `length > 0 ? data : undefined`. Aplicar esse mesmo padrão a `citations` **apagaria** o sinal do D-11: o miss de busca viraria omissão e o fallback nunca apareceria.

| Estado do turno | Coluna | DTO |
|-----------------|--------|-----|
| Buscou e achou | `[{...}]` | array |
| Buscou e não achou | `[]` (array JSON vazio) | `[]` |
| Não buscou | `DbNull` | campo ausente |

`captureSummary` pode seguir o padrão normal: não há diferença útil entre `[]` e ausente (D-10 manda omitir no timeout).

### Navegação do chip (desktop) — D-14

Se `href` vier, usa. Senão:

| kind | `openPanel` |
|------|-------------|
| `procedure` | `/settings/workspace/:workspaceId/procedures` |
| `rule` | `/settings/workspace/:workspaceId` |
| `document` | `/settings/workspace/:workspaceId` — **não** `/documents`, que lista PDFs gerados pelo agente, não a base de conhecimento |

Label do chip sempre visível. Deep-link por id é KAN-4.

Na v1 só `document` (via `search_knowledge`) e `procedure` (via `open_procedure`) têm emissor. `rule` fica no enum porque regra entra pelo system prompt e não por busca — ver tabela de emissores no AC-29.

## SSE (ADDED, espelha `artifact`)

Evento `citation`: `data` JSON validado por `messageCitationSchema`. Inválido → ignore.

Evento `capture_summary`: `data` = `{ "bullets": string[] }` com 1..3 itens. Inválido → ignore. A API só emite se o turno teve imagem e a extração bateu o timeout.

O stream de texto (`event: chunk`) **não espera** esses eventos. Ordem livre. Copiar não espera `capture_summary`.

## Invariants

1. `citations` omitido ≠ `citations: []` (D-11).
2. `captureSummary` omitido = sem UI de bullets.
3. Limpar o id da ilha não apaga `chat-local-store`.
4. Zod na borda: mensagem com `kind` desconhecido falha o parse daquele campo; o resto da mensagem ainda precisa ser usável — preferir `.catch` / strip do array inválido no parser SSE, não derrubar o stream.
