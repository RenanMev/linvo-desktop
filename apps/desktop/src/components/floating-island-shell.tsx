import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from "react";

import {
  ISLAND_EXPANDED_RADIUS_PX,
  ISLAND_IDENTITY_TRANSFORM,
  ISLAND_MORPH_DURATION_MS,
  ISLAND_MORPH_WATCHDOG_MS,
  resolveCompactRect,
  resolveExpandedRect,
  resolveIslandPlacement,
  resolveRectFlip,
  type IslandMorphGeometry,
  type IslandRect,
} from "@/lib/floating-island-transition";
import { cn } from "@/lib/utils";

export type FloatingIslandMode =
  | "compact"
  | "quick-menu"
  | "checklist"
  | "edge-collapsed";

export type FloatingIslandMorph = {
  id: number;
  active: boolean;
  fromMode: FloatingIslandMode;
  toMode: FloatingIslandMode;
  geometry: IslandMorphGeometry;
};

type FloatingIslandShellProps = {
  mode: FloatingIslandMode;
  morph: FloatingIslandMorph | null;
  renderMode: (mode: FloatingIslandMode) => ReactNode;
  onMorphComplete: (id: number) => void;
};

type IslandStyle = CSSProperties & {
  "--island-morph-duration"?: string;
};

function isCompactShape(mode: FloatingIslandMode): boolean {
  return mode === "compact" || mode === "edge-collapsed";
}

function contentRectStyle(
  rect: IslandRect,
  geometry: IslandMorphGeometry,
): CSSProperties {
  return resolveIslandPlacement(rect, geometry);
}

type SurfaceLayer = {
  shape: "compact" | "expanded";
  style: IslandStyle;
  /** Só a superfície que sai anima opacidade; a que fica nunca some. */
  fading: boolean;
};

/**
 * Cada forma vira uma superfície própria, com o raio e a borda que ela precisa,
 * e o outro estado é essa mesma superfície transformada.
 *
 * A superfície de destino fica opaca do começo ao fim, por baixo: as duas
 * cobrem exatamente a mesma área a cada frame, então o desktop nunca aparece
 * no meio do cross-fade.
 */
function resolveSurfaceLayers(
  geometry: IslandMorphGeometry,
  displayedMode: FloatingIslandMode,
  fromMode: FloatingIslandMode,
): SurfaceLayer[] {
  const compactRect = resolveCompactRect(geometry);
  const expandedRect = resolveExpandedRect(geometry);
  const showsCompact = isCompactShape(displayedMode);
  const originIsCompact = isCompactShape(fromMode);

  const duration: IslandStyle = {
    "--island-morph-duration": `${ISLAND_MORPH_DURATION_MS}ms`,
  };

  const compactPlacement = resolveIslandPlacement(compactRect, geometry);
  const expandedPlacement = resolveIslandPlacement(expandedRect, geometry);

  const compactLayer: SurfaceLayer = {
    shape: "compact",
    fading: originIsCompact,
    style: {
      ...duration,
      ...compactPlacement,
      // Metade do lado menor: a pílula é desenhada no tamanho real, sem
      // pré-compensação de escala e sem raio animado.
      borderRadius: `${Math.min(compactPlacement.width, compactPlacement.height) / 2}px`,
      transform: showsCompact
        ? ISLAND_IDENTITY_TRANSFORM
        : resolveRectFlip(expandedRect, compactRect).transform,
      opacity: originIsCompact && !showsCompact ? 0 : 1,
    },
  };

  const expandedLayer: SurfaceLayer = {
    shape: "expanded",
    fading: !originIsCompact,
    style: {
      ...duration,
      ...expandedPlacement,
      borderRadius: `${ISLAND_EXPANDED_RADIUS_PX}px`,
      transform: showsCompact
        ? resolveRectFlip(compactRect, expandedRect).transform
        : ISLAND_IDENTITY_TRANSFORM,
      opacity: !originIsCompact && showsCompact ? 0 : 1,
    },
  };

  // A superfície de origem vai por último: é ela que some por cima da outra.
  return originIsCompact
    ? [expandedLayer, compactLayer]
    : [compactLayer, expandedLayer];
}

export function FloatingIslandShell({
  mode,
  morph,
  renderMode,
  onMorphComplete,
}: FloatingIslandShellProps) {
  const completedIdRef = useRef<number | null>(null);
  const displayedMode = morph
    ? morph.active
      ? morph.toMode
      : morph.fromMode
    : mode;
  const displayedShape = isCompactShape(displayedMode) ? "compact" : "expanded";
  const surfaceLayers = morph
    ? resolveSurfaceLayers(morph.geometry, displayedMode, morph.fromMode)
    : null;

  function completeMorph(id: number) {
    if (completedIdRef.current === id) {
      return;
    }
    completedIdRef.current = id;
    onMorphComplete(id);
  }

  useEffect(() => {
    if (!morph?.active) {
      return;
    }
    completedIdRef.current = null;

    if (document.documentElement.dataset.reduceMotion === "true") {
      const reducedMotionTimer = window.setTimeout(
        () => completeMorph(morph.id),
        0,
      );
      return () => window.clearTimeout(reducedMotionTimer);
    }

    const watchdog = window.setTimeout(
      () => completeMorph(morph.id),
      ISLAND_MORPH_DURATION_MS + ISLAND_MORPH_WATCHDOG_MS,
    );
    return () => window.clearTimeout(watchdog);
  }, [morph?.active, morph?.id]);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (
      morph?.active &&
      event.currentTarget === event.target &&
      event.propertyName === "transform"
    ) {
      completeMorph(morph.id);
    }
  }

  const contentLayers = morph
    ? [
        {
          mode: morph.fromMode,
          rect: morph.geometry.from,
          phase: "source" as const,
        },
        {
          mode: morph.toMode,
          rect: morph.geometry.to,
          phase: "target" as const,
        },
      ]
    : [
        {
          mode,
          rect: null,
          phase: "stable" as const,
        },
      ];

  return (
    <div
      className="floating-island-stage h-full w-full"
      data-morphing={morph ? "true" : "false"}
      aria-busy={morph ? "true" : undefined}
    >
      {surfaceLayers ? (
        surfaceLayers.map((layer) => (
          <div
            key={layer.shape}
            aria-hidden="true"
            data-testid={
              layer.shape === displayedShape
                ? "floating-island-surface"
                : "floating-island-surface-outgoing"
            }
            data-shape={layer.shape}
            data-active={morph?.active ? "true" : "false"}
            className={cn(
              "floating-island-surface text-card-foreground",
              layer.shape === "compact" ? "floating-pill" : "window-shell",
            )}
            style={layer.style}
            onTransitionEnd={handleTransitionEnd}
            onTransitionCancel={(event) => {
              if (
                morph?.active &&
                event.currentTarget === event.target &&
                event.propertyName === "transform"
              ) {
                completeMorph(morph.id);
              }
            }}
          />
        ))
      ) : (
        <div
          aria-hidden="true"
          data-testid="floating-island-surface"
          data-shape={displayedShape}
          data-active="false"
          className={cn(
            "floating-island-surface floating-island-surface-stable text-card-foreground",
            isCompactShape(displayedMode)
              ? "floating-pill rounded-pill"
              : "window-shell rounded-premium",
          )}
        />
      )}

      {contentLayers.map((layer) => (
        <div
          key={layer.mode}
          className={cn(
            "floating-island-content",
            isCompactShape(layer.mode) ? "rounded-pill" : "rounded-premium",
          )}
          data-phase={layer.phase}
          data-active={morph?.active ? "true" : "false"}
          aria-hidden={morph ? "true" : undefined}
          inert={morph ? true : undefined}
          style={
            layer.rect && morph
              ? contentRectStyle(layer.rect, morph.geometry)
              : undefined
          }
        >
          {renderMode(layer.mode)}
        </div>
      ))}
    </div>
  );
}
