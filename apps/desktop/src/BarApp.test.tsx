import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Procedure, UserPublic } from "@linvo/shared";

import { BarApp } from "@/BarApp";
import { hideAllWindows } from "@/lib/app-windows";
import { expandFloatingToChecklist } from "@/lib/floating-checklist-mode";
import { collapseToEdge, expandFromEdge } from "@/lib/floating-edge-mode";
import {
  collapseQuickMenuToFloating,
  expandFloatingToQuickMenu,
} from "@/lib/floating-quick-menu-mode";
import type { ChecklistWindowPayload } from "@/lib/checklist-window";
import { COMPACT_SIZE, QUICK_MENU_SIZE } from "@/lib/window-mode";
import {
  invokeMock,
  setMinSizeMock,
  setMaximizableMock,
  setResizableMock,
  windowMock,
} from "@/test/mocks/tauri";

vi.mock("@/hooks/use-floating-bootstrap", () => ({
  useFloatingBootstrap: () => true,
}));

vi.mock("@/hooks/use-api-health", () => ({
  useApiHealth: () => true,
}));

vi.mock("@/lib/floating-checklist-mode", () => ({
  expandFloatingToChecklist: vi.fn(() => Promise.resolve()),
  collapseChecklistToFloating: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/floating-quick-menu-mode", () => ({
  expandFloatingToQuickMenu: vi.fn(() => Promise.resolve()),
  collapseQuickMenuToFloating: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/floating-edge-mode", () => ({
  collapseToEdge: vi.fn(() =>
    Promise.resolve({ horizontal: "right", vertical: null }),
  ),
  expandFromEdge: vi.fn(() => Promise.resolve()),
}));

let payloadHandler:
  | ((payload: ChecklistWindowPayload) => void | Promise<void>)
  | null = null;
type FocusHandler = (event: { payload: boolean }) => void;
type OnFocusChangedMock = (handler: FocusHandler) => Promise<() => void>;
let focusHandler: FocusHandler | null = null;

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
    focusHandler = null;
    localStorage.clear();
    vi.clearAllMocks();
    // Bounds nativos default: nem compactos nem expandidos, como a janela
    // recém-criada antes do `enterFloatingMode`.
    windowMock.outerSize.mockResolvedValue({ width: 140, height: 40 });
    (
      windowMock.onFocusChanged as unknown as {
        mockImplementation: (implementation: OnFocusChangedMock) => void;
      }
    ).mockImplementation((handler) => {
      focusHandler = handler;
      return Promise.resolve(() => {});
    });
  });

  it("expands to the quick menu when Chat is clicked", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
  });

  it("does not arm auto-capture when Chat opens without Recorte", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("capture_overlay_open"),
    );
  });

  it("expands to the quick menu when the local shortcut is pressed", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.keyboard("{Control>}{Shift>}l{/Shift}{/Control}");

    await waitFor(() =>
      expect(expandFloatingToQuickMenu).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
  });

  it("toggles the quick menu closed with the local shortcut", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

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
    await waitFor(() => screen.getByLabelText("Quick Center"));

    await userEventInstance.keyboard("{Escape}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toHaveFocus();
    });
  });

  it("still closes when animation frames are throttled", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

    vi.mocked(collapseQuickMenuToFloating).mockImplementationOnce(
      async (options = {}) => {
        await options.onBeforeCommit?.(collapseGeometry);
      },
    );
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1);
    document.documentElement.dataset.reduceMotion = "true";

    await userEventInstance.click(
      screen.getByRole("button", { name: "Fechar Quick Center" }),
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
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
      async (options = {}) => {
        await options.onPrepare?.(expandGeometry);
        await options.onResizeStart?.(expandGeometry);
        await new Promise<void>((resolve) => {
          finishExpand = resolve;
        });
        return expandGeometry;
      },
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    const closeButton = await screen.findByRole("button", {
      name: "Fechar Quick Center",
      hidden: true,
    });
    await waitFor(() => expect(finishExpand).toBeTypeOf("function"));

    fireEvent.click(closeButton);

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    act(() => finishExpand());
    await waitFor(() => {
      expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });
  });

  it("collapses on window blur without stealing focus back", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));
    await waitFor(() => expect(focusHandler).not.toBeNull());

    act(() => {
      focusHandler!({ payload: false });
    });

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    const chatButton = screen.getByRole("button", { name: "Chat" });
    expect(chatButton).not.toHaveFocus();
  });

  it("does not collapse while the quick menu is capturing visual context", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));
    await waitFor(() => expect(focusHandler).not.toBeNull());

    await userEventInstance.click(
      screen.getByRole("button", { name: "Capturar contexto visual" }),
    );
    await userEventInstance.click(
      await screen.findByRole("menuitem", { name: /Escolher janela ou tela/ }),
    );
    await screen.findByRole("dialog", { name: "Selecionar fonte de captura" });

    // O seletor de fontes rouba o foco da janela; sem a trava o quick menu
    // colapsaria e levaria junto a captura em andamento.
    act(() => {
      focusHandler!({ payload: false });
    });

    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
  });

  it("does not collapse when blur is caused by dragging the quick menu", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));
    await waitFor(() => expect(focusHandler).not.toBeNull());

    fireEvent.pointerDown(screen.getByTitle("Mover"));
    act(() => {
      focusHandler!({ payload: false });
    });

    expect(collapseQuickMenuToFloating).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Quick Center")).toBeInTheDocument();
  });

  it("returns to the action even if native collapse fails", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockRejectedValueOnce(
      new Error("collapse interrupted"),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

    await userEventInstance.keyboard("{Escape}");

    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });
  });

  it("returns to the action when native collapse never resolves", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockReturnValueOnce(
      new Promise<void>(() => {}),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

    await userEventInstance.click(
      screen.getByRole("button", { name: "Fechar Quick Center" }),
    );

    await waitFor(
      () => {
        expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
      },
      { timeout: 1500 },
    );
  });

  it("collapses the quick menu before expanding the checklist when a payload arrives", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

    expect(payloadHandler).not.toBeNull();
    await act(async () => {
      await payloadHandler!(makeChecklistPayload());
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Checklist do procedure")).toBeInTheDocument(),
    );
    expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1);
    expect(expandFloatingToChecklist).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
  });

  it("keeps checklist intent when blur races with quick-menu collapse", async () => {
    let finishCollapse!: () => void;
    vi.mocked(collapseQuickMenuToFloating).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCollapse = resolve;
      }),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));
    await waitFor(() => expect(focusHandler).not.toBeNull());

    let payloadPromise: void | Promise<void> = undefined;
    act(() => {
      payloadPromise = payloadHandler!(makeChecklistPayload());
    });
    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );

    act(() => {
      focusHandler!({ payload: false });
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

  it("calls hideAllWindows when Minimizar is clicked", async () => {
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(
      screen.getByRole("button", { name: "Minimizar" }),
    );

    expect(hideAllWindows).toHaveBeenCalledTimes(1);
  });

  it("collapses the Quick Center before hiding the window", async () => {
    const callOrder: string[] = [];
    vi.mocked(collapseQuickMenuToFloating).mockImplementationOnce(() => {
      callOrder.push("collapse");
      return Promise.resolve();
    });
    vi.mocked(hideAllWindows).mockImplementationOnce(() => {
      callOrder.push("hide");
      return Promise.resolve();
    });
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

    await userEventInstance.click(
      screen.getByRole("button", { name: "Ocultar" }),
    );

    await waitFor(() => expect(hideAllWindows).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(collapseQuickMenuToFloating).toHaveBeenCalledTimes(1),
    );
    expect(callOrder).toEqual(["collapse", "hide"]);
    expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
  });

  it("still hides after forcing compact size when quick-menu collapse fails", async () => {
    vi.mocked(collapseQuickMenuToFloating).mockRejectedValueOnce(
      new Error("collapse interrupted"),
    );
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => screen.getByLabelText("Quick Center"));

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
          width: COMPACT_SIZE.width,
          height: COMPACT_SIZE.height,
        }),
      }),
    );
    expect(screen.queryByLabelText("Quick Center")).not.toBeInTheDocument();
  });

  /*
   * Regressão: o morph aplica bounds nativos e CSS em metades separadas, então
   * uma expansão que aborta depois de a janela já ter crescido deixava a janela
   * do tamanho do quick menu com a pílula desenhada dentro dela.
   */
  it("shrinks the window back when the expansion aborts after it grew", async () => {
    windowMock.outerSize.mockResolvedValue({ ...COMPACT_SIZE });
    vi.mocked(expandFloatingToQuickMenu).mockImplementationOnce(async () => {
      windowMock.outerSize.mockResolvedValue({ ...QUICK_MENU_SIZE });
      throw new Error("expand interrupted");
    });
    const userEventInstance = userEvent.setup();
    render(<BarApp sessionWarning={null} user={user} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument(),
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      "set_window_bounds",
      expect.anything(),
    );

    await userEventInstance.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "set_window_bounds",
        expect.objectContaining({
          to: expect.objectContaining({
            width: COMPACT_SIZE.width,
            height: COMPACT_SIZE.height,
          }),
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
  });
});
