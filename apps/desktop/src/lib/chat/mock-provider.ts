import { replyAuthorLabel, truncateReplyContent } from "@/lib/chat/chat-state";
import type { ChatReplyRef } from "@/lib/chat/types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBaseResponse(userMessage: string): string {
  const trimmed = userMessage.trim();

  if (!trimmed) {
    return "Não entendi a mensagem. Pode reformular?";
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes("olá") || lower.includes("ola") || lower.includes("oi")) {
    return "Olá! Sou o assistente do Linvo Desktop. Como posso ajudar no seu atendimento hoje?";
  }

  if (lower.includes("ajuda") || lower.includes("help")) {
    return "Posso ajudar com dúvidas sobre atendimento, procedimentos e orientações gerais. A integração com IA real será configurada em breve nas configurações.";
  }

  return `Entendi sua mensagem: "${trimmed}". Por enquanto estou em modo demonstração — em breve terei acesso ao provedor de IA configurado nas settings.`;
}

function buildMockResponse(userMessage: string, replyTo?: ChatReplyRef): string {
  const base = buildBaseResponse(userMessage);

  if (!replyTo) return base;

  const author = replyAuthorLabel(replyTo.role);
  const excerpt = truncateReplyContent(replyTo.content, 80);

  return `Em resposta à mensagem de ${author} ("${excerpt}"): ${base}`;
}

export async function* streamMockResponse(
  userMessage: string,
  signal?: AbortSignal,
  replyTo?: ChatReplyRef,
): AsyncGenerator<string> {
  const response = buildMockResponse(userMessage, replyTo);
  const tokens = response.split(/(\s+)/).filter((part) => part.length > 0);

  for (const token of tokens) {
    if (signal?.aborted) return;
    await delay(25 + Math.floor(Math.random() * 35));
    yield token;
  }
}
