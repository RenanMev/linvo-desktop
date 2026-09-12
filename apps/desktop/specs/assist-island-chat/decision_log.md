# Decision Log: Assist como chat live

Status: Draft (Gate 1)
Date: 2026-09-11
Feature: `apps/desktop/specs/assist-island-chat`

Decisões D-1..D-16. Gate 1: D-10, D-11 e D-14 fechados em 2026-09-11 (decisão explícita: shared + API + desktop). D-15 e D-16 saíram da revisão das specs no mesmo dia.

## D-1: Delta sobre IslandChat, não rewrite

**Decision:** A v1 desta spec parte do runtime atual (`IslandPanel` + `IslandChat` + `useChat` + `ChatPanel`). Não voltar para `QuickCenterPanel` / `useQuickPrompt` como chat da ilha.

**Rationale:** F-1, F-2, F-18. O núcleo do KAN-26 já está no código. Reescrever perde anexos, tools e o store. O trabalho é fechar o perfil Assist e a suíte.

## D-2: Um `ChatPanel`, perfil por props — não um chat “reduzido”

**Decision:** A ilha continua montando o mesmo `ChatPanel`. O perfil Assist é:

- sem sidebar de threads (já)
- sem toolbar de título (já `showToolbar={false}`)
- `stopResponding` + botão Parar
- Copiar na última resposta do assistente
- botão Nova pergunta no cabeçalho da ilha
- `variant="assist"` só para compactar chrome (padding, CTA), não para remover regenerate / reply / tools / model picker

**Rationale:** O comentário em `island-chat.tsx` está certo no mérito: `useQuickPrompt` não era um chat menor, era outra coisa. KAN-27 fala de **ciclo de conversa**, não de castrar o runtime. Fork de UI duplicaria SSE e captura.

## D-3: Markdown GFM sem HTML cru

**Decision:** Manter `ChatMarkdown` + `remark-gfm`, sem `rehype-raw`. “Markdown mínimo” do KAN-26 lê-se como **sem HTML arbitrário**, não como voltar a `pre-wrap`.

**Rationale:** F-13. Resposta de atendimento usa lista e ênfase. O risco de XSS está em raw HTML, não em GFM.

## D-4: `stopResponding` no `useChat`, visível nos dois chats

**Decision:** Exportar `stopResponding()` que aborta o `AbortController` atual e preserva o texto parcial (igual `useQuickPrompt.stop`). `ChatInput` troca Enviar por Parar enquanto `isResponding`. Vale para ilha e painel — é o mesmo input.

**Rationale:** F-4. Abort já existe. Esconder Parar no painel criaria dois comportamentos para o mesmo hook.

## D-5: Copiar é CTA primário na ilha (KAN-19 entra nesta spec)

**Decision:** Quando o stream da última mensagem assistente termina, a ilha mostra **Copiar** como ação primária dessa mensagem. Feedback “Copiado”. Não abre o painel. O painel workspace pode manter copiar como ação secundária (hover), mas a ilha não.

**Rationale:** F-11. Sem Copiar o chat live não fecha o turno no canal. A história é KAN-19 (épico KAN-2), mas a regressão nasceu nesta migração. Tratar como MUST do KAN-3.

## D-6: Nova pergunta limpa o id ativo, não apaga o histórico gravado

**Decision:** “Nova pergunta” chama `saveActiveConversationId(null)`, zera o `conversationId` no estado, e mostra composer vazio. A conversa anterior permanece no `chat-local-store` e no servidor — o painel ainda a lista. Se houver stream em curso, `stopResponding` antes de limpar.

**Rationale:** F-7 + KAN-27. A ilha é “uma conversa agora”, não uma lixeira. Histórico longo = painel (texto do épico).

## D-7: Tray `openChat` expande a ilha; workspace é item novo

**Decision:**

| Item | Destino |
|------|---------|
| Abrir chat | Mostrar janela `main` e expandir para Assist (`handleOpenQuickMenu`) |
| Abrir workspace | `openPanel("/chat")` (o que o tray faz hoje em `openChat`) |
| Abrir configurações | inalterado |

`AuthGate` deixa de dono de `openChat`. Em fase `floating`, `BarApp` (ou hook que tenha o expand) registra o handler. Sem usuário, o item permanece disabled (já é o caso).

**Rationale:** F-8, KAN-28. `AuthGate` não conhece o morph. O expand já existe em `BarApp.handleOpenQuickMenu`.

## D-8: Nome visível é Assist

**Decision:** Toda string visível ao usuário (aria-label do dialog, tooltips, títulos) usa **Assist**. “Chat” na pílula pode permanecer como verbo de ação (“Abrir Assist” / botão Chat — ver AC-31). Interno (`id="quick-center-panel"`, pasta `quick-center/`, classes CSS) **não** é rename obrigatório na v1.

**Rationale:** KAN-31. Rename de pasta/ids é KAN-8 (migração de arquivos), não este épico.

## D-9: Citações são campo opcional no shared; UI só se o array existir

**Decision:** `messageSchema` ganha `citations: z.array(messageCitationSchema).optional()`. Kind: `rule` \| `procedure` \| `document`. Parser SSE aceita evento `citation` (mesmo padrão de `artifact`): payload inválido é ignorado.

A API **emite** o array neste épico (`linvo-api`): o `id`/`title` do retriever deixam de morrer no `formatResults`. Persistência na mensagem para reabrir o chat. Desktop degrada se o campo vier omitido (cliente velho / turno sem busca).

A spec `knowledge-pgvector-rag` D-13 (“shared não muda”) fica **revogada para este campo**. Pgvector continua fora do caminho crítico: cita-se o que o retriever atual já devolve.

**Rationale:** KAN-29. Sem emitir no SSE, chip é teatro. Três repos no mesmo Gate 2.

## D-10: 3 bullets do print — mesmo SSE, paralelo, desktop não chama LLM

**Decision:** KAN-30 entra na v1.

1. Só quando o turno tem imagem (`userImages.length > 0`).
2. A API gera até 3 strings curtas (pedido, identificador, restrição) com um `generateObject` **em paralelo** ao stream da fala — mesmo padrão de não bloquear o cliente que o `artifact` já usa.
3. Emite `event: capture_summary` quando ficar pronto. Timeout curto (~1,2s): se estourar, **omite** o evento; a fala segue.
4. O desktop **nunca** dispara LLM para resumir. Renderiza bullets colapsáveis só se o payload existir. Copiar amarra no `status: done` da resposta, não nos bullets.
5. Sem imagem: campo omitido, zero UI.

**Rationale:** O aceite é “confirmar que leu o print” **e** “não atrasar Copiar”. Segunda chamada no cliente quebra os dois. Extra sequencial na API antes do stream também quebra. Paralelo + timeout cumpre.

## D-11: Fallback só em miss explícito de busca

**Decision:**

| Quem | Quando | Payload | UI |
|------|--------|---------|-----|
| API | turno sem `search_knowledge` / retrieval | omitido | nada |
| API | buscou e **zero** hits | `citations: []` | “Não encontrei na base” |
| API | buscou e achou | `citations: [… ]` | chips |
| Desktop | omitido | — | nada (não inventa) |
| Desktop | `[]` | — | fallback |
| Desktop | array com itens | — | chips |

Não inferir do texto da resposta. Não mostrar o fallback em saudação, print, recusa, small talk. O aceite do Jira (“se a API não mandar”) lê-se como miss de busca, não como campo ausente.

**Rationale:** Array vazio é o único sinal honesto. Omitido é o default de 99% das mensagens.

## D-14: Clique do chip usa a melhor rota que já existe

**Decision:** `href` da API, se vier, ganha. Senão o desktop:

| kind | `openPanel` |
|------|-------------|
| `procedure` | `/settings/workspace/:workspaceId/procedures` |
| `rule` | `/settings/workspace/:workspaceId` (lista de regras no detalhe) |
| `document` | `/settings/workspace/:workspaceId` — **não** `/documents` (isso é PDF gerado) |

Sem tela `knowledge/:id` na v1. Chip **sempre** mostra o `label`. Clique abre a lista do kind, não o chat. Deep-link por id é KAN-4.

**Rationale:** Não bloquear citações numa página que não existe. Atendente vê a fonte; se quiser o texto, vai ao workspace.

## D-12: TDD por fatia; suíte legado só sai depois do verde

**Decision:** Cada fatia em `tdd.md` começa com testes que falham. `use-chat.test.tsx` e os testes SSE de `lib/chat` precisam permanecer verdes o tempo todo. `quick-center-panel.test.tsx` só é apagado quando `island-*.test.tsx` cobrir Parar, Copiar e captura. `useQuickPrompt` permanece por causa do onboarding.

**Rationale:** F-16, F-17. Apagar o legado primeiro deixa um buraco. Atualizar `BarApp.test.tsx` no Slice 0 para o dialog atual, senão o resto é ruído.

## D-13: Branch de implementação

**Decision:** Spec vive em `apps/desktop/specs/assist-island-chat/` e pode entrar nesta branch ou numa `feat/assist-island-chat` à parte. Código de produto do KAN-3 **não** mistura com o morph (SDD-ILHA-ENVELOPE), além do que já está em `IslandChat`. Se o morph mergear primeiro, a implementação parte desse `main`. Se não, a fatia 0 assume F-18.

**Rationale:** Quatro commits desta branch são de envelope. Empilhar stop/tray/citações no mesmo PR deixa o morph irrevisável.

## D-15: `citations` não segue o padrão de persistência do repo

**Decision:** `Message` ganha `citations Json?` e `captureSummary Json?` (migration aditiva, coluna nula — F-19). Para `citations`, **não** reusar o idioma de `toolUses`:

| Camada | Padrão do repo hoje | O que `citations` faz |
|--------|---------------------|-----------------------|
| `chat.service.ts` | `length > 0 ? json : Prisma.DbNull` | `[]` grava `[]`; só “não buscou” grava `DbNull` |
| `chat.mapper.ts` | `length > 0 ? data : undefined` | `[]` sai `[]`; só `null`/inválido sai `undefined` |

`captureSummary` pode seguir o padrão normal — ali `[]` e ausente significam a mesma coisa.

**Rationale:** F-20. D-11 inteiro depende de `[]` ≠ ausente. Copiar o padrão existente por hábito apagaria o único sinal que dispara “Não encontrei na base”, e o bug seria invisível: os testes de componente passariam e só o histórico reidratado falharia. Mesmo motivo para `map-message.ts` entrar na superfície (F-22).

## D-16: `rule` fica no enum sem emissor na v1

**Decision:** O enum continua `["rule", "procedure", "document"]`. Emissores reais na v1: `search_knowledge` → `document`, `open_procedure` → `procedure`. Regra de negócio **não** emite citação.

**Rationale:** F-21. Regra entra pelo system prompt, não por busca — não há evento a partir do qual derivar id e label sem inventar. Tirar o valor do enum forçaria uma migration de contrato quando KAN-4 trouxer a tela de regra; deixá-lo é barato e honesto desde que a spec diga que ninguém o emite ainda.
