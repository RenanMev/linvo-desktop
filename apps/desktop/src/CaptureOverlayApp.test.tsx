import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureOverlayApp } from "@/CaptureOverlayApp";
import * as captureSources from "@/lib/context-capture/capture-sources";
import { emitMock } from "@/test/mocks/tauri";

/**
 * A tela do usuário está a 150%: o desktop virtual tem 2400x1200 pixels físicos
 * e o webview desenha isso em 1600x800 pixels CSS. Estes testes existem porque
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

/**
 * A geometria é escrita direto no style via ref, num rAF, para o arrasto não
 * passar por uma reconciliação do React a cada `pointermove`. Aqui o rAF é
 * síncrono (ver `beforeEach`), então basta ler o style depois do evento.
 */
function highlightBox() {
  const node = screen.getByTestId("capture-overlay-highlight");
  return {
    transform: node.style.transform,
    width: node.style.width,
    height: node.style.height,
    opacity: node.style.opacity,
  };
}

function dim(side: "top" | "bottom" | "left" | "right") {
  const node = screen.getByTestId(`capture-overlay-dim-${side}`);
  return {
    transform: node.style.transform,
    width: node.style.width,
    height: node.style.height,
  };
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
    vi.spyOn(captureSources, "fetchOverlayPayload").mockResolvedValue(null);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  it("shows the live screen dimmed instead of shipping a frozen frame over", async () => {
    await renderReadyOverlay();

    // Desenhar o frame aqui custava ~15 MB de IPC por captura e deixava a tela
    // preta enquanto não chegava; os pixels do anexo vêm do Rust no recorte.
    expect(document.querySelector("img")).toBeNull();
    // Sem seleção, um painel só cobre a tela inteira.
    expect(dim("top")).toMatchObject({
      transform: "translate(0px, 0px)",
      width: `${STAGE.width}px`,
      height: `${STAGE.height}px`,
    });
  });

  it("emits the dragged region in frame pixels, not CSS pixels", async () => {
    const { stage } = await renderReadyOverlay();

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 300, y: 150, width: 600, height: 300 },
        }),
      ),
    );
  });

  it("leaves the windows hidden on confirm, for the crop to restore them", async () => {
    const close = vi.spyOn(captureSources, "closeCaptureOverlay");
    const { stage } = await renderReadyOverlay();

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });

    /*
     * Quem devolve o chat é o comando do recorte, depois de já ter capturado.
     * Restaurar aqui trazia a janela de volta a tempo de ela aparecer dentro do
     * próprio print.
     */
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith(undefined, { restore: false }),
    );
  });

  it("restores the windows on cancel, since no crop will run", async () => {
    const close = vi.spyOn(captureSources, "closeCaptureOverlay");
    await renderReadyOverlay();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(close).toHaveBeenCalledWith());
  });

  it("emits absolute desktop coordinates so Rust can find the monitor", async () => {
    // Monitor à esquerda do primário: a origem do desktop virtual é negativa, e
    // o Rust captura direto dos monitores em coordenadas absolutas.
    const { stage } = await renderReadyOverlay({ originX: -1920, originY: -120 });

    drag(stage, { x: 200, y: 100 }, { x: 600, y: 300 });

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 300 - 1920, y: 150 - 120, width: 600, height: 300 },
        }),
      ),
    );
  });

  it("cuts the dimming open around the selection, in CSS pixels", async () => {
    const { stage } = await renderReadyOverlay();

    fireEvent.pointerDown(stage, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(stage, { clientX: 600, clientY: 300 });

    /*
     * Quatro retângulos sólidos em volta da seleção. Antes era um
     * `box-shadow: 0 0 0 100vmax`, que obrigava o compositor a repintar uma área
     * do tamanho do desktop virtual a cada quadro do arrasto.
     */
    expect(highlightBox()).toMatchObject({
      transform: "translate(200px, 100px)",
      width: "400px",
      height: "200px",
      opacity: "1",
    });
    expect(dim("top")).toMatchObject({ height: "100px" });
    expect(dim("left")).toMatchObject({ width: "200px" });
    expect(dim("right")).toMatchObject({
      transform: "translate(600px, 100px)",
      width: `${STAGE.width - 600}px`,
    });
    expect(dim("bottom")).toMatchObject({
      transform: "translate(0px, 300px)",
      height: `${STAGE.height - 300}px`,
    });
  });

  it("magnetizes to the window under the pointer, offset by the desktop origin", async () => {
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

    await waitFor(() => expect(screen.getByText("Editor")).toBeInTheDocument());
    expect(highlightBox()).toMatchObject({
      transform: "translate(400px, 200px)",
      width: "800px",
      height: "400px",
    });
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
    await waitFor(() =>
      expect(screen.getByText("Navegador")).toBeInTheDocument(),
    );

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
    // Dois monitores lado a lado no desktop virtual.
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

  it("confirms the magnetized target on a plain click", async () => {
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
      ],
    });

    fireEvent.pointerMove(stage, { clientX: 800, clientY: 400 });
    await waitFor(() =>
      expect(screen.getByText("Navegador")).toBeInTheDocument(),
    );

    // Sem arrastar: soltar o botão já confirma. Antes era preciso apertar Enter
    // depois de soltar, um passo que só aparecia na barra de dicas.
    fireEvent.pointerDown(stage, { button: 0, clientX: 800, clientY: 400 });
    fireEvent.pointerUp(stage);

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        captureSources.OVERLAY_RESULT_EVENT,
        expect.objectContaining({
          region: { x: 600, y: 300, width: 1200, height: 600 },
        }),
      ),
    );
  });

  it("captures the whole frame on Enter when nothing is selected", async () => {
    await renderReadyOverlay();

    fireEvent.keyDown(window, { key: "Enter" });

    // Antes isto era no-op: a tela ficava coberta e o chat escondido não voltava.
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

  it("pulls the payload when the ready event was missed", async () => {
    /*
     * `listen()` registra de forma assíncrona: um `emit` do Rust nesse intervalo
     * cai no vazio (reload do WebView2, HMR, StrictMode). Sem o pull o overlay
     * ficava preso cobrindo a tela inteira, sem saída além do Esc.
     */
    vi.spyOn(captureSources, "listenOverlayReady").mockImplementation(() =>
      Promise.resolve(() => {}),
    );
    vi.spyOn(captureSources, "fetchOverlayPayload").mockResolvedValue(
      payload({
        snapRects: [
          {
            x: 0,
            y: 0,
            width: 2400,
            height: 1200,
            kind: "monitor",
            title: "Tela 1",
          },
        ],
      }),
    );

    render(<CaptureOverlayApp />);
    const stage = await screen.findByTestId("capture-overlay-stage");

    fireEvent.pointerMove(stage, { clientX: 800, clientY: 400 });
    await waitFor(() => expect(screen.getByText(/Tela 1/)).toBeInTheDocument());
  });

  it("cancels on Escape", async () => {
    await renderReadyOverlay();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(captureSources.OVERLAY_CANCEL_EVENT),
    );
  });
});
