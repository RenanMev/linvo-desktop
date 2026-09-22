import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateAudioFile } from "@/lib/voice/audio-file";
import {
  DEFAULT_PUSH_TO_TALK_SHORTCUT,
  FALLBACK_PUSH_TO_TALK_SHORTCUT,
  formatShortcut,
  getStoredPushToTalkShortcut,
  isValidShortcut,
  pushToTalkShortcutCandidates,
  setStoredPushToTalkShortcut,
  shortcutFromKeyboardEvent,
  subscribePushToTalkShortcut,
} from "@/lib/voice/push-to-talk-shortcut";

describe("push-to-talk shortcut store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("padrão Ctrl+Space; reserva Ctrl+Shift+Space vem depois na ordem de tentativa", () => {
    expect(getStoredPushToTalkShortcut()).toBe(DEFAULT_PUSH_TO_TALK_SHORTCUT);
    expect(pushToTalkShortcutCandidates(DEFAULT_PUSH_TO_TALK_SHORTCUT)).toEqual([
      "CommandOrControl+Space",
      "CommandOrControl+Shift+Space",
    ]);
    expect(pushToTalkShortcutCandidates("Alt+V")).toEqual([
      "Alt+V",
      "CommandOrControl+Space",
      "CommandOrControl+Shift+Space",
    ]);
  });

  it("persiste a preferência (o aviso por evento é coberto na página de Atalhos, em jsdom)", () => {
    // Ambiente node: sem window, subscribe é no-op e não pode quebrar.
    expect(subscribePushToTalkShortcut(vi.fn())).toBeTypeOf("function");

    setStoredPushToTalkShortcut("Alt+V");

    expect(getStoredPushToTalkShortcut()).toBe("Alt+V");

    setStoredPushToTalkShortcut(null);
    expect(getStoredPushToTalkShortcut()).toBe(DEFAULT_PUSH_TO_TALK_SHORTCUT);
    expect(localStorage.getItem("linvo.pushToTalkShortcut")).toBeNull();
  });

  it("valor inválido no storage cai no padrão", () => {
    localStorage.setItem("linvo.pushToTalkShortcut", "Space");
    expect(getStoredPushToTalkShortcut()).toBe(DEFAULT_PUSH_TO_TALK_SHORTCUT);
  });

  it("valida: modificador + tecla, e nunca um atalho já usado pelo app", () => {
    expect(isValidShortcut("CommandOrControl+Space")).toBe(true);
    expect(isValidShortcut(FALLBACK_PUSH_TO_TALK_SHORTCUT)).toBe(true);
    expect(isValidShortcut("Space")).toBe(false);
    expect(isValidShortcut("CommandOrControl+Shift")).toBe(false);
    expect(isValidShortcut("CommandOrControl+Shift+L")).toBe(false);
    expect(isValidShortcut("CommandOrControl+Shift+C")).toBe(false);
  });

  it("traduz keydown para o formato do plugin, ignorando tecla solta", () => {
    expect(
      shortcutFromKeyboardEvent({
        key: " ",
        code: "Space",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe("CommandOrControl+Space");
    expect(
      shortcutFromKeyboardEvent({
        key: "v",
        code: "KeyV",
        ctrlKey: false,
        metaKey: false,
        altKey: true,
        shiftKey: true,
      }),
    ).toBe("Alt+Shift+V");
    expect(
      shortcutFromKeyboardEvent({
        key: "v",
        code: "KeyV",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
    expect(
      shortcutFromKeyboardEvent({
        key: "Control",
        code: "ControlLeft",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });

  it("formata para exibir", () => {
    expect(formatShortcut("CommandOrControl+Shift+Space")).toBe("Ctrl + Shift + Space");
  });
});

describe("validateAudioFile", () => {
  it("aceita ogg/mp3/m4a e recusa formato, vazio e tamanho com mensagem clara", () => {
    expect(
      validateAudioFile(new File([new Uint8Array(10)], "PTT.ogg", { type: "audio/ogg" })),
    ).toEqual({ ok: true });
    expect(
      validateAudioFile(new File([new Uint8Array(10)], "voz.m4a", { type: "" })),
    ).toEqual({ ok: true });
    expect(
      validateAudioFile(new File([new Uint8Array(10)], "doc.pdf", { type: "application/pdf" })),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/OGG, MP3 ou M4A/) });
    expect(
      validateAudioFile(new File([], "vazio.mp3", { type: "audio/mpeg" })),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/vazio/) });
    const huge = new File([new Uint8Array(12 * 1024 * 1024 + 1)], "longo.mp3", {
      type: "audio/mpeg",
    });
    expect(validateAudioFile(huge)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/12MB/),
    });
  });
});
