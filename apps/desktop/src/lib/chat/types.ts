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

export type ChatActivity = {
  id: string;
  label: string;
  status: "running" | "done";
  detail?: string;
  kind?: "research" | "tool" | "think";
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  replyTo?: ChatReplyRef;
  toolUses?: { name: string; label: string }[];
  activities?: ChatActivity[];
  reasoning?: string;
  model?: string;
};
