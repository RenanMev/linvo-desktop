# Quick Center → Panel composer handoff

Status: Approved-by-delegation (user: "vc decide")
Version: 1.0
Last updated: 2026-08-17
Mode: Delta
Baseline: `research.md` + `research-handoff.md` (capture→QC shipped; handoff absent)

## Overview

Quando o usuário promove o Quick Center para o painel de chat, o texto digitado e o anexo de captura ainda não enviados devem aparecer no composer do painel. Conversas já criadas continuam abrindo pelo `conversationId`.

## User Stories

### Primary
Como atendente, quero abrir o painel a partir do Quick Center sem perder o que já digitei ou capturei, para continuar a pergunta com a UI completa do chat.

### Secondary
Como atendente, quero “Abrir no chat” após uma resposta e ainda levar um novo rascunho digitado no QC (se houver) para a mesma conversa.

## Boundaries

**Always do:**
- Reutilizar o padrão de evento Tauri main→panel (`emitTo` + `listen`), como `panel://session`
- Transferir apenas estado de composer não enviado (texto + pending ready)
- Preservar navegação existente `/chat` e `/chat/:id`

**Ask first:**
- Novo endpoint de API
- Persistência permanente de drafts no backend

**Never do:**
- Reimplementar captura do zero
- Quebrar auto-capture da barra (A2+C1)
- Compartilhar o mesmo hook `useDisplaySnapshot` entre janelas
- Comentários no código

## Acceptance Criteria

### AC-1: Draft text on Abrir no painel [MUST] [ADDED]
Given o Quick Center tem texto não vazio no input
When o usuário clica “Abrir no painel”
Then o painel abre em `/chat` (ou `/chat/:id` se já houver `conversationId` no prompt) e o composer do painel contém exatamente esse texto

### AC-2: Pending capture on Abrir no painel [MUST] [ADDED]
Given o Quick Center tem um pending de captura `status === "ready"` (com ou sem texto)
When o usuário clica “Abrir no painel”
Then o composer do painel mostra o chip/anexo equivalente (mesmas dimensões/metadata essenciais) pronto para enviar

### AC-3: Abrir no chat keeps conversation + draft [MUST] [ADDED]
Given o Quick Center tem `conversationId` (resposta concluída) e o usuário digitou texto novo e/ou tem pending ready
When o usuário clica “Abrir no chat”
Then o painel abre `/chat/:conversationId` e o composer recebe o texto e/ou pending transferidos

### AC-4: Empty handoff is a no-op [MUST] [ADDED]
Given não há texto e não há pending ready
When o usuário abre o painel pelo QC
Then o comportamento permanece o de hoje (só navega); nenhum anexo fantasma no composer

### AC-5: Handoff is one-shot [MUST] [ADDED]
Given um handoff foi aplicado no painel
When o usuário navega para outra conversa ou recarrega o composer
Then o handoff não reaparece automaticamente

### AC-6: QC may close after emit [SHOULD] [ADDED]
Given o handoff foi emitido com sucesso
When o QC fecha
Then a perda do estado local do QC é aceitável porque o painel já recebeu a cópia

### AC-E1: Panel not ready / listen late [MUST] [ADDED]
Given o painel ainda está subindo quando o evento chega
When o listener do painel monta
Then o handoff ainda é aplicado (buffer one-shot até consumo ou timeout curto ≤2s)

### AC-E2: Corrupt / oversized payload [MUST] [ADDED]
Given o payload de anexo está inválido ou falha ao reconstruir o File
When o painel tenta aplicar o handoff
Then o texto (se houver) ainda é aplicado e o erro de anexo não quebra o chat; sem crash

### AC-7: Streaming in QC [SHOULD] [ADDED]
Given o QC ainda está `streaming`
When o usuário abre o painel
Then handoff de draft/pending ocorre; stream do QC pode ser parado no close existente — sem exigir sync do stream no painel nesta iteração

### AC-8: Tray Abrir chat [WONT]
This feature will NOT change tray “Abrir chat”. Reason: sem composer state no tray; escopo é QC→panel.

### AC-9: Sync mid-stream tokens to panel [WONT]
This feature will NOT mirror the in-flight SSE into the panel composer. Reason: messages already persist via conversationId after send; mid-stream mirror is a later item (A7).

## Out of scope
- Multi-attachment handoff
- Clipboard/file sources besides pending display capture
- Shared localStorage between windows
- Backend draft API
