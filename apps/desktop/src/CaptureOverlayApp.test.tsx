import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureOverlayApp } from "@/CaptureOverlayApp";
import * as captureSources from "@/lib/context-capture/capture-sources";
import { emitMock } from "@/test/mocks/tauri";

/**
 * A tela do usuário está a 150%: o Rust congela 2400x1200 pixels físicos e o
 * webview desenha isso em 1600x800 pixels CSS. Estes testes existem porque
 * confundir os dois espaços foi exatamente o que quebrou o recorte magnético.
 */
const FRAME = { width: 2400, height: 1200 };
const STAGE = { width: 1600, height: 800 };

let stageW = STAGE.width;
let stageH = STAGE.height;

/** Callbacks dos ResizeObserver vivos, para simular o resize tardio da janela. */
const resizeObservers: Array<() => void> = [];

class ResizeObserverStub {
  constructor(private readonly callback: () => void) {}
  observe() {
    resizeObservers.push(this.callback);
    // O observer real dispara logo na primeira observação.
    this.callback();
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;

function payload(overrides: Partial<captureSources.OverlayPayload> = {}) {
  return {
    imagePngBase64: "AAAA",
    width: FRAME.width,
    height: FRAME.height,
    originX: 0,
    originY: 0,
    snapRects: [],
    ...overrides,
  } as captureSources.OverlayPayload;
}

function stubStageSize() {
  // jsdom não faz layout: o palco precisa reportar o tamanho CSS na mão.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => stageW,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    () => stageH,
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        left: 0,
        top: 0,
        right: stageW,
        bottom: stageH,
        width: stageW,
        height: stageH,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

async function renderReadyOverlay(
  overrides: Partial<captureSources.OverlayPayload> = {},
) {
  let readyHandler:
    | ((value: captureSources.OverlayPayload) => void)
    | undefined;
  vi.spyOn(captureSources, "listenOverlayReady").mockImplementation(
    (handler) => {
      readyHandler = handler;
      return Promise.resolve(() => {});
    },
  );

  const view = render(<CaptureOverlayApp />);
  await waitFor(() => expect(readyHandler).toBeDefined());
  // Dentro de `act` para o efeito de medida do palco rodar antes do ponteiro:
  // sem tamanho medido o overlay ainda não sabe converter CSS <-> frame.
  await act(async () => {
    readyHandler!(payload(overrides));
  });
  const stage = await screen.findByTestId("capture-overlay-stage");
  return { ...view, stage };
}

function drag(
  stage: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  fireEvent.pointerDown(stage, { button: 0, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(stage, { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(stage);
}

describe("CaptureOverlayApp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    emitMock.mockClear();
    resizeObservers.length = 0;
    stageW = STAGE.width;
    stageH = STAGE.height;
    stubStageSize();
    vi.spyOn(captureSources, "closeCaptureOverlay").mockResolvedValue(undefined);
  });

  it("shows the live screen dimmed instead of shipping the frozen frame over", async () => {
    const { stage } = await renderReadyOverlay();

    // Desenhar o frame aqui custava ~15 MB de IPC por captura e deixava a tela
    // preta enquanto não chegava; os pixels do anexo vêm do Rust no recorte.
    expect(document.querySelector("img")).toBeNull();
    expect(stage).toHaveClass("bg-black/35");
  });

  it("emits the dragged region in frame pixels, not CSS pixels", async () => {
    const { stage } = await renderReadyOverlay();

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });
    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 300, y: 150, width: 600, height: 300 },
        }),
      ),
    );
  });

  it("draws the selection where the pointer is, in CSS pixels", async () => {
    const { stage } = await renderReadyOverlay();

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });

    const highlight = stage.querySelector('[aria-hidden="true"].absolute');
    expect(highlight).toHaveStyle({
      left: "200px",
      top: "100px",
      width: "400px",
      height: "200px",
    });
  });

  it("magnetizes to the window under the pointer, offset by the desktop origin", async () => {
    // Monitor à esquerda do primário: a origem do desktop virtual é negativa.
    const { stage } = await renderReadyOverlay({
      originX: -1920,
      originY: 0,
      snapRects: [
        {
          x: -1320,
          y: 300,
          width: 1200,
          height: 600,
          kind: "window",
          title: "Editor",
        },
      ],
    });

    fireEvent.pointerMove(stage, { clientX: 800, clientY: 400 });

    await waitFor(() => {
      const highlight = stage.querySelector('[aria-hidden="true"].absolute');
      expect(highlight).toHaveStyle({
        left: "400px",
        top: "200px",
        width: "800px",
        height: "400px",
      });
    });
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("prefers the window over the monitor it sits on", async () => {
    const { stage } = await renderReadyOverlay({
      snapRects: [
        {
          x: 600,
          y: 300,
          width: 1200,
          height: 600,
          kind: "window",
          title: "Navegador",
        },
        {
          x: 0,
          y: 0,
          width: 2400,
          height: 1200,
          kind: "monitor",
          title: "Tela 1",
        },
      ],
    });

    fireEvent.pointerMove(stage, { clientX: 800, clientY: 400 });
    await waitFor(() => expect(screen.getByText("Navegador")).toBeInTheDocument());

    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 600, y: 300, width: 1200, height: 600 },
        }),
      ),
    );
  });

  it("falls back to the monitor when the pointer is over bare desktop", async () => {
    // Dois monitores lado a lado no frame congelado.
    const { stage } = await renderReadyOverlay({
      snapRects: [
        {
          x: 0,
          y: 0,
          width: 1200,
          height: 1200,
          kind: "monitor",
          title: "Tela 1",
        },
        {
          x: 1200,
          y: 0,
          width: 1200,
          height: 1200,
          kind: "monitor",
          title: "Tela 2",
        },
      ],
    });

    // 1000 CSS -> 1500 no frame, ou seja, o segundo monitor.
    fireEvent.pointerMove(stage, { clientX: 1000, clientY: 400 });

    await waitFor(() => expect(screen.getByText(/Tela 2/)).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 1200, y: 0, width: 1200, height: 1200 },
        }),
      ),
    );
  });

  it("captures the whole frame on Enter when nothing is selected", async () => {
    await renderReadyOverlay();

    fireEvent.keyDown(window, { key: "Enter" });

    // Antes isto era no-op: a tela ficava congelada e o chat escondido não voltava.
    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 0, y: 0, width: FRAME.width, height: FRAME.height },
        }),
      ),
    );
  });

  it("re-measures when the window is resized after the payload arrives", async () => {
    // O Rust redimensiona a janela antes de emitir o payload; o webview só
    // acompanha depois. Aqui o palco começa pequeno e cresce em seguida.
    stageW = 800;
    stageH = 600;

    const { stage } = await renderReadyOverlay();

    stageW = STAGE.width;
    stageH = STAGE.height;
    await act(async () => {
      resizeObservers.forEach((cb) => cb());
    });

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });
    fireEvent.keyDown(window, { key: "Enter" });

    // Com a medida velha (800x600) a escala seria 4,4x e a região sairia errada.
    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 300, y: 150, width: 600, height: 300 },
        }),
      ),
    );
  });

  it("cancels on Escape", async () => {
    await renderReadyOverlay();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(captureSources.OVERLAY_CANCEL_EVENT),
    );
  });
});
