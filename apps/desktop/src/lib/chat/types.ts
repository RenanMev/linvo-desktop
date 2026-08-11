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

/** Anexo gerado por uma tool e exibido como card na mensagem. */
export type ChatArtifact = {
  id: string;
  kind: "pdf";
  title: string;
  filename: string;
  sizeBytes: number;
  pageCount?: number;
};

export type ChatAttachment = {
  id: string;
  kind: "image";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  url?: string;
};

export type ChatSendAttachment = {
  file: File;
  width: number;
  height: number;
  previewUrl: string;
  sourceLabel?: string;
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
  artifacts?: ChatArtifact[];
  attachments?: ChatAttachment[];
  reasoning?: string;
  model?: string;
};
