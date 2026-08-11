# Spec — Select View Context (Backend / API)

**Feature:** anexar contexto visual (screenshot de janela/aba/tela) a uma mensagem de chat  
**Repos:** `linvo-api` + contratos em `@linvo/shared`  
**Cliente consumidor:** Linvo Desktop (`apps/desktop`)  
**Status:** proposta  
**Dependência cruzada:** [select-view-context-frontend.md](./select-view-context-frontend.md)

---

## 1. Objetivo

Permitir que o usuário envie **uma ou mais imagens de contexto** junto com a mensagem de texto, para o modelo (vision/multimodal) usar no raciocínio da resposta.

No MVP o cliente captura um print via picker do SO; o backend deve:

1. Aceitar upload de imagem autenticado.
2. Associar a imagem à mensagem do usuário.
3. Encaminhar a imagem ao provedor LLM multimodal.
4. Devolver a mensagem persistida com metadados do anexo (sem binário no SSE).

---

## 2. Fora de escopo (backend)

- OCR no servidor (pode ser fase 2).
- Extração de texto via UI Automation / DOM do browser.
- Anexos de vídeo, PDF ou áudio neste endpoint (PDF já existe como *artifact* de saída).
- Capacidade de “selecionar aba” — isso é 100% cliente/OS.
- Persistência eterna de prints em CDN pública sem auth.

---

## 3. Contexto atual (baseline)

Hoje em `@linvo/shared` (`packages/shared/src/chat.ts`):

| Contrato | Limitação |
|----------|-----------|
| `sendMessageInputSchema` | só `content: string` (obrigatório) |
| `messageSchema` | só texto; `artifacts` são PDF de saída |
| `POST /api/conversations/:id/messages` | JSON + SSE; sem multipart |

Referência de upload existente: `POST /api/workspaces/:id/procedures` com `FormData` (vídeo). Reutilizar o mesmo padrão de auth + multipart.

---

## 4. Decisão de desenho

### 4.1 Upload separado + referência na mensagem

Fluxo escolhido (em vez de multipart no send SSE):

```
1. POST /api/conversations/:conversationId/attachments  (multipart)
2. POST /api/conversations/:conversationId/messages     (JSON + attachmentIds)
3. SSE stream da resposta (inalterado em formato)
```

**Por quê**

- Mantém o stream SSE em JSON puro.
- Permite retry do send sem reenviar o binário.
- Alinha com o padrão de procedure (`FormData` + JSON depois).
- Facilita validação de tamanho/MIME antes de criar a mensagem.

### 4.2 Conteúdo da mensagem

- `content` continua sendo string.
- No MVP: **exige pelo menos um de** `content` não vazio **ou** `attachmentIds.length >= 1`.
- Se só houver imagem, `content` pode ser `""` ou um placeholder interno; o schema público deve aceitar `content` vazio quando houver anexo.

---

## 5. Contratos (`@linvo/shared`)

Atualizar `packages/shared/src/chat.ts` (fonte canônica) e publicar/rebuild para o `linvo-api`.

### 5.1 Attachment

```ts
export const messageAttachmentKindSchema = z.literal("image");

export const messageAttachmentSchema = z.object({
  id: z.string(),
  kind: messageAttachmentKindSchema,
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  // URL autenticada ou path relativo resolvido pelo cliente
  url: z.string().url().optional(),
});
```

### 5.2 Message

Estender `messageSchema`:

```ts
attachments: z.array(messageAttachmentSchema).optional(),
```

### 5.3 Send message input

```ts
export const sendMessageInputSchema = z
  .object({
    content: z.string().trim().default(""),
    replyToMessageId: z.string().optional(),
    deskState: deskStateSchema.optional(),
    model: z.string().trim().min(1).optional(),
    forceTool: forceToolSchema.optional(),
    attachmentIds: z.array(z.string().min(1)).max(4).optional(),
  })
  .refine(
    (value) => value.content.length > 0 || (value.attachmentIds?.length ?? 0) > 0,
    { message: "informe uma mensagem ou um anexo" },
  );
```

### 5.4 Upload response

```ts
export const chatAttachmentUploadResponseSchema = z.object({
  attachment: messageAttachmentSchema,
});
```

---

## 6. Endpoints

### 6.1 Upload de anexo

```
POST /api/conversations/:conversationId/attachments
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Campos**

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `file` | binary | sim | único arquivo por request no MVP |
| `kind` | string | não | default `image` |
| `source` | string | não | hint do cliente: `display_capture` \| `clipboard` \| `file` |

**Resposta `201`**

```json
{
  "attachment": {
    "id": "att_…",
    "kind": "image",
    "mimeType": "image/png",
    "filename": "context-2026-08-11.png",
    "sizeBytes": 248133,
    "width": 1440,
    "height": 900
  }
}
```

**Erros**

| Status | Quando |
|--------|--------|
| `400` | MIME inválido, arquivo corrompido, campos ausentes |
| `401` | sem sessão |
| `403` | conversa de outro usuário |
| `404` | conversa inexistente |
| `413` | acima do limite de tamanho |
| `415` | content-type não suportado |
| `429` | rate limit de uploads |

### 6.2 Enviar mensagem (existente, estendido)

```
POST /api/conversations/:conversationId/messages
Content-Type: application/json
Accept: text/event-stream
```

**Body (delta)**

```json
{
  "content": "o que está errado nessa tela?",
  "attachmentIds": ["att_…"],
  "model": "…",
  "deskState": { "screenKey": "chat" }
}
```

**Regras**

1. Todos os `attachmentIds` devem existir, pertencer à mesma conversa e ao mesmo usuário.
2. Anexo só pode ser referenciado **uma vez** (marcar como `consumed` ao criar a mensagem).
3. Anexos órfãos (upload sem send) expiram em **24h** (job/TTL).
4. Evento SSE `user_message` deve incluir `attachments` no payload `message`.

### 6.3 Download / leitura do anexo (opcional no MVP, recomendado)

```
GET /api/conversations/:conversationId/attachments/:attachmentId
Authorization: Bearer <accessToken>
```

- Retorna o binário com `Content-Type` correto.
- Necessário para o desktop renderizar histórico após reload (se não embutir data-URL).

---

## 7. Limites (MVP)

| Limite | Valor sugerido |
|--------|----------------|
| MIME | `image/png`, `image/jpeg`, `image/webp` |
| Tamanho por arquivo | 5 MiB |
| Anexos por mensagem | 1 (MVP) / até 4 (schema) |
| Dimensão máxima | redimensionar server-side se > 2048px no maior lado |
| Uploads / minuto / usuário | 20 |

Redimensionamento: preservar aspect ratio; normalizar para JPEG/WebP se PNG for muito grande (manter `mimeType` final no registro).

---

## 8. Persistência

Sugestão de modelo:

```
ChatAttachment {
  id
  conversationId
  userId
  kind: "image"
  mimeType
  filename
  sizeBytes
  width?
  height?
  storageKey          // S3/local path
  status: "pending" | "attached" | "expired"
  messageId?          // preenchido ao consumir
  source?             // display_capture | clipboard | file
  createdAt
  expiresAt           // só para pending
}
```

Mensagem do usuário passa a guardar relação `attachments[]` (IDs ou join).

---

## 9. Integração com LLM

1. Resolver `attachmentIds` → bytes (ou URL assinada interna).
2. Montar prompt multimodal do provedor (ex.: content parts `text` + `image`).
3. Se o modelo selecionado **não** for vision-capable:
   - **Opção A (preferida MVP):** rejeitar com `400` / evento `error` código `model_not_multimodal`.
   - **Opção B (fase 2):** OCR server-side e injetar texto no prompt.
4. Tools existentes (`web_search`, `search_knowledge`, etc.) continuam iguais; a imagem é contexto da pergunta, não uma tool nova.

Novo código de erro sugerido em `chatErrorCodeSchema`:

```ts
"model_not_multimodal"
"attachment_invalid"
"attachment_too_large"
```

---

## 10. Segurança e privacidade

- Auth obrigatória em upload e download.
- Attachment isolado por `userId` + `conversationId`.
- Não logar bytes da imagem; no máximo `attachmentId`, MIME e size.
- Storage privado (não público sem assinatura).
- Sanitizar filename (sem path traversal).
- Varredura básica de magic bytes (não confiar só na extensão).
- Considerar retenção: anexos de conversa seguem política de retenção da conversa; pending TTL 24h.

---

## 11. Compatibilidade

- Clientes antigos que não enviam `attachmentIds` seguem funcionando.
- Mensagens antigas sem `attachments` continuam válidas (`optional`).
- `@linvo/shared` deve ser atualizado **antes** do deploy do desktop que depende do campo.

Ordem sugerida:

1. Shared + API (backward compatible).
2. Desktop consome upload + send com attachments.

---

## 12. Critérios de aceite (backend)

- [ ] Upload PNG/JPEG/WebP autenticado retorna `attachment.id`.
- [ ] Send com `attachmentIds` cria `user_message` com `attachments` no SSE.
- [ ] Modelo vision recebe a imagem e responde com base nela.
- [ ] Modelo sem vision falha de forma explícita (`model_not_multimodal`).
- [ ] Anexo de outra conversa / outro user → `403`/`404`.
- [ ] Arquivo > 5 MiB → `413`.
- [ ] MIME inválido → `400`/`415`.
- [ ] Reuso do mesmo `attachmentId` em segunda mensagem → rejeitado.
- [ ] Pending sem send expira em 24h.
- [ ] Schemas Zod em `@linvo/shared` cobertos por testes.
- [ ] Testes de integração API cobrindo upload → send → stream.

---

## 13. Test plan (API)

1. Upload válido → 201 + metadados.
2. Upload MIME inválido → 4xx.
3. Upload oversized → 413.
4. Send só texto (regressão) → OK.
5. Send só `attachmentIds` sem texto → OK.
6. Send com id inexistente → 400.
7. Send com id já consumido → 400.
8. Stream `user_message.attachments` presente.
9. Modelo non-vision → erro tipado.
10. GET attachment (se implementado) com auth OK / sem auth 401.

---

## 14. Fases

| Fase | Entrega |
|------|---------|
| **MVP** | Upload image, 1 anexo/msg, send com `attachmentIds`, vision no LLM, schemas shared |
| **1.1** | GET attachment, até 4 imagens, redimensionamento agressivo |
| **2** | OCR fallback para modelos sem vision |
| **3** | Anexos de clipboard image / file picker genérico (mesmo endpoint) |

---

## 15. Open questions

1. Storage: disco local da API vs S3/R2 já usado em documents/procedures?
2. Modelos do catálogo `GET llm models`: marcar `supportsVision: boolean`?
3. Precisa de thumbnail separado ou o cliente redimensiona para preview?
4. Mensagem regenerada (`/regenerate`) deve reenviar as imagens do user message pai? (recomendação: **sim**)
