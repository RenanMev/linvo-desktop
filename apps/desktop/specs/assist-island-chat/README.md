# Assist como chat live (KAN-3)

Status: Draft
Version: 0.1
Last updated: 2026-09-11
Jira: [KAN-3](https://linvoai.atlassian.net/browse/KAN-3)

O Quick Center deixa de ser um prompt descartável. A ilha flutuante (380×520) vira o chat de atendimento: stream, parar, anexos. Histórico longo continua no painel.

Não há `plan.md` nesta pasta. Gate 1 fechado. Implementação = Gate 2, fatia a fatia em `tdd.md`.

## Ordem de leitura

| # | Documento | O que responde |
|---|-----------|----------------|
| — | [`research.md`](research.md) | Como está **hoje** na branch. Baseline F-1..F-23 (F-19..F-23 são do `linvo-api` e do mapeamento) |
| — | [`decision_log.md`](decision_log.md) | D-1..D-16, todas fechadas |
| 1 | [`spec.md`](spec.md) | Comportamento, ACs, mapa de arquivos |
| 2 | [`data-model.md`](data-model.md) | Store da ilha, schema `citations`, migration do `Message` na API |
| 3 | [`tdd.md`](tdd.md) | Ordem red → green, arquivos de teste, asserts |

**Se você só vai ler um:** `spec.md`. **Se vai implementar:** `tdd.md`.

## User stories

**Primary**

Como atendente, quero conversar com o Linvo na ilha (perguntar, ver a resposta chegar, parar, anexar um print) sem abrir o painel.

Como atendente, quero copiar a resposta e colar no canal, e começar outra pergunta sem uma lista de 40 threads na ilha.

**Secondary**

Como atendente, quero que “Abrir chat” na bandeja abra o Assist, não a janela grande.

Como atendente, quero ver de onde veio a resposta: a API passa a marcar os documentos que ela consultou, e a ilha mostra isso como chips clicáveis.

## Histórias Jira cobertas

| Key | Resumo | Papel nesta spec |
|-----|--------|------------------|
| KAN-26 | Stream 380×520, `useChat`, markdown, parar, capture chip | MUST |
| KAN-27 | Uma conversa agora, sem sidebar, Nova pergunta | MUST |
| KAN-28 | Tray abre Assist; workspace é item separado | MUST |
| KAN-29 | Citações na resposta live | MUST — shared + API emite + chips |
| KAN-30 | 3 bullets do print antes da resposta | MUST — API paralelo no mesmo SSE; UI colapsável |
| KAN-31 | Rename Quick Center → Assist | MUST (strings visíveis) |
| KAN-18 | Sem `openPanel("/chat")` no happy path | MUST na ilha (overlap KAN-2) |
| KAN-19 | Copiar como CTA primário | MUST na ilha (overlap KAN-2; regressão da migração) |

## Boundaries

**Always do**
- Chat live na janela `main` (ilha). Painel fechado no caminho feliz
- Um runtime: `useChat` + `ChatPanel`. Sem segundo cliente SSE
- Teste vermelho antes do código de cada fatia (`tdd.md`)
- Copy em PT-BR, sem jargão LLM

**Ask first**
- Dependência npm nova
- Mudança de contrato HTTP obrigatória (além de campos opcionais)
- Extração de print **sequencial** na API (antes de abrir o stream da fala)

**Never do**
- Reabrir o `QuickCenterPanel` / `useQuickPrompt` como chat da ilha
- Sidebar de threads na ilha
- `openPanel("/chat")` no send, no stream ou no Copiar
- Morph/envelope da ilha (já é o SDD da branch atual)
- LLM no desktop para resumir print
- “Não encontrei na base” em mensagem sem busca
- Colapsar `citations: []` em `null` / `undefined` em qualquer camada (D-15)

## Out of scope (v1)

- KAN-4 — painel como workspace (sidebar, rotas, home do turno)
- KAN-5 — checklist de procedimento na ilha (execução; slash pode delegar)
- KAN-6 — voz
- KAN-2 restante — atalho global capturar-e-perguntar, devolver foco pós-Copiar, telemetria 10s (a ilha só reusa o capture chip)
- Morph / `SDD-ILHA-ENVELOPE.md`
- Deep-link `knowledge/:id` / tela de documento canônico (KAN-4)
- Pgvector / retrieval híbrido (spec própria; KAN-29 cita o retriever atual)
- Apagar `useQuickPrompt` do onboarding

## Gates

- [ ] **Gate R** — `research.md` aceito (F-1..F-23 batem com o código)
- [x] **Gate 1** — D-1..D-16 fechadas (2026-09-11)
- [ ] **Gate 2** — implementação, fatia a fatia, testes primeiro (desktop + `linvo-api`, incluindo a migration do `Message`)
- [ ] **Gate T** — testes desktop **e** API do turno SSE verdes; nenhum `"Quick Center"` visível; `rg openPanel(\"/chat` no caminho de send da ilha vazio

## Decisões fechadas (antes abertas)

| Onde | Decisão |
|------|---------|
| D-10 | API gera bullets em **paralelo** ao stream; timeout omite; desktop não chama LLM |
| D-11 | `[]` = miss de busca → “Não encontrei na base”. Omitido = nada |
| D-14 | Clique vai à lista do kind que já existe; sem `knowledge/:id` na v1 |
| D-15 | `Message` ganha 2 colunas; `citations` não usa o idioma `DbNull` de `toolUses` |
| D-16 | `rule` fica no enum, mas sem emissor na v1 (regra não passa por busca) |
