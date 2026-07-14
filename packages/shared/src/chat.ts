import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant"]);

export const messageStatusSchema = z.enum(["streaming", "done", "error"]);

export const messageReplyRefSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
});

export const messageToolUseSchema = z.object({
  name: z.string(),
  label: z.string(),
});

export const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "Base de conhecimento",
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
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
