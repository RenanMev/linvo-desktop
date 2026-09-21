import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Procedure, UserPublic } from "@linvo/shared";

import { BarApp } from "@/BarApp";
import { hideAllWindows, showMainBar } from "@/lib/app-windows";
import { expandFloatingToChecklist } from "@/lib/floating-checklist-mode";
import { collapseToEdge, expandFromEdge } from "@/lib/floating-edge-mode";
import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
import type { ChecklistWindowPayload } from "@/lib/checklist-window";
import { ISLAND_ENVELOPE_SIZE } from "@/lib/window-mode";
import {
  invokeMock,
  setMinSizeMock,
  setMaximizableMock,
  setResizableMock,
  windowMock,
} from "@/test/mocks/tauri";

vi.mock("@/hooks/use-floating-bootstrap", () => ({
  useFloatingBootstrap: () => ({ ready: true, growth: "down" }),
}));

vi.mock("@/hooks/use-overlay-chrome", () => ({
  useOverlayChrome: () => undefined,
}));

vi.mock("@/hooks/use-compact-click-through", () => ({
  useCompactClickThrough: () => undefined,
}));

vi.mock("@/hooks/use-api-health", () => ({
  useApiHealth: () => true,
}));

vi.mock("@/lib/floating-checklist-mode", () => ({
  expandFloatingToChecklist: vi.fn(() =>
    Promise.resolve({
      viewport: { width: 0, height: 0 },
      from: { x: 0, y: 0, width: 0, height: 0 },
      to: { x: 0, y: 0, width: 0, height: 0 },
    }),
  ),
  collapseChecklistToFloating: vi.fn(() =>
    Promise.resolve({
      viewport: { width: 0, height: 0 },
      from: { x: 0, y: 0, width: 0, height: 0 },
      to: { x: 0, y: 0, width: 0, height: 0 },
    }),
  ),
}));

vi.mock("@/lib/floating-quick-menu-mode", () => ({
  expandFloatingToQuickMenu: vi.fn(() =>
    Promise.resolve({
      viewport: { width: 0, height: 0 },
      from: { x: 0, y: 0, width: 0, height: 0 },
      to: { x: 0, y: 0, width: 0, height: 0 },
    }),
  ),
  collapseQuickMenuToFloating: vi.fn(() =>
    Promise.resolve({
      viewport: { width: 0, height: 0 },
      from: { x: 0, y: 0, width: 0, height: 0 },
      to: { x: 0, y: 0, width: 0, height: 0 },
    }),
  ),
}));

vi.mock("@/lib/floating-edge-mode", () => ({
  collapseToEdge: vi.fn(() =>
    Promise.resolve({ horizontal: "right", vertical: null }),
  ),
  expandFromEdge: vi.fn(() => Promise.resolve("down")),
}));

let payloadHandler:
  | ((payload: ChecklistWindowPayload) => void | Promise<void>)
  | null = null;
let assistContinueHandler:
  | ((payload: { conversationId: string }) => void)
  | null = null;

vi.mock("@/lib/assist-handoff", () => ({
  listenAssistContinue: vi.fn((handler) => {
    assistContinueHandler = handler;
    return Promise.resolve(() => {});
  }),
}));

vi.mock("@/lib/checklist-window", () => ({
  rememberChecklistConversation: vi.fn(),
  emitChecklistClosed: vi.fn(() => Promise.resolve()),
  emitChecklistProgress: vi.fn(() => Promise.resolve()),
  listenChecklistPayload: vi.fn((handler) => {
    payloadHandler = handler;
    return Promise.resolve(() => {});
  }),
  listenChecklistDismiss: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/chat/chat-api", () => ({
  createConversation: vi.fn(),
  listMessages: vi.fn(() => Promise.resolve([])),
  streamChatResponse: vi.fn(() => (async function* () {})()),
  submitToolResult: vi.fn(),
  regenerateMessage: vi.fn(),
}));

vi.mock("@/lib/chat/chat-local-store", () => ({
  hydrateChatLocalStore: vi.fn(() => Promise.resolve()),
  loadCachedConversationMessagesFromStore: vi.fn(() => Promise.resolve([])),
  saveCachedConversationMessages: vi.fn(),
}));

vi.mock("@/lib/chat/llm-models", () => ({
  fetchLlmModels: vi.fn(() => Promise.resolve([])),
  loadSelectedModel: vi.fn((fallback: string) => fallback),
  saveSelectedModel: vi.fn(),
}));

vi.mock("@/lib/llm/llm-credential-api", () => ({
  fetchUserLlmStatus: vi.fn(() =>
    Promise.resolve({
      hasOwnKey: false,
      effectiveSource: "workspace",
      modelSelectionEnabled: false,
    }),
  ),
}));

vi.mock("@/lib/app-windows", () => ({
  hideAllWindows: vi.fn(() => Promise.resolve()),
  hideMainBar: vi.fn(() => Promise.resolve()),
  showMainBar: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/context-capture/capture-sources", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/context-capture/capture-sources")
  >("@/lib/context-capture/capture-sources");
  return {
    ...actual,
    listCaptureSources: vi.fn(() => Promise.resolve([])),
  };
});

vi.mock("@/hooks/use-quick-prompt", () => ({
  useQuickPrompt: () => ({
    status: "idle",
    responseText: "",
    errorMessage: null,
    conversationId: null,
    isThinking: false,
    send: vi.fn(() => Promise.resolve(true)),
    stop: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-quick-center-workspace", () => ({
  useQuickCenterWorkspace: () => ({ name: "Acme", isLoading: false }),
}));

const user: UserPublic = {
  id: "user-1",
  email: "a@b.com",
  name: "Ana",
} as UserPublic;

const collapseGeometry = {
  viewport: { width: 380, height: 520 },
  from: { x: 0, y: 0, width: 380, height: 520 },
  to: { x: 106, y: 243, width: 168, height: 34 },
};

function makeChecklistPayload(): ChecklistWindowPayload {
  return {
    conversationId: "conv-1",
    procedure: {
      id: "proc-1",
      slug: "cancelamento",
      title: "Cancelamento",
      steps: ["Passo 1"],
    } as Procedure,
    progress: { completedStepIndexes: [], currentStepIndex: 0 },
  };
}

describe("BarApp window modes", () => {
  beforeEach(() => {
    payloadHandler = null;
    assistContinueHandler = null;
    localStorage.clear();
    vi.clearAllMocks();
    windowMock.outerSize.mockResolvedValue({ width: 140, height: 40 });
  });

  it("expands to the quick menu when Chat is clicked", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("does not arm auto-capture when Chat opens without Recorte", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    await waitFor(() => expect(setResizableMock).toHaveBeenCalledWith(true));

    expect(invokeMock).not.toHaveBeenCalledWith("capture_overlay_open");
  });

  it("opens the quick menu from Recorte to capture and send context", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Recorte" }),
    );

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("capture_overlay_open"),
    );
  });

  it("opens capture-and-ask from Ctrl+Shift+C with the Assist closed", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.keyboard("{Control>}{Shift>}c{/Shift}{/Control}");

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("capture_overlay_open"),
    );
  });

  it("KAN-33 Continuar no Assist vindo do painel expande a ilha fechada", async () => {
    render(<BarApp sessionWarning={null} user={user} />);

    await waitFor(() => expect(assistContinueHandler).not.toBeNull());
    await act(async () => {
      assistContinueHandler!({ conversationId: "conv-1" });
    });

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    expect(showMainBar).toHaveBeenCalled();
  });

  it("shows session expiry on the compact pill instead of a live green", () => {
    render(<BarApp sessionWarning="expired" user={user} />);

    expect(
      screen.getByRole("status", { name: "Sessão expirada" }),
    ).toBeInTheDocument();
  });

  it("keeps the Assist open when magnetic capture is cancelled", async () => {
    let cancelHandler: (() => void) | undefined;
    const captureSources = await import(
      "@/lib/context-capture/capture-sources"
    );
    vi.spyOn(captureSources, "listenOverlayCancel").mockImplementation(
      (handler) => {
        cancelHandler = handler;
        return Promise.resolve(() => {});
      },
    );
    vi.spyOn(captureSources, "listenOverlayResult").mockResolvedValue(() => {});
    vi.spyOn(captureSources, "openCaptureOverlay").mockResolvedValue(undefined);

    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Recorte" }),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    await waitFor(() => expect(cancelHandler).toBeDefined());

    act(() => {
      cancelHandler?.();
    });

    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Assist" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Pergunte qualquer coisa..."),
    ).toBeEnabled();
  });

  it("expands to the quick menu when the local shortcut is pressed", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.keyboard("{Control>}{Shift>}l{/Shift}{/Control}");

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("toggles the quick menu closed with the local shortcut", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.keyboard("{Control>}{Shift>}l{/Shift}{/Control}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
  });

  it("allows resizing only while the quick menu is open", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await waitFor(() => expect(setResizableMock).toHaveBeenCalledWith(false));
    await waitFor(() => expect(setMaximizableMock).toHaveBeenCalledWith(false));

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() => expect(setResizableMock).toHaveBeenCalledWith(true));
    expect(setMaximizableMock).toHaveBeenLastCalledWith(false);
    expect(setMinSizeMock).toHaveBeenCalledWith({
      width: 320,
      height: 360,
    });

    await userEventInstance.keyboard("{Escape}");

    await waitFor(() => {
      expect(setMinSizeMock).toHaveBeenCalledWith(null);
      expect(setResizableMock).toHaveBeenLastCalledWith(false);
    });
  });

  it("collapses the quick menu when it closes itself (Esc)", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.keyboard("{Escape}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toHaveFocus();
    });
  });

  it("still closes when animation frames are throttled", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    // BarApp agora prepara e dispara o morph sozinho, antes/depois de chamar
    // a lib (que só cuida de IPC) — o mock default já basta aqui.
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1);
    document.documentElement.dataset.reduceMotion = "true";

    await userEventInstance.click(
      screen.getByRole("button", { name: "Fechar Assist" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });

    requestFrame.mockRestore();
    delete document.documentElement.dataset.reduceMotion;
  });

  it("accepts close while the quick menu is still transitioning open", async () => {
    const expandGeometry = {
      viewport: collapseGeometry.viewport,
      from: collapseGeometry.to,
      to: collapseGeometry.from,
    };
    let finishExpand!: () => void;
    vi.mocked(expandFloatingToQuickMenu).mockImplementationOnce(
      async () => {
        await new Promise<void>((resolve) => {
          finishExpand = resolve;
        });
        return expandGeometry;
      },
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => expect(finishExpand).toBeTypeOf("function"));
    /*
     * O morph já foi preparado (mesmo tick de `setWindowMode`), mas a
     * expansão nativa segue presa em `finishExpand` — só a pílula/fonte
     * está acessível agora (o alvo não renderiza enquanto não assentar), daí
     * fechar pelo atalho de teclado em vez de clicar num botão que ainda não
     * existe no DOM.
     */
    await userEventInstance.keyboard("{Control>}{Shift>}l{/Shift}{/Control}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });
  });

  it("does not collapse the Assist on window blur", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    expect(windowMock.onFocusChanged).not.toHaveBeenCalled();
    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("does not collapse while the quick menu is capturing visual context", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.click(
      await screen.findByRole("button", { name: "Capturar contexto visual" }),
    );
    await userEventInstance.click(
      await screen.findByRole("menuitem", { name: /Escolher janela ou tela/ }),
    );
    await screen.findByRole("dialog", { name: "Selecionar fonte de captura" });

    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("does not collapse when dragging the Assist", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    fireEvent.pointerDown(screen.getByTitle("Mover"));

    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Assist" })).toBeInTheDocument();
  });

  it("returns to the action even if native collapse fails", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockRejectedValueOnce(
      new Error("collapse interrupted"),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.keyboard("{Escape}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });
  });

  it("returns to the action when native collapse never resolves", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockReturnValueOnce(
      new Promise<never>(() => {}),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.click(
      screen.getByRole("button", { name: "Fechar Assist" }),
    );

    await waitFor(
      () => {
        expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
      },
      { timeout: 1500 },
    );
  });

  it("collapses the quick menu before expanding the checklist when a payload arrives", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    expect(payloadHandler).not.toBeNull();
    await act(async () => {
      await payloadHandler!(makeChecklistPayload());
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Checklist do procedure")).toBeInTheDocument(),
    );
    expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1);
    expect(expandFloatingToChecklist).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
  });

  it("keeps checklist intent when blur races with quick-menu collapse", async () => {
    let finishCollapse!: () => void;
    vi.mocked(collapseQuickMenuToFloating).mockReturnValueOnce(
      new Promise((resolve) => {
        finishCollapse = () => resolve(collapseGeometry);
      }),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    let payloadPromise: void | Promise<void> = undefined;
    act(() => {
      payloadPromise = payloadHandler!(makeChecklistPayload());
    });
    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );

    act(() => {
      finishCollapse();
    });
    await act(async () => {
      await payloadPromise;
    });

    expect(
      screen.getByLabelText("Checklist do procedure"),
    ).toBeInTheDocument();
    expect(expandFloatingToChecklist).toHaveBeenCalledTimes(1);
  });

  it("does not touch quick-menu collapse when compact on checklist payload", async () => {
    render(<BarApp sessionWarning={null} user={user} />);

    expect(payloadHandler).not.toBeNull();
    await act(async () => {
      await payloadHandler!(makeChecklistPayload());
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Checklist do procedure")).toBeInTheDocument(),
    );
    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(expandFloatingToChecklist).toHaveBeenCalledTimes(1);
  });

  it("collapses to an edge handle when Encolher is clicked, and expands back on click", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Encolher" }),
    );

    await waitFor(() => expect(collapseToEdge).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: /Expandir barra/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();

    await userEventInstance.click(
      screen.getByRole("button", { name: /Expandir barra/ }),
    );

    await waitFor(() => expect(expandFromEdge).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
  });

  it("stays compact when no monitor work area is available", async () => {
    vi.mocked(collapseToEdge).mockResolvedValueOnce(null);
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Encolher" }),
    );

    await waitFor(() => expect(collapseToEdge).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Expandir barra/ }),
    ).not.toBeInTheDocument();
  });

  it("expands from the edge before opening the checklist when a payload arrives while collapsed", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Encolher" }),
    );
    await waitFor(() => expect(collapseToEdge).toHaveBeenCalledTimes(1));

    expect(payloadHandler).not.toBeNull();
    await act(async () => {
      await payloadHandler!(makeChecklistPayload());
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Checklist do procedure")).toBeInTheDocument(),
    );
    expect(expandFromEdge).toHaveBeenCalledTimes(1);
    expect(expandFloatingToChecklist).toHaveBeenCalledTimes(1);
  });

  it("calls hideAllWindows when Ocultar is clicked", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.click(
      screen.getByRole("button", { name: "Ocultar" }),
    );

    await waitFor(() => expect(hideAllWindows).toHaveBeenCalledTimes(1));
  });

  it("collapses the Assist before hiding the window", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    vi.mocked(collapseQuickMenuToFloating).mockClear();
    vi.mocked(hideAllWindows).mockClear();

    await userEventInstance.click(
      screen.getByRole("button", { name: "Ocultar" }),
    );

    await waitFor(() => expect(hideAllWindows).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    expect(
      vi.mocked(collapseQuickMenuToFloating).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(hideAllWindows).mock.invocationCallOrder[0]!);
    expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
  });

  it("still hides after forcing compact size when quick-menu collapse fails", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockRejectedValueOnce(
      new Error("collapse interrupted"),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByRole("dialog", { name: "Assist" }));

    await userEventInstance.click(
      screen.getByRole("button", { name: "Ocultar" }),
    );

    await waitFor(() => expect(hideAllWindows).toHaveBeenCalledTimes(1));
    expect(setMinSizeMock).toHaveBeenCalledWith(null);
    expect(setResizableMock).toHaveBeenLastCalledWith(false);
    expect(invokeMock).toHaveBeenCalledWith(
      "set_window_bounds",
      expect.objectContaining({
        to: expect.objectContaining({
          width: ISLAND_ENVELOPE_SIZE.width,
          height: ISLAND_ENVELOPE_SIZE.height,
        }),
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Assist" })).not.toBeInTheDocument();
  });

  /*
   * Regressão: desde o envelope fixo (ver docs/SDD-ILHA-ENVELOPE.md) a janela
   * nunca muda de tamanho ao abrir o quick menu — só a região de recorte.
   * Uma expansão que aborta antes de assentar deixa a intenção em "compact";
   * a reconciliação de bounds/região devolve a janela ao envelope normal.
   */
  it("recovers to compact bounds when the expansion aborts", async () => {
    vi.mocked(expandFloatingToQuickMenu).mockImplementationOnce(async () => {
      throw new Error("expand interrupted");
    });
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument(),
    );

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "set_window_bounds",
        expect.objectContaining({
          to: expect.objectContaining({
            width: ISLAND_ENVELOPE_SIZE.width,
            height: ISLAND_ENVELOPE_SIZE.height,
          }),
        }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Chat" })).toBeInTheDocument();
  });
});
