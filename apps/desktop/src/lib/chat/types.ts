export type ChatRole = "user" | "assistant";

export type ChatMessageStatus = "streaming" | "done" | "error";

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
