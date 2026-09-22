/*
 * Atalho do push-to-talk (KAN-42).
 *
 * Padrão Ctrl+Space; se o SO/outro app já tem esse, Ctrl+Shift+Space. O
 * usuário pode trocar em Configurações › Atalhos; a preferência fica no
 * localStorage da janela (mesma origem para barra e painel, então a página
 * de configurações grava e a barra lê).
 */
export const PUSH_TO_TALK_SHORTCUT_KEY = "linvo.pushToTalkShortcut";
export const PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT =
  "linvo:push-to-talk-shortcut-changed";

export const DEFAULT_PUSH_TO_TALK_SHORTCUT = "CommandOrControl+Space";
export const FALLBACK_PUSH_TO_TALK_SHORTCUT = "CommandOrControl+Shift+Space";

const MODIFIER_ORDER = ["CommandOrControl", "Alt", "Shift"] as const;
const MODIFIERS = new Set<string>(MODIFIER_ORDER);

/** Atalhos que o app já usa em outra função — não podem virar push-to-talk. */
const RESERVED_SHORTCUTS = new Set([
  "CommandOrControl+Shift+L",
  "CommandOrControl+Shift+C",
]);

export function getStoredPushToTalkShortcut(): string {
  try {
    const raw = localStorage.getItem(PUSH_TO_TALK_SHORTCUT_KEY);
    return raw && isValidShortcut(raw) ? raw : DEFAULT_PUSH_TO_TALK_SHORTCUT;
  } catch {
    return DEFAULT_PUSH_TO_TALK_SHORTCUT;
  }
}

export function setStoredPushToTalkShortcut(shortcut: string | null): void {
  try {
    if (!shortcut || shortcut === DEFAULT_PUSH_TO_TALK_SHORTCUT) {
      localStorage.removeItem(PUSH_TO_TALK_SHORTCUT_KEY);
    } else {
      localStorage.setItem(PUSH_TO_TALK_SHORTCUT_KEY, shortcut);
    }
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT));
  }
}

export function subscribePushToTalkShortcut(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === PUSH_TO_TALK_SHORTCUT_KEY || event.key === null) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT, listener);
  };
}

/**
 * Candidatos na ordem de tentativa: o escolhido e, se ele não registrar, o
 * reserva — nunca o mesmo duas vezes.
 */
export function pushToTalkShortcutCandidates(preferred: string): string[] {
  const list = [preferred, DEFAULT_PUSH_TO_TALK_SHORTCUT, FALLBACK_PUSH_TO_TALK_SHORTCUT];
  return list.filter((item, index) => list.indexOf(item) === index);
}

export function isValidShortcut(shortcut: string): boolean {
  const parts = shortcut.split("+");
  if (parts.length < 2) {
    return false;
  }
  const key = parts[parts.length - 1]!;
  const modifiers = parts.slice(0, -1);
  if (!key || MODIFIERS.has(key)) {
    return false;
  }
  if (modifiers.length === 0 || !modifiers.every((item) => MODIFIERS.has(item))) {
    return false;
  }
  return !RESERVED_SHORTCUTS.has(shortcut);
}

export function isReservedShortcut(shortcut: string): boolean {
  return RESERVED_SHORTCUTS.has(shortcut);
}

/**
 * Traduz um `keydown` para o formato do plugin de atalho global. Só tecla
 * "principal" com modificador — uma letra solta não vira atalho global.
 */
export function shortcutFromKeyboardEvent(event: {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): string | null {
  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("CommandOrControl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (modifiers.length === 0) {
    return null;
  }

  const key = keyNameFromEvent(event);
  if (!key) {
    return null;
  }
  const ordered = MODIFIER_ORDER.filter((item) => modifiers.includes(item));
  return [...ordered, key].join("+");
}

function keyNameFromEvent(event: { key: string; code: string }): string | null {
  if (event.code === "Space") return "Space";
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(event.code)) return event.code;
  return null;
}

/** "CommandOrControl+Space" → "Ctrl + Space" para exibir. */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => (part === "CommandOrControl" ? "Ctrl" : part))
    .join(" + ");
}
