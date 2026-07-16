export type ChatRole = "user" | "assistant";

export type ChatMessageStatus = "streaming" | "done" | "error" | "awaiting_tool";

export type ChatToolRequest = {
  requestId: string;
  name: string;
  label: string;
  args: Record<string, unknown>;
  requiresApproval: boolean;
};

export type ChatReplyRef = {
  id: string;
  role: ChatRole;
  content: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  replyTo?: ChatReplyRef;
  toolUses?: { name: string; label: string }[];
};
