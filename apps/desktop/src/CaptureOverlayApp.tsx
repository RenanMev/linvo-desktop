import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { emit } from "@tauri-apps/api/event";

import {
  closeCaptureOverlay,
  fetchOverlayPayload,
  listenOverlayReady,
  OVERLAY_CANCEL_EVENT,
  OVERLAY_RESULT_EVENT,
  type OverlayPayload,
  type SnapRect,
} from "@/lib/context-capture/capture-sources";
import {
  clampRectToBounds,
  isRectUsable,
  normalizeRect,
  pickSnapTarget,
  scalePointToSource,
  scaleRectToDisplay,
  scaleRectToSource,
  type Point,
  type Rect,
  type Size,
} from "@/lib/context-capture/crop";

/** Alvos do Rust, deslocados para a origem do desktop virtual. */
type FrameSnapTarget = Rect & { kind: SnapRect["kind"]; title: string };

function toFrameTargets(payload: OverlayPayload): FrameSnapTarget[] {
  return (payload.snapRects ?? []).map((rect) => ({
    x: rect.x - payload.originX,
    y: rect.y - payload.originY,
    width: rect.width,
    height: rect.height,
    kind: rect.kind,
    title: rect.title,
  }));
}

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

function sameRect(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

/**
 * O overlay vive em dois sistemas de coordenadas e confundi-los quebra tudo de
 * uma vez: o Rust entrega os retângulos do magnetismo em **pixels físicos** da
 * área de trabalho virtual, enquanto o webview desenha e reporta ponteiro em
 * **pixels CSS** (físico ÷ escala do monitor). A conversão sai da medida real do
 * palco, então a seleção continua batendo com o recorte em qualquer DPI.
 *
 * A janela é transparente e o usuário vê a própria tela por baixo, só escurecida
 * — como a Ferramenta de Captura do Windows. Nada é capturado até o confirm, e
 * aí só a região escolhida.
 */
export function CaptureOverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [magnetTitle, setMagnetTitle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Point | null>(null);

  /*
   * Geometria vive em refs, não em estado. Cada `pointermove` chegava como um
   * `setState` e disparava uma reconciliação inteira do React numa janela do
   * tamanho da área de trabalho — a seleção ficava travada. Agora o movimento
   * só escreve na ref, e um único rAF por quadro pinta os retângulos.
   */
  const selectionRef = useRef<Rect | null>(null);
  const magnetRef = useRef<FrameSnapTarget | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const dimTop = useRef<HTMLDivElement>(null);
  const dimBottom = useRef<HTMLDivElement>(null);
  const dimLeft = useRef<HTMLDivElement>(null);
  const dimRight = useRef<HTMLDivElement>(null);
  // Objeto estável: recriá-lo a cada render trocaria a identidade de `paint` e
  // remontaria o rAF sem parar.
  const dimRefs = useMemo(
    () => ({
      top: dimTop,
      bottom: dimBottom,
      left: dimLeft,
      right: dimRight,
    }),
    [],
  );
  const frameRef = useRef<number | null>(null);
  const scheduledRef = useRef(false);
  // `null` = nada pintado ainda. Um `EMPTY_RECT` inicial se confundiria com
  // "sem seleção" e o escurecimento de tela cheia nunca chegaria a ser aplicado.
  const paintedRef = useRef<Rect | null>(null);

  const applyPayload = useCallback((next: OverlayPayload) => {
    setPayload(next);
    selectionRef.current = null;
    magnetRef.current = null;
    setMagnetTitle(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenOverlayReady((next) => {
      if (!cancelled) {
        applyPayload(next);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    /*
     * `listen()` registra de forma assíncrona, então existe uma janela em que um
     * `emit` do Rust cai no vazio (reload do WebView2, HMR, StrictMode). Quando
     * isso acontecia o overlay ficava preso em "preparando" cobrindo a tela
     * inteira, sem saída além do Esc. Puxar o payload fecha essa corrida.
     */
    const pull = () => {
      void fetchOverlayPayload()
        .then((next) => {
          if (!cancelled && next) {
            applyPayload(next);
          }
        })
        .catch(() => {});
    };

    pull();
    // A janela é pré-criada e reaproveitada: ela ganha foco toda vez que o Rust
    // a mostra, que é exatamente quando vale reconferir se o payload chegou.
    window.addEventListener("focus", pull);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", pull);
      unlisten?.();
    };
  }, [applyPayload]);

  /*
   * O Rust redimensiona esta janela para a área de trabalho virtual, e o webview
   * só reflete o novo tamanho alguns quadros depois. Medir uma vez na chegada do
   * payload pegava o tamanho antigo e deixava toda a conversão CSS <-> frame
   * errada — era o que fazia o magnetismo mirar fora da tela. O observer não tem
   * essa corrida: dispara na primeira observação e a cada mudança.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [payload]);

  const sourceSize: Size | null = payload
    ? { width: payload.width, height: payload.height }
    : null;
  const canMap = stageSize.width > 0 && stageSize.height > 0;
  const snapTargets = useMemo(
    () => (payload ? toFrameTargets(payload) : []),
    [payload],
  );

  /** Retângulo em destaque, em pixels CSS. */
  const currentHighlight = useCallback((): Rect | null => {
    const selection = selectionRef.current;
    if (selection && isRectUsable(selection)) {
      return selection;
    }
    const magnet = magnetRef.current;
    if (magnet && sourceSize && canMap) {
      return scaleRectToDisplay(magnet, sourceSize, stageSize);
    }
    return null;
  }, [canMap, sourceSize, stageSize]);

  /*
   * Quatro retângulos sólidos em volta da seleção, em vez de um
   * `box-shadow: 0 0 0 100vmax`. O shadow gigante obrigava o compositor a
   * repintar uma área do tamanho do desktop virtual a cada quadro do arrasto;
   * retângulos de cor sólida ele resolve na GPU.
   */
  const paint = useCallback(() => {
    const highlight = currentHighlight();
    const rect = highlight ?? EMPTY_RECT;
    if (paintedRef.current && sameRect(rect, paintedRef.current)) {
      return;
    }
    paintedRef.current = rect;

    const box = highlightRef.current;
    if (box) {
      box.style.opacity = highlight ? "1" : "0";
      box.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    }

    const { width, height } = stageSize;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    const place = (
      ref: { current: HTMLDivElement | null },
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      const node = ref.current;
      if (!node) {
        return;
      }
      node.style.transform = `translate(${x}px, ${y}px)`;
      node.style.width = `${Math.max(0, w)}px`;
      node.style.height = `${Math.max(0, h)}px`;
    };

    if (!highlight) {
      // Sem seleção o escurecimento cobre tudo com um painel só.
      place(dimRefs.top, 0, 0, width, height);
      place(dimRefs.bottom, 0, 0, 0, 0);
      place(dimRefs.left, 0, 0, 0, 0);
      place(dimRefs.right, 0, 0, 0, 0);
      return;
    }

    place(dimRefs.top, 0, 0, width, rect.y);
    place(dimRefs.bottom, 0, bottom, width, height - bottom);
    place(dimRefs.left, 0, rect.y, rect.x, rect.height);
    place(dimRefs.right, right, rect.y, width - right, rect.height);
  }, [currentHighlight, dimRefs, stageSize]);

  /** Coalesce os movimentos do ponteiro num repaint por quadro. */
  const schedulePaint = useCallback(() => {
    if (scheduledRef.current) {
      return;
    }
    // O "agendado" mora numa flag à parte, não no handle: se o callback rodar
    // de forma síncrona, a atribuição do handle acontece *depois* dele e
    // ressuscitaria um valor não-nulo, travando todos os repaints seguintes.
    scheduledRef.current = true;
    frameRef.current = requestAnimationFrame(() => {
      scheduledRef.current = false;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    paintedRef.current = null;
    schedulePaint();
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      scheduledRef.current = false;
    };
  }, [schedulePaint, stageSize, payload]);

  const cancel = useCallback(async () => {
    await emit(OVERLAY_CANCEL_EVENT);
    await closeCaptureOverlay();
  }, []);

  const confirm = useCallback(async () => {
    if (!payload || !sourceSize || !canMap) {
      return;
    }

    /*
     * Sem seleção e sem magnetismo, o confirm vale pelo frame inteiro. Antes ele
     * não fazia nada: a tela seguia coberta e o chat — que se escondeu para a
     * captura — não voltava, deixando o usuário sem saída além do Esc.
     */
    const selection = selectionRef.current;
    const magnet = magnetRef.current;
    const region =
      selection && isRectUsable(selection)
        ? scaleRectToSource(selection, stageSize, sourceSize)
        : magnet
          ? {
              x: magnet.x,
              y: magnet.y,
              width: magnet.width,
              height: magnet.height,
            }
          : { x: 0, y: 0, width: payload.width, height: payload.height };

    if (!isRectUsable(region, 8)) {
      return;
    }

    /*
     * A região é devolvida em coordenadas absolutas do desktop virtual: o Rust
     * captura direto dos monitores, sem frame congelado no meio. Só o retângulo
     * viaja — emitir a imagem aqui travava o evento e o `closeCaptureOverlay`
     * abaixo nunca rodava, então a janela nunca voltava.
     */
    await emit(OVERLAY_RESULT_EVENT, {
      region: {
        x: region.x + payload.originX,
        y: region.y + payload.originY,
        width: region.width,
        height: region.height,
      },
    });
    // Sem restaurar: quem devolve as janelas é o comando do recorte, depois de
    // já ter capturado. Restaurar aqui traria o chat de volta a tempo de ele
    // aparecer dentro do próprio print.
    await closeCaptureOverlay(undefined, { restore: false });
  }, [canMap, payload, sourceSize, stageSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void cancel();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void confirm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, confirm]);

  /** Ponteiro em pixels CSS relativos ao palco. */
  const pointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => {
      const bounds = stageRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      };
    },
    [],
  );

  const updateMagnet = useCallback(
    (point: Point) => {
      if (!sourceSize || !canMap) {
        return;
      }
      // Hit-test local: a lista veio pronta do Rust, então não há IPC — nem a
      // chance de o Windows responder "o elemento sob o cursor é o overlay".
      const framePoint = scalePointToSource(point, stageSize, sourceSize);
      const next = pickSnapTarget(framePoint, snapTargets);
      if (next === magnetRef.current) {
        return;
      }
      magnetRef.current = next;
      // O rótulo é a única parte que passa por estado: muda de alvo em alvo, não
      // de pixel em pixel.
      setMagnetTitle(
        next ? `${next.kind === "monitor" ? "Tela: " : ""}${next.title || "Janela sem título"}` : null,
      );
      schedulePaint();
    },
    [canMap, schedulePaint, snapTargets, sourceSize, stageSize],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!payload || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const origin = pointFromEvent(event);
      dragStartRef.current = origin;
      setIsDragging(true);
      selectionRef.current = { x: origin.x, y: origin.y, width: 0, height: 0 };
      schedulePaint();
    },
    [payload, pointFromEvent, schedulePaint],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = dragStartRef.current;
      const point = pointFromEvent(event);
      if (origin && payload) {
        // Limite é o palco em CSS: usar o tamanho do frame deixaria arrastar
        // para muito além da borda visível em telas com escala.
        selectionRef.current = clampRectToBounds(
          normalizeRect(origin, point),
          stageSize,
        );
        schedulePaint();
        return;
      }
      updateMagnet(point);
    },
    [payload, pointFromEvent, schedulePaint, stageSize, updateMagnet],
  );

  /*
   * Soltar o botão confirma. Antes ele só assentava a seleção e era preciso
   * apertar Enter em seguida — um passo escondido, já que o único aviso era o
   * texto da barra de dicas. Um clique sem arrasto confirma o alvo magnetizado.
   */
  const endDrag = useCallback(() => {
    const dragged = dragStartRef.current !== null;
    dragStartRef.current = null;
    setIsDragging(false);

    const selection = selectionRef.current;
    if (selection && !isRectUsable(selection)) {
      selectionRef.current = null;
      schedulePaint();
    }
    if (dragged && (selectionRef.current || magnetRef.current)) {
      void confirm();
    }
  }, [confirm, schedulePaint]);

  const cancelDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    selectionRef.current = null;
    schedulePaint();
  }, [schedulePaint]);

  return (
    <div
      ref={stageRef}
      data-testid="capture-overlay-stage"
      className="relative h-screen w-screen cursor-crosshair overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
    >
      {/*
       * O estado sem payload é transparente de propósito. Antes ele pintava
       * `bg-black/60` sobre a tela inteira e clareava para `bg-black/35` quando
       * os dados chegavam — um flash preto que parecia travamento.
       */}
      {(["top", "bottom", "left", "right"] as const).map((side) => (
        <div
          key={side}
          ref={dimRefs[side]}
          aria-hidden="true"
          data-testid={`capture-overlay-dim-${side}`}
          className="pointer-events-none absolute top-0 left-0 bg-black/35"
          style={{ width: 0, height: 0 }}
        />
      ))}
      <div
        ref={highlightRef}
        aria-hidden="true"
        data-testid="capture-overlay-highlight"
        className="pointer-events-none absolute top-0 left-0 border-2 border-sky-400 opacity-0"
        style={{ width: 0, height: 0 }}
      />
      {payload ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex max-w-[min(90vw,42rem)] -translate-x-1/2 flex-col items-center gap-1 rounded-2xl bg-black/70 px-4 py-2 text-xs text-white">
          {magnetTitle && !isDragging ? (
            <span className="max-w-full truncate font-medium text-sky-300">
              {magnetTitle}
            </span>
          ) : null}
          <span>
            Arraste para recortar · clique para capturar o que está destacado ·
            Esc cancela
          </span>
        </div>
      ) : null}
    </div>
  );
}
