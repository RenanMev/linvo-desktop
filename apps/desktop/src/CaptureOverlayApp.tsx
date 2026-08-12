import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { emit } from "@tauri-apps/api/event";

import {
  captureElementAt,
  closeCaptureOverlay,
  listenOverlayReady,
  OVERLAY_CANCEL_EVENT,
  OVERLAY_RESULT_EVENT,
  type CaptureRect,
  type OverlayPayload,
} from "@/lib/context-capture/capture-sources";
import {
  clampRectToBounds,
  isRectUsable,
  normalizeRect,
  type Point,
  type Rect,
} from "@/lib/context-capture/crop";
import { cn } from "@/lib/utils";

const MAGNET_DEBOUNCE_MS = 40;

export function CaptureOverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [magnet, setMagnet] = useState<CaptureRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Point | null>(null);
  const magnetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastMagnetKeyRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listenOverlayReady((next) => {
      if (!cancelled) {
        setPayload(next);
        setSelection(null);
        setMagnet(null);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const cancel = useCallback(async () => {
    await emit(OVERLAY_CANCEL_EVENT);
    await closeCaptureOverlay();
  }, []);

  const confirm = useCallback(async () => {
    if (!payload) {
      return;
    }

    const region =
      selection && isRectUsable(selection)
        ? {
            x: Math.round(selection.x),
            y: Math.round(selection.y),
            width: Math.round(selection.width),
            height: Math.round(selection.height),
          }
        : magnet
          ? {
              x: magnet.x - payload.originX,
              y: magnet.y - payload.originY,
              width: magnet.width,
              height: magnet.height,
            }
          : null;

    if (!region || region.width < 8 || region.height < 8) {
      return;
    }

    await emit(OVERLAY_RESULT_EVENT, {
      imagePngBase64: payload.imagePngBase64,
      width: payload.width,
      height: payload.height,
      originX: payload.originX,
      originY: payload.originY,
      region,
    });
    await closeCaptureOverlay();
  }, [magnet, payload, selection]);

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

  const pointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): Point => ({
      x: event.clientX,
      y: event.clientY,
    }),
    [],
  );

  const scheduleMagnet = useCallback(
    (clientX: number, clientY: number) => {
      if (!payload || isDragging) {
        return;
      }
      if (magnetTimerRef.current) {
        clearTimeout(magnetTimerRef.current);
      }
      magnetTimerRef.current = setTimeout(() => {
        const screenX = clientX + payload.originX;
        const screenY = clientY + payload.originY;
        void captureElementAt(screenX, screenY)
          .then((rect) => {
            const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
            if (key === lastMagnetKeyRef.current) {
              return;
            }
            lastMagnetKeyRef.current = key;
            setMagnet(rect);
          })
          .catch(() => {
            setMagnet(null);
          });
      }, MAGNET_DEBOUNCE_MS);
    },
    [isDragging, payload],
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
      if (origin && payload) {
        const rect = normalizeRect(origin, pointFromEvent(event));
        setSelection(
          clampRectToBounds(rect, {
            width: payload.width,
            height: payload.height,
          }),
        );
        return;
      }
      scheduleMagnet(event.clientX, event.clientY);
    },
    [payload, pointFromEvent, scheduleMagnet],
  );

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    setSelection((current) =>
      current && isRectUsable(current) ? current : null,
    );
  }, []);

  const highlight = selection && isRectUsable(selection)
    ? selection
    : magnet
      ? {
          x: magnet.x - (payload?.originX ?? 0),
          y: magnet.y - (payload?.originY ?? 0),
          width: magnet.width,
          height: magnet.height,
        }
      : null;

  if (!payload) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black/80 text-sm text-white">
        Preparando captura…
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        src={`data:image/png;base64,${payload.imagePngBase64}`}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full select-none object-none"
        style={{ width: payload.width, height: payload.height }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      {highlight ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute border-2 border-sky-400 bg-sky-400/15",
            isDragging && "border-dashed",
          )}
          style={{
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white">
        Arraste para recortar · passe o mouse para magnetizar · Enter confirma ·
        Esc cancela
      </div>
    </div>
  );
}
