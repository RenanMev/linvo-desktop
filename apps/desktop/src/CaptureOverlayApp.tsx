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
import { cn } from "@/lib/utils";

/** Alvos do Rust, deslocados para a origem do frame congelado. */
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

/**
 * O overlay vive em dois sistemas de coordenadas e confundi-los quebra tudo de
 * uma vez: o Rust entrega o frame e os retângulos do magnetismo em **pixels
 * físicos** da área de trabalho virtual, enquanto o webview desenha e reporta
 * ponteiro em **pixels CSS** (físico ÷ escala do monitor). A imagem é esticada
 * para preencher o palco e a conversão sai da medida real dele, então a
 * seleção continua batendo com o recorte em qualquer DPI.
 */
export function CaptureOverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [magnet, setMagnet] = useState<FrameSnapTarget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Point | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenOverlayReady((next) => {
      if (cancelled) {
        return;
      }
      setPayload(next);
      setSelection(null);
      setMagnet(null);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  /*
   * O Rust redimensiona esta janela para a área de trabalho virtual *antes* de
   * emitir o payload, e o webview só reflete o novo tamanho alguns frames
   * depois. Medir uma vez na chegada do payload pegava o tamanho antigo e
   * deixava toda a conversão CSS <-> frame errada — era o que fazia o
   * magnetismo mirar fora da tela. O observer não tem essa corrida: dispara na
   * primeira observação e a cada mudança.
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

  const cancel = useCallback(async () => {
    await emit(OVERLAY_CANCEL_EVENT);
    await closeCaptureOverlay();
  }, []);

  const confirm = useCallback(async () => {
    if (!payload || !sourceSize || !canMap) {
      return;
    }

    /*
     * Sem seleção e sem magnetismo, Enter vale pelo frame inteiro. Antes ele
     * não fazia nada: a tela seguia congelada e o chat — que se escondeu para
     * a captura — não voltava, deixando o usuário sem saída além do Esc.
     */
    const region =
      selection && isRectUsable(selection)
        ? scaleRectToSource(selection, stageSize, sourceSize)
        : magnet
          ? { x: magnet.x, y: magnet.y, width: magnet.width, height: magnet.height }
          : { x: 0, y: 0, width: payload.width, height: payload.height };

    if (!isRectUsable(region, 8)) {
      return;
    }

    // Só a região viaja. Emitir a imagem inteira aqui travava o evento e o
    // `closeCaptureOverlay` abaixo nunca rodava — a janela nunca voltava.
    await emit(OVERLAY_RESULT_EVENT, { region });
    await closeCaptureOverlay();
  }, [canMap, magnet, payload, selection, sourceSize, stageSize]);

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
      if (!sourceSize || !canMap || isDragging) {
        return;
      }
      // Hit-test local: a lista veio pronta do Rust, então não há IPC — nem a
      // chance de o Windows responder "o elemento sob o cursor é o overlay".
      const framePoint = scalePointToSource(point, stageSize, sourceSize);
      setMagnet(pickSnapTarget(framePoint, snapTargets));
    },
    [canMap, isDragging, snapTargets, sourceSize, stageSize],
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
      setMagnet(null);
      setSelection({ x: origin.x, y: origin.y, width: 0, height: 0 });
    },
    [payload, pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = dragStartRef.current;
      const point = pointFromEvent(event);
      if (origin && payload) {
        // Limite é o palco em CSS: usar o tamanho do frame deixaria arrastar
        // para muito além da borda visível em telas com escala.
        setSelection(clampRectToBounds(normalizeRect(origin, point), stageSize));
        return;
      }
      updateMagnet(point);
    },
    [payload, pointFromEvent, updateMagnet, stageSize],
  );

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    setSelection((current) =>
      current && isRectUsable(current) ? current : null,
    );
  }, []);

  const highlight =
    selection && isRectUsable(selection)
      ? selection
      : magnet && sourceSize && canMap
        ? scaleRectToDisplay(magnet, sourceSize, stageSize)
        : null;

  if (!payload) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black/60 text-sm text-white">
        Preparando captura…
      </div>
    );
  }

  /*
   * A janela é transparente e o usuário vê a própria tela por baixo, só
   * escurecida — como a Ferramenta de Captura do Windows. Desenhar aqui o frame
   * congelado obrigava a mandar ~15 MB de pixels do Rust para cá a cada
   * captura, e enquanto isso não chegava a tela ficava preta. Os pixels que
   * viram anexo continuam vindo do frame congelado no Rust, então o que é
   * recortado é o instante do clique, não o que está passando na tela agora.
   */
  return (
    <div
      ref={stageRef}
      data-testid="capture-overlay-stage"
      className={cn(
        "relative h-screen w-screen cursor-crosshair overflow-hidden",
        // Com destaque, o escurecimento vem da sombra dele (recorte "vazado").
        !highlight && "bg-black/35",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {highlight ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute border-2 border-sky-400",
            isDragging && "border-dashed",
          )}
          style={{
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height,
            // Escurece tudo em volta e deixa a região escolhida limpa, para o
            // usuário ver exatamente o que vai anexar.
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.35)",
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex max-w-[min(90vw,42rem)] -translate-x-1/2 flex-col items-center gap-1 rounded-2xl bg-black/70 px-4 py-2 text-xs text-white">
        {magnet && !selection ? (
          <span className="max-w-full truncate font-medium text-sky-300">
            {magnet.kind === "monitor" ? "Tela: " : ""}
            {magnet.title || "Janela sem título"}
          </span>
        ) : null}
        <span>
          Arraste para recortar · passe o mouse para magnetizar · Enter{" "}
          {highlight ? "confirma" : "captura tudo"} · Esc cancela
        </span>
      </div>
    </div>
  );
}
