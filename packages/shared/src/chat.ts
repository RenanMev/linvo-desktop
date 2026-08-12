import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant"]);

export const messageStatusSchema = z.enum([
  "streaming",
  "done",
  "error",
  "awaiting_tool",
]);

export const messageReplyRefSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
});

export const messageToolUseSchema = z.object({
  name: z.string(),
  label: z.string(),
});

export const messageActivityStatusSchema = z.enum(["running", "done"]);

export const messageActivityKindSchema = z.enum(["research", "tool", "think"]);

export const messageActivitySchema = z.object({
  id: z.string(),
  label: z.string(),
  status: messageActivityStatusSchema,
  detail: z.string().optional(),
  kind: messageActivityKindSchema.optional(),
});

export const messageArtifactKindSchema = z.literal("pdf");

export const messageArtifactSchema = z.object({
  id: z.string(),
  kind: messageArtifactKindSchema,
  title: z.string(),
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().positive().optional(),
});

export const messageAttachmentKindSchema = z.literal("image");

export const messageAttachmentMimeTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const messageAttachmentSchema = z.object({
  id: z.string(),
  kind: messageAttachmentKindSchema,
  mimeType: messageAttachmentMimeTypeSchema,
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  url: z.string().url().optional(),
});

export const chatAttachmentUploadResponseSchema = z.object({
  attachment: messageAttachmentSchema,
});

export const reasoningChunkSchema = z.object({
  text: z.string(),
});

export const chatErrorCodeSchema = z.enum([
  "llm_error",
  "not_configured",
  "tool_expired",
  "aborted",
  "busy",
  "internal",
  "model_not_multimodal",
  "attachment_invalid",
  "attachment_too_large",
]);

export const chatErrorEventSchema = z.object({
  message: z.string(),
  code: chatErrorCodeSchema.optional(),
});

export const modelInfoSchema = z.object({
  model: z.string().trim().min(1),
});

export const toolRequestSchema = z.object({
  requestId: z.string(),
  name: z.string(),
  label: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  requiresApproval: z.boolean(),
});

export const deskOpenProcedureSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  stepCount: z.number().int().nonnegative().optional(),
  currentStepIndex: z.number().int().nonnegative().optional(),
  completedStepIndexes: z.array(z.number().int().nonnegative()).optional(),
});

export const deskStateSchema = z.object({
  openProcedure: deskOpenProcedureSchema.nullable().optional(),
  screenKey: z.string().trim().min(1).optional(),
});

// `result` é opcional mesmo com `approved: true`: tools com
// `executionTarget: "server"` são executadas pela API depois da aprovação e
// não recebem resultado do cliente. A obrigatoriedade para tools de cliente
// é verificada na API, que é quem conhece o pending.
export const toolResultInputSchema = z.object({
  requestId: z.string().min(1),
  approved: z.boolean(),
  result: z.string().optional(),
  deskState: deskStateSchema.optional(),
  model: z.string().trim().min(1).optional(),
});

export const llmModelOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

export const llmCredentialSourceSchema = z.enum([
  "user",
  "workspace",
  "platform",
]);

export const llmCredentialStatusSchema = z.object({
  hasApiKey: z.boolean(),
  keyHint: z.string().nullable(),
  model: z.string().nullable(),
});

export const llmCredentialEffectiveSchema = z.object({
  source: llmCredentialSourceSchema,
  model: z.string().min(1),
  modelSelectionEnabled: z.boolean(),
});

export const llmCredentialStatusResponseSchema = z.object({
  credential: llmCredentialStatusSchema,
  effective: llmCredentialEffectiveSchema.optional(),
});

export const upsertLlmCredentialInputSchema = z.object({
  apiKey: z.string().trim().min(1, "informe a API key"),
  model: z.string().trim().min(1).optional(),
});

export const updateLlmModelInputSchema = z.object({
  model: z.string().trim().min(1, "informe o modelo"),
});

export const llmModelsResponseSchema = z.object({
  models: z.array(llmModelOptionSchema).min(1),
  defaultModel: z.string().trim().min(1),
  modelSelectionEnabled: z.boolean().optional(),
  effectiveSource: llmCredentialSourceSchema.optional(),
});

export const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "Base de conhecimento",
  web_search: "Busca na internet",
  read_clipboard: "Área de transferência",
  create_procedure: "Criar procedimento",
  open_procedure: "Abrir procedimento",
  generate_pdf: "Gerar PDF",
};

export function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Ferramenta: ${name}`;
}

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const conversationListSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const messageSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  status: messageStatusSchema,
  createdAt: z.string(),
  replyTo: messageReplyRefSchema.optional(),
  toolUses: z.array(messageToolUseSchema).optional(),
  activities: z.array(messageActivitySchema).optional(),
  artifacts: z.array(messageArtifactSchema).optional(),
  attachments: z.array(messageAttachmentSchema).optional(),
  reasoning: z.string().optional(),
  model: z.string().optional(),
});

export const messageListSchema = z.object({
  messages: z.array(messageSchema),
});

export const forceToolSchema = z.enum(["web_search", "search_knowledge"]);

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
    (value) =>
      value.content.length > 0 || (value.attachmentIds?.length ?? 0) > 0,
    { message: "informe uma mensagem ou um anexo" },
  );

export const regenerateMessageInputSchema = z.object({
  model: z.string().trim().min(1).optional(),
  deskState: deskStateSchema.optional(),
});

export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type MessageReplyRef = z.infer<typeof messageReplyRefSchema>;
export type MessageToolUse = z.infer<typeof messageToolUseSchema>;
export type MessageActivityStatus = z.infer<typeof messageActivityStatusSchema>;
export type MessageActivityKind = z.infer<typeof messageActivityKindSchema>;
export type MessageActivity = z.infer<typeof messageActivitySchema>;
export type MessageArtifactKind = z.infer<typeof messageArtifactKindSchema>;
export type MessageArtifact = z.infer<typeof messageArtifactSchema>;
export type MessageAttachmentKind = z.infer<typeof messageAttachmentKindSchema>;
export type MessageAttachmentMimeType = z.infer<
  typeof messageAttachmentMimeTypeSchema
>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type ChatAttachmentUploadResponse = z.infer<
  typeof chatAttachmentUploadResponseSchema
>;
export type ReasoningChunk = z.infer<typeof reasoningChunkSchema>;
export type ChatErrorCode = z.infer<typeof chatErrorCodeSchema>;
export type ChatErrorEvent = z.infer<typeof chatErrorEventSchema>;
export type ModelInfo = z.infer<typeof modelInfoSchema>;
export type ToolRequest = z.infer<typeof toolRequestSchema>;
export type DeskOpenProcedure = z.infer<typeof deskOpenProcedureSchema>;
export type DeskState = z.infer<typeof deskStateSchema>;
export type ToolResultInput = z.infer<typeof toolResultInputSchema>;
export type LlmModelOption = z.infer<typeof llmModelOptionSchema>;
export type LlmModelsResponse = z.infer<typeof llmModelsResponseSchema>;
export type LlmCredentialSource = z.infer<typeof llmCredentialSourceSchema>;
export type LlmCredentialStatus = z.infer<typeof llmCredentialStatusSchema>;
export type LlmCredentialEffective = z.infer<
  typeof llmCredentialEffectiveSchema
>;
export type LlmCredentialStatusResponse = z.infer<
  typeof llmCredentialStatusResponseSchema
>;
export type UpsertLlmCredentialInput = z.infer<
  typeof upsertLlmCredentialInputSchema
>;
export type UpdateLlmModelInput = z.infer<typeof updateLlmModelInputSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ForceTool = z.infer<typeof forceToolSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type RegenerateMessageInput = z.infer<
  typeof regenerateMessageInputSchema
>;
