import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPublic } from "@linvo/shared";

import { QuickCenterPanel } from "@/components/quick-center/quick-center-panel";
import { useQuickCenterWorkspace } from "@/hooks/use-quick-center-workspace";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";
import { writeClipboardText } from "@/lib/clipboard";
import { openPanel } from "@/lib/panel-window";

vi.mock("@/hooks/use-quick-prompt", () => ({
  useQuickPrompt: vi.fn(),
}));

vi.mock("@/hooks/use-quick-center-workspace", () => ({
  useQuickCenterWorkspace: vi.fn(() => ({ name: "Acme", isLoading: false })),
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/clipboard", () => ({
  writeClipboardText: vi.fn(() => Promise.resolve(true)),
}));

const user: UserPublic = {
  id: "user-1",
  email: "a@b.com",
  name: "Ana",
} as UserPublic;

function makePrompt(overrides: Partial<ReturnType<typeof useQuickPrompt>> = {}) {
  return {
    status: "idle" as const,
    responseText: "",
    errorMessage: null,
    conversationId: null,
    isThinking: false,
    send: vi.fn(() => Promise.resolve(true)),
    stop: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderPanel(overrides: Partial<ComponentProps<typeof QuickCenterPanel>> = {}) {
  return render(
    <QuickCenterPanel
      apiHealthy
      sessionWarning={null}
      user={user}
      ready
      onClose={vi.fn()}
      onOpenSettings={vi.fn()}
      onHide={vi.fn()}
      {...overrides}
    />,
  );
}

describe("QuickCenterPanel", () => {
  beforeEach(() => {
    vi.mocked(useQuickCenterWorkspace).mockClear();
    vi.mocked(useQuickCenterWorkspace).mockReturnValue({
      name: "Acme",
      isLoading: false,
    });
    vi.mocked(openPanel).mockClear();
    vi.mocked(writeClipboardText).mockClear();
  });

  it("focuses the prompt field on mount when ready", () => {
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt());
    renderPanel();

    expect(
      screen.getByRole("dialog", { name: "Quick Center" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Pergunta/ }),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Pergunte alguma coisa..."),
    );
  });

  it("does not focus or fetch the workspace while not ready", () => {
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt());
    renderPanel({ ready: false });

    expect(document.activeElement).not.toBe(
      screen.getByPlaceholderText("Pergunte alguma coisa..."),
    );
    expect(useQuickCenterWorkspace).toHaveBeenCalledWith(false);
  });

  it("sends the typed text and shows Parar while streaming", async () => {
    const send = vi.fn(() => Promise.resolve(true));
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));
    const userEventInstance = userEvent.setup();

    renderPanel();

    const field = screen.getByPlaceholderText("Pergunte alguma coisa...");
    await userEventInstance.type(field, "olá");
    await userEventInstance.click(screen.getByRole("button", { name: "Enviar" }));

    expect(send).toHaveBeenCalledWith("olá");
    expect(field).toHaveValue("");
  });

  it("preserves the typed text when the request is not accepted", async () => {
    const send = vi.fn(() => Promise.resolve(false));
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));
    const userEventInstance = userEvent.setup();

    renderPanel();

    const field = screen.getByPlaceholderText("Pergunte alguma coisa...");
    await userEventInstance.type(field, "mensagem importante");
    await userEventInstance.click(screen.getByRole("button", { name: "Enviar" }));

    expect(field).toHaveValue("mensagem importante");
  });

  it("shows the Parar button and calls stop() while streaming", async () => {
    const stop = vi.fn();
    vi.mocked(useQuickPrompt).mockReturnValue(
      makePrompt({ status: "streaming", isThinking: true, stop }),
    );
    const userEventInstance = userEvent.setup();

    renderPanel();

    await userEventInstance.click(screen.getByRole("button", { name: "Parar" }));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("shows Copiar and Abrir no chat once the answer is done", async () => {
    vi.mocked(useQuickPrompt).mockReturnValue(
      makePrompt({
        status: "done",
        responseText: "resposta final",
        conversationId: "conv-1",
      }),
    );
    const userEventInstance = userEvent.setup();

    renderPanel();

    expect(screen.getByText("resposta final")).toBeInTheDocument();

    await userEventInstance.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeClipboardText).toHaveBeenCalledWith("resposta final");

    await userEventInstance.click(
      screen.getByRole("button", { name: "Abrir no chat" }),
    );
    expect(openPanel).toHaveBeenCalledWith("/chat/conv-1", user);
  });

  it("Abrir no painel opens the panel at /chat and closes the menu", async () => {
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt());
    const onClose = vi.fn();
    const userEventInstance = userEvent.setup();

    renderPanel({ onClose });

    await userEventInstance.click(
      screen.getByRole("button", { name: "Abrir no painel" }),
    );

    expect(openPanel).toHaveBeenCalledWith("/chat", user);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc calls stop() when streaming and always closes", async () => {
    const stop = vi.fn();
    const onClose = vi.fn();
    vi.mocked(useQuickPrompt).mockReturnValue(
      makePrompt({ status: "streaming", stop }),
    );
    const userEventInstance = userEvent.setup();

    renderPanel({ onClose });

    await userEventInstance.keyboard("{Escape}");

    expect(stop).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the prompt field when the API is unavailable", () => {
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt());
    renderPanel({ apiHealthy: false });

    expect(screen.getByPlaceholderText("Pergunte alguma coisa...")).toBeDisabled();
    expect(screen.getByText("API indisponível")).toBeInTheDocument();
  });
});
