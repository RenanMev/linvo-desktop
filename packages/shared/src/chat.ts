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

export const toolRequestSchema = z.object({
  requestId: z.string(),
  name: z.string(),
  label: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  requiresApproval: z.boolean(),
});

export const toolResultInputSchema = z
  .object({
    requestId: z.string().min(1),
    approved: z.boolean(),
    result: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.approved && value.result === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "result é obrigatório quando approved é true",
        path: ["result"],
      });
    }
  });

export const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "Base de conhecimento",
  web_search: "Busca na internet",
  read_clipboard: "Área de transferência",
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
});

export const messageListSchema = z.object({
  messages: z.array(messageSchema),
});

export const sendMessageInputSchema = z.object({
  content: z.string().trim().min(1, "informe uma mensagem"),
  replyToMessageId: z.string().optional(),
});

export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type MessageReplyRef = z.infer<typeof messageReplyRefSchema>;
export type MessageToolUse = z.infer<typeof messageToolUseSchema>;
export type ToolRequest = z.infer<typeof toolRequestSchema>;
export type ToolResultInput = z.infer<typeof toolResultInputSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
