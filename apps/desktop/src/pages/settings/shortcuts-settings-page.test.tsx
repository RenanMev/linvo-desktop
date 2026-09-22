import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShortcutsSettingsPage } from "@/pages/settings/shortcuts-settings-page";
import {
  getStoredPushToTalkShortcut,
  PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT,
} from "@/lib/voice/push-to-talk-shortcut";

describe("ShortcutsSettingsPage (KAN-42)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mostra o padrão Ctrl + Space e os fixos", () => {
    render(<ShortcutsSettingsPage />);

    expect(
      screen.getByRole("button", { name: /Atalho atual Ctrl \+ Space/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mostrar ou ocultar o Assist")).toBeInTheDocument();
    expect(screen.getByText("Ctrl + Shift + L")).toBeInTheDocument();
  });

  it("captura a combinação pressionada, persiste e avisa a barra", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener(PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT, changed);
    render(<ShortcutsSettingsPage />);

    const trigger = screen.getByRole("button", { name: /Atalho atual/ });
    await user.click(trigger);
    expect(
      screen.getByRole("button", { name: "Pressione a nova combinação" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Pressione a nova combinação" }), {
      key: "v",
      code: "KeyV",
      altKey: true,
    });

    expect(getStoredPushToTalkShortcut()).toBe("Alt+V");
    expect(changed).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Atalho atual Alt \+ V/ }),
    ).toBeInTheDocument();

    // Voltar ao padrão remove a preferência.
    await user.click(screen.getByRole("button", { name: "Padrão" }));
    expect(getStoredPushToTalkShortcut()).toBe("CommandOrControl+Space");
    window.removeEventListener(PUSH_TO_TALK_SHORTCUT_CHANGED_EVENT, changed);
  });

  it("recusa atalho já usado pelo app e tecla sem modificador", async () => {
    const user = userEvent.setup();
    render(<ShortcutsSettingsPage />);
    await user.click(screen.getByRole("button", { name: /Atalho atual/ }));
    const capture = screen.getByRole("button", { name: "Pressione a nova combinação" });

    fireEvent.keyDown(capture, { key: "L", code: "KeyL", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent(/já é usado pelo Linvo/);
    expect(getStoredPushToTalkShortcut()).toBe("CommandOrControl+Space");

    // Letra solta não vira atalho global: segue capturando, sem erro novo.
    fireEvent.keyDown(capture, { key: "v", code: "KeyV" });
    expect(getStoredPushToTalkShortcut()).toBe("CommandOrControl+Space");
    expect(
      screen.getByRole("button", { name: "Pressione a nova combinação" }),
    ).toBeInTheDocument();
  });
});
