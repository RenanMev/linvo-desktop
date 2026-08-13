import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPublic } from "@linvo/shared";

import { QuickCenterPanel } from "@/components/quick-center/quick-center-panel";
import type { DisplaySnapshotController } from "@/hooks/use-display-snapshot";
import { useQuickPrompt } from "@/hooks/use-quick-prompt";

const useDisplaySnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-display-snapshot", () => ({
  useDisplaySnapshot: useDisplaySnapshotMock,
}));

vi.mock("@/lib/context-capture/capture-sources", () => ({
  listCaptureSources: vi.fn(() => Promise.resolve([])),
}));

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

const capture = vi.fn();
const openPicker = vi.fn();
const closePicker = vi.fn();
const captureNativeSource = vi.fn();
const startMagneticCapture = vi.fn();
const confirmDraft = vi.fn();
const discardDraft = vi.fn();
const editPending = vi.fn();
const clear = vi.fn();
const clearError = vi.fn();

function controller(
  overrides: Partial<DisplaySnapshotController> = {},
): DisplaySnapshotController {
  return {
    pending: null,
    draft: null,
    isCapturing: false,
    isCropping: false,
    pickerOpen: false,
    error: null,
    capture,
    openPicker,
    closePicker,
    captureNativeSource,
    startMagneticCapture,
    confirmDraft,
    discardDraft,
    editPending,
    clear,
    clearError,
    ...overrides,
  };
}

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

function readyPending(overrides: Record<string, unknown> = {}) {
  return {
    localId: "local-1",
    file: new File(["image"], "context.png", { type: "image/png" }),
    previewUrl: "blob:preview",
    width: 800,
    height: 600,
    sourceLabel: "Browser",
    status: "ready" as const,
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<ComponentProps<typeof QuickCenterPanel>> = {},
) {
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

describe("QuickCenterPanel visual context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDisplaySnapshotMock.mockReturnValue(controller());
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt());
  });

  it("opens the native Rust source picker from the menu", async () => {
    const userEventInstance = userEvent.setup();
    renderPanel();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Capturar contexto visual" }),
    );
    await userEventInstance.click(
      await screen.findByRole("menuitem", { name: /Escolher janela ou tela/ }),
    );

    expect(openPicker).toHaveBeenCalledOnce();
  });

  it("starts magnetic capture and falls back to the system picker", async () => {
    const userEventInstance = userEvent.setup();
    renderPanel();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Capturar contexto visual" }),
    );
    await userEventInstance.click(
      await screen.findByRole("menuitem", { name: /Recorte magnético/ }),
    );
    expect(startMagneticCapture).toHaveBeenCalledOnce();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Capturar contexto visual" }),
    );
    await userEventInstance.click(
      await screen.findByRole("menuitem", { name: /Seletor do sistema/ }),
    );
    expect(capture).toHaveBeenCalledWith("window");
  });

  it("uses the shared snapshot hook without window-hiding hooks", () => {
    renderPanel();

    /*
     * Quem esconde e devolve as janelas em volta do overlay é o Rust — daqui só
     * vai o label, para o foco voltar para esta janela e não para o painel.
     */
    expect(useDisplaySnapshotMock).toHaveBeenCalledWith({ windowLabel: "main" });
  });

  it("sends the pending capture with the question and clears it after the send", async () => {
    const send = vi.fn(() => Promise.resolve(true));
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));
    const pending = readyPending();
    useDisplaySnapshotMock.mockReturnValue(controller({ pending }));
    const userEventInstance = userEvent.setup();

    renderPanel();

    expect(screen.getByText("Browser")).toBeInTheDocument();
    await userEventInstance.type(
      screen.getByPlaceholderText("Pergunte alguma coisa..."),
      "o que é isso",
    );
    await userEventInstance.click(screen.getByRole("button", { name: "Enviar" }));

    expect(send).toHaveBeenCalledWith("o que é isso", {
      attachment: {
        file: pending.file,
        width: 800,
        height: 600,
        previewUrl: "blob:preview",
        sourceLabel: "Browser",
      },
    });
    expect(clear).toHaveBeenCalledOnce();
  });

  it("keeps the pending capture when the send is refused", async () => {
    const send = vi.fn(() => Promise.resolve(false));
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));
    useDisplaySnapshotMock.mockReturnValue(
      controller({ pending: readyPending() }),
    );
    const userEventInstance = userEvent.setup();

    renderPanel();
    await userEventInstance.click(screen.getByRole("button", { name: "Enviar" }));

    expect(send).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
  });

  it("enables sending with an attachment and no text", () => {
    useDisplaySnapshotMock.mockReturnValue(
      controller({ pending: readyPending() }),
    );
    renderPanel();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });

  it("removes a pending capture without sending", async () => {
    const send = vi.fn(() => Promise.resolve(true));
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));
    useDisplaySnapshotMock.mockReturnValue(
      controller({ pending: readyPending() }),
    );
    const userEventInstance = userEvent.setup();

    renderPanel();
    await userEventInstance.click(screen.getByTitle("Remover contexto"));

    expect(clear).toHaveBeenCalledOnce();
    expect(clearError).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("reports capture activity so the window does not close on blur", async () => {
    const onCaptureActiveChange = vi.fn();
    const { rerender } = renderPanel({ onCaptureActiveChange });

    expect(onCaptureActiveChange).toHaveBeenLastCalledWith(false);

    useDisplaySnapshotMock.mockReturnValue(controller({ isCapturing: true }));
    rerender(
      <QuickCenterPanel
        apiHealthy
        sessionWarning={null}
        user={user}
        ready
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
        onHide={vi.fn()}
        onCaptureActiveChange={onCaptureActiveChange}
      />,
    );

    await waitFor(() =>
      expect(onCaptureActiveChange).toHaveBeenLastCalledWith(true),
    );
  });

  it("releases the capture lock when the panel unmounts", () => {
    const onCaptureActiveChange = vi.fn();
    useDisplaySnapshotMock.mockReturnValue(controller({ pickerOpen: true }));
    const { unmount } = renderPanel({ onCaptureActiveChange });

    expect(onCaptureActiveChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onCaptureActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("leaves Esc to the capture dialog instead of closing the window", async () => {
    const onClose = vi.fn();
    useDisplaySnapshotMock.mockReturnValue(controller({ pickerOpen: true }));
    const userEventInstance = userEvent.setup();

    renderPanel({ onClose });
    await userEventInstance.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(closePicker).toHaveBeenCalled();
  });

  it("shows capture errors and blocks the capture menu while busy", () => {
    useDisplaySnapshotMock.mockReturnValue(
      controller({
        isCapturing: true,
        error: "Não foi possível capturar a tela",
      }),
    );
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível capturar a tela",
    );
    expect(
      screen.getByRole("button", { name: "Capturar contexto visual" }),
    ).toBeDisabled();
  });

  it("starts magnetic capture when autoCaptureAndSend is armed", async () => {
    renderPanel({ autoCaptureAndSend: true });

    await waitFor(() => expect(startMagneticCapture).toHaveBeenCalledOnce());
  });

  it("does not start magnetic capture when autoCaptureAndSend is off", async () => {
    renderPanel({ autoCaptureAndSend: false });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Capturar contexto visual" }),
      ).toBeEnabled(),
    );
    expect(startMagneticCapture).not.toHaveBeenCalled();
  });

  it("auto-sends the capture and consumes the arm when the pending is ready", async () => {
    const send = vi.fn(() => Promise.resolve(true));
    const onAutoCaptureAndSendConsumed = vi.fn();
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));

    const { rerender } = renderPanel({
      autoCaptureAndSend: true,
      onAutoCaptureAndSendConsumed,
    });

    await waitFor(() => expect(startMagneticCapture).toHaveBeenCalledOnce());

    const pending = readyPending({ sourceLabel: "Recorte magnético" });
    useDisplaySnapshotMock.mockReturnValue(
      controller({ pending, isCapturing: false }),
    );
    rerender(
      <QuickCenterPanel
        apiHealthy
        sessionWarning={null}
        user={user}
        ready
        autoCaptureAndSend
        onAutoCaptureAndSendConsumed={onAutoCaptureAndSendConsumed}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
        onHide={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith("", {
        attachment: {
          file: pending.file,
          width: 800,
          height: 600,
          previewUrl: "blob:preview",
          sourceLabel: "Recorte magnético",
        },
      }),
    );
    expect(onAutoCaptureAndSendConsumed).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("consumes autoCaptureAndSend without sending when the crop is cancelled", async () => {
    const send = vi.fn(() => Promise.resolve(true));
    const onAutoCaptureAndSendConsumed = vi.fn();
    vi.mocked(useQuickPrompt).mockReturnValue(makePrompt({ send }));

    const { rerender } = renderPanel({
      autoCaptureAndSend: true,
      onAutoCaptureAndSendConsumed,
    });

    await waitFor(() => expect(startMagneticCapture).toHaveBeenCalledOnce());

    useDisplaySnapshotMock.mockReturnValue(controller({ isCapturing: true }));
    rerender(
      <QuickCenterPanel
        apiHealthy
        sessionWarning={null}
        user={user}
        ready
        autoCaptureAndSend
        onAutoCaptureAndSendConsumed={onAutoCaptureAndSendConsumed}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
        onHide={vi.fn()}
      />,
    );

    useDisplaySnapshotMock.mockReturnValue(controller({ isCapturing: false }));
    rerender(
      <QuickCenterPanel
        apiHealthy
        sessionWarning={null}
        user={user}
        ready
        autoCaptureAndSend
        onAutoCaptureAndSendConsumed={onAutoCaptureAndSendConsumed}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
        onHide={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(onAutoCaptureAndSendConsumed).toHaveBeenCalledOnce(),
    );
    expect(send).not.toHaveBeenCalled();
  });
});
