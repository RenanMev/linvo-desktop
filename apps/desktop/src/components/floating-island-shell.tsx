import { motion, type Transition, type TargetAndTransition } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import {
  ISLAND_CONTENT_DELAY_RATIO,
  ISLAND_EXPANDED_RADIUS_PX,
  ISLAND_IDENTITY_FLIP,
  ISLAND_MORPH_COLLAPSE_DURATION_MS,
  ISLAND_MORPH_COMPACT_RADIUS_PX,
  ISLAND_MORPH_CONTENT_DISTANCE_PX,
  ISLAND_MORPH_CONTENT_EXIT_DISTANCE_PX,
  ISLAND_MORPH_DURATION_MS,
  ISLAND_MORPH_FADE_RATIO,
  ISLAND_MORPH_WATCHDOG_MS,
  islandMorphSettleMs,
  resolveCompactRect,
  resolveExpandedRect,
  resolveFullClipPath,
  resolveIslandPlacement,
  resolveRectFlip,
  resolveRevealClipPath,
  resolveStablePlacement,
  type IslandMorphGeometry,
  type IslandRect,
} from "@/lib/floating-island-transition";
import {
  islandRectForMode,
  radiusForEnvelopeMode,
  type IslandEnvelopeMode,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import { cn } from "@/lib/utils";

export type FloatingIslandMode =
  | "compact"
  | "quick-menu"
  | "checklist"
  | "edge-collapsed";

export type FloatingIslandMorph = {
  id: number;
  active: boolean;
  settled?: boolean;
  fromMode: FloatingIslandMode;
  toMode: FloatingIslandMode;
  geometry: IslandMorphGeometry;
};

type FloatingIslandShellProps = {
  mode: FloatingIslandMode;
  morph: FloatingIslandMorph | null;
  renderMode: (mode: FloatingIslandMode) => ReactNode;
  onMorphComplete: (id: number) => void;
  /**
   * Largura do desenho do modo `edge-collapsed`, em px lógicos — o único modo
   * que ainda não tem retângulo dentro do envelope (`stableRectForMode`
   * devolve `null` para ele, já que a janela do handle é do próprio tamanho
   * do handle, sem envelope por baixo). Some do CSS quando os outros três
   * modos assentam, que passam a ter posição explícita.
   */
  visualWidth: number;
  /** Direção de crescimento do envelope (ver `docs/SDD-ILHA-ENVELOPE.md`). */
  growth: IslandGrowthDirection;
};

/**
 * Retângulo assentado de `mode` dentro do envelope, ou `null` para
 * `edge-collapsed` — que segue usando a janela própria do tamanho do handle,
 * sem envelope por baixo (ver `docs/SDD-ILHA-ENVELOPE.md`).
 */
function stableRectForMode(
  mode: FloatingIslandMode,
  growth: IslandGrowthDirection,
): IslandRect | null {
  if (mode === "edge-collapsed") {
    return null;
  }
  return islandRectForMode(mode as IslandEnvelopeMode, growth);
}

type StageStyle = CSSProperties & {
  "--island-visual-width"?: string;
};

/**
 * Molas do morph, uma por direção.
 *
 * `visualDuration` é o tempo até a forma *parecer* ter chegado (não o tempo
 * até a mola assentar por completo), e `bounce` é o quanto ela passa do alvo.
 * São os dois parâmetros perceptuais do Motion — bem mais estáveis de ajustar
 * que `stiffness`/`damping`/`mass`, onde mexer num muda o significado dos
 * outros.
 *
 * Abrir passa um pouco do alvo (`bounce: 0.18`, ~4% de overshoot) — é o que
 * dá peso ao movimento. Fechar não passa nada (`bounce: 0`): uma pílula que
 * quica ao fechar lê como erro, e o overshoot ainda esbarraria na borda da
 * tela quando a ilha está encostada.
 *
 * O overshoot da abertura precisa caber no envelope E na região recortada da
 * janela — ver `ISLAND_MORPH_REGION_SLACK_PX`, que infla o recorte durante o
 * morph justamente para não cortar o pico numa linha reta.
 */
const EXPAND_SPRING: Transition = {
  type: "spring",
  visualDuration: ISLAND_MORPH_DURATION_MS / 1000,
  bounce: 0.18,
};

const COLLAPSE_SPRING: Transition = {
  type: "spring",
  visualDuration: ISLAND_MORPH_COLLAPSE_DURATION_MS / 1000,
  bounce: 0,
};

/**
 * Transição completa de uma superfície: mola na geometria, tween curto na
 * opacidade.
 *
 * Opacidade não entra na mola de propósito — uma mola em opacidade pode
 * passar de 1 e ser cortada, o que aparece como um flash. E o cross-fade
 * precisa acabar ANTES da geometria: é o atraso dele que deixaria ver a borda
 * da forma que sai já esticada pelo `scale`.
 */
function surfaceTransition(expanding: boolean): Transition {
  const durationMs = expanding
    ? ISLAND_MORPH_DURATION_MS
    : ISLAND_MORPH_COLLAPSE_DURATION_MS;
  return {
    ...(expanding ? EXPAND_SPRING : COLLAPSE_SPRING),
    opacity: {
      type: "tween",
      duration: (durationMs * ISLAND_MORPH_FADE_RATIO) / 1000,
      ease: "easeOut",
    },
  };
}

function isCompactShape(mode: FloatingIslandMode): boolean {
  return mode === "compact" || mode === "edge-collapsed";
}

/** Raio da forma de `mode`, para o recorte do conteúdo casar com a casca. */
function radiusForShape(mode: FloatingIslandMode): number {
  return isCompactShape(mode)
    ? ISLAND_MORPH_COMPACT_RADIUS_PX
    : ISLAND_EXPANDED_RADIUS_PX;
}

function contentRectStyle(
  rect: IslandRect,
  geometry: IslandMorphGeometry,
): CSSProperties {
  return resolveIslandPlacement(rect, geometry);
}

/**
 * As duas camadas de conteúdo existem durante o morph inteiro — inclusive na
 * fase preparada, antes da mola começar.
 *
 * Montar o conteúdo de destino só no fim (o que esta função fazia) era o que
 * partia a abertura em duas etapas: a casca crescia vazia e o painel surgia
 * pronto depois. Montá-lo já na fase preparada resolve as duas metades do
 * problema: ele pode ser revelado junto com a casca (ver `clipPath` em
 * `contentAnimation`), e o custo de montar um painel inteiro fica ANTES do
 * primeiro quadro animado, em vez de no meio dele.
 *
 * Enquanto o morph não assenta as duas camadas ficam `inert` e sem
 * `pointer-events` — presentes e visíveis, mas nunca clicáveis a meio caminho.
 */
function shouldRenderContentLayer(
  phase: "source" | "target" | "stable",
  morph: FloatingIslandMorph | null,
): boolean {
  if (!morph) {
    return true;
  }
  if (morph.settled) {
    return phase === "stable";
  }
  return phase === "source" || phase === "target";
}

export type SurfaceLayer = {
  shape: "compact" | "expanded";
  /** Layout próprio da camada — não anima; é o retângulo onde ela mora. */
  style: CSSProperties;
  /** Alvo animado pelo Motion: geometria por FLIP mais opacidade. */
  animate: TargetAndTransition;
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
export function resolveSurfaceLayers(
  geometry: IslandMorphGeometry,
  displayedMode: FloatingIslandMode,
  fromMode: FloatingIslandMode,
): SurfaceLayer[] {
  const compactRect = resolveCompactRect(geometry);
  const expandedRect = resolveExpandedRect(geometry);
  const showsCompact = isCompactShape(displayedMode);
  const originIsCompact = isCompactShape(fromMode);

  const compactPlacement = resolveIslandPlacement(compactRect, geometry);
  const expandedPlacement = resolveIslandPlacement(expandedRect, geometry);

  const compactLayer: SurfaceLayer = {
    shape: "compact",
    fading: originIsCompact,
    style: {
      ...compactPlacement,
      // O raio de repouso, o mesmo do estado parado — ver
      // `ISLAND_MORPH_COMPACT_RADIUS_PX` para por que ele já não precisa ser
      // reduzido durante o morph.
      borderRadius: `${ISLAND_MORPH_COMPACT_RADIUS_PX}px`,
    },
    animate: {
      ...(showsCompact
        ? ISLAND_IDENTITY_FLIP
        : pickFlip(resolveRectFlip(expandedRect, compactRect))),
      opacity: originIsCompact && !showsCompact ? 0 : 1,
    },
  };

  const expandedLayer: SurfaceLayer = {
    shape: "expanded",
    fading: !originIsCompact,
    style: {
      ...expandedPlacement,
      borderRadius: `${ISLAND_EXPANDED_RADIUS_PX}px`,
    },
    animate: {
      ...(showsCompact
        ? pickFlip(resolveRectFlip(compactRect, expandedRect))
        : ISLAND_IDENTITY_FLIP),
      opacity: !originIsCompact && showsCompact ? 0 : 1,
    },
  };

  // A superfície de origem vai por último: é ela que some por cima da outra.
  return originIsCompact
    ? [expandedLayer, compactLayer]
    : [compactLayer, expandedLayer];
}

/** Só os componentes que o Motion anima — a string `transform` fica de fora. */
function pickFlip(flip: ReturnType<typeof resolveRectFlip>) {
  return { x: flip.x, y: flip.y, scaleX: flip.scaleX, scaleY: flip.scaleY };
}

function resolveSettledSurfaceLayer(
  geometry: IslandMorphGeometry,
  mode: FloatingIslandMode,
  fromMode: FloatingIslandMode,
): SurfaceLayer {
  const layers = resolveSurfaceLayers(geometry, mode, fromMode);
  const winningShape = isCompactShape(mode) ? "compact" : "expanded";
  const layer = layers.find((entry) => entry.shape === winningShape);
  return layer ?? layers[0]!;
}

export function FloatingIslandShell({
  mode,
  morph,
  renderMode,
  onMorphComplete,
  visualWidth,
  growth,
}: FloatingIslandShellProps) {
  const completedIdRef = useRef<number | null>(null);
  const isSettled = morph?.settled === true;
  const displayedMode = morph
    ? morph.settled || morph.active
      ? morph.toMode
      : morph.fromMode
    : mode;
  const displayedShape = isCompactShape(displayedMode) ? "compact" : "expanded";
  const displayedStableRect = stableRectForMode(displayedMode, growth);
  const settledSurface =
    isSettled && morph ? resolveSettledSurfaceLayer(morph.geometry, mode, morph.fromMode) : null;
  const surfaceLayers =
    morph && !isSettled
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

    /*
     * Failsafe para quando `onAnimationComplete` não chega. Dimensionado pela
     * ACOMODAÇÃO da mola, não pela duração visual — ver
     * `islandMorphSettleMs`: com o tempo visual ele vencia a corrida contra o
     * Motion e cortava a animação no meio.
     */
    const watchdog = window.setTimeout(
      () => completeMorph(morph.id),
      islandMorphSettleMs(isCompactShape(morph.fromMode)) +
        ISLAND_MORPH_WATCHDOG_MS,
    );
    return () => window.clearTimeout(watchdog);
  }, [morph?.active, morph?.id]);

  /**
   * Fim do morph, vindo do Motion.
   *
   * Só a camada de destino avisa (`leading`): `onAnimationComplete` dispara por
   * elemento, e a que sai termina o próprio tween de opacidade antes — assentar
   * ali comitaria o morph no meio do percurso da forma.
   */
  function handleAnimationComplete() {
    if (!morph?.active) {
      return;
    }
    /*
     * Um frame só. No colapso este callback é o que libera o `SetWindowPos`,
     * e a essa altura o Motion já desenhou a pílula: cada frame extra aqui é um
     * frame de janela expandida e transparente com o desktop em volta.
     */
    window.requestAnimationFrame(() => completeMorph(morph.id));
  }

  const contentLayers = morph?.settled
    ? [
        {
          mode,
          rect: stableRectForMode(mode, growth),
          phase: "stable" as const,
        },
      ]
    : morph
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
          rect: stableRectForMode(mode, growth),
          phase: "stable" as const,
        },
      ];

  /*
   * Abrir e fechar têm ritmos diferentes de propósito. A direção vem da
   * ORIGEM, não do modo exibido: enquanto o morph está preparado e ainda não
   * ativo, `displayedMode` é o modo de origem, e ler a direção dali inverteria
   * a curva no primeiro quadro — justamente o quadro que define a transição.
   */
  const morphIsExpanding = morph ? isCompactShape(morph.fromMode) : true;
  const morphDurationMs = morphIsExpanding
    ? ISLAND_MORPH_DURATION_MS
    : ISLAND_MORPH_COLLAPSE_DURATION_MS;

  /*
   * O conteúdo entra e sai em tempos diferentes, de propósito. O que sai vai
   * embora rápido e sem espera (senão fica legível por cima da forma já
   * deformada pelo scale); o que entra só começa depois que a casca fez o
   * grosso do percurso. É esse escalonamento que faz a transição ler como uma
   * coisa se transformando, e não duas telas trocando.
   */
  const contentDelay = (morphDurationMs * ISLAND_CONTENT_DELAY_RATIO) / 1000;
  const contentExitDuration =
    (morphDurationMs * ISLAND_MORPH_FADE_RATIO) / 1000;

  function contentAnimation(phase: "source" | "target" | "stable"): {
    initial?: TargetAndTransition | false;
    animate?: TargetAndTransition;
    transition?: Transition;
  } {
    /*
     * O repouso é um alvo EXPLÍCITO, nunca a ausência de `animate`.
     *
     * O Motion não restaura nada quando o prop some: ele deixa no elemento o
     * último valor que escreveu inline. Como as camadas são chaveadas por
     * modo, a mesma camada que saiu de um morph com `opacity: 0` reaparece
     * como a camada estável — e ficava invisível para sempre, com o conteúdo
     * só aparecendo enquanto algo estava animando.
     */
    if (phase === "stable" || !morph) {
      return {
        initial: false,
        animate: {
          opacity: 1,
          y: 0,
          // Também explícito: um `clipPath` deixado pelo morph anterior
          // esconderia parte do conteúdo parado para sempre.
          clipPath: resolveFullClipPath(radiusForShape(mode)),
        },
        transition: { duration: 0 },
      };
    }
    /*
     * O recorte acompanha a casca na MESMA mola, e é ele que costura as duas
     * metades da transição: o conteúdo é revelado dentro da forma enquanto ela
     * abre, em vez de aparecer depois que ela parou.
     *
     * A opacidade continua num tween curto e separado — uma mola em opacidade
     * pode passar de 1 e ser cortada, o que aparece como flash.
     */
    const spring = morphIsExpanding ? EXPAND_SPRING : COLLAPSE_SPRING;

    if (phase === "source") {
      // O que sai encolhe para dentro da forma de destino enquanto ela fecha.
      return {
        initial: false,
        animate: morph.active
          ? {
              opacity: 0,
              y: ISLAND_MORPH_CONTENT_EXIT_DISTANCE_PX,
              clipPath: resolveRevealClipPath(
                morph.geometry.from,
                morph.geometry.to,
                radiusForShape(morph.toMode),
              ),
            }
          : {
              opacity: 1,
              y: 0,
              clipPath: resolveFullClipPath(radiusForShape(morph.fromMode)),
            },
        transition: {
          ...spring,
          opacity: {
            type: "tween",
            duration: contentExitDuration,
            ease: "easeOut",
          },
        },
      };
    }

    // O que entra é revelado a partir do retângulo da forma de origem.
    return {
      initial: false,
      animate: morph.active
        ? {
            opacity: 1,
            y: 0,
            clipPath: resolveFullClipPath(radiusForShape(morph.toMode)),
          }
        : {
            opacity: 0,
            y: ISLAND_MORPH_CONTENT_DISTANCE_PX,
            clipPath: resolveRevealClipPath(
              morph.geometry.to,
              morph.geometry.from,
              radiusForShape(morph.fromMode),
            ),
          },
      transition: morph.active
        ? {
            ...spring,
            opacity: {
              type: "tween",
              duration: contentExitDuration,
              ease: "easeOut",
              delay: contentDelay,
            },
          }
        : { duration: 0 },
    };
  }

  const stageStyle: StageStyle = {
    "--island-visual-width": `${visualWidth}px`,
  };

  return (
    <div
      className="floating-island-stage h-full w-full"
      style={stageStyle}
      data-morphing={morph && !isSettled ? "true" : "false"}
      aria-busy={morph && !isSettled ? "true" : undefined}
    >
      {settledSurface ? (
        <motion.div
          aria-hidden="true"
          data-testid="floating-island-surface"
          data-shape={displayedShape}
          data-settled="true"
          data-active="false"
          className={cn(
            "floating-island-surface text-card-foreground",
            settledSurface.shape === "compact" ? "floating-pill" : "window-shell",
          )}
          style={settledSurface.style}
          // Assentado não anima: o quadro é idêntico ao último do morph, e
          // animar aqui reintroduziria o encolhe-e-volta no fim de cada
          // transição.
          initial={false}
          animate={settledSurface.animate}
          transition={{ duration: 0 }}
        />
      ) : surfaceLayers ? (
        surfaceLayers.map((layer) => (
          <motion.div
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
            /*
             * `initial={false}` faz a camada nascer já no estado preparado, sem
             * animar. É o que preserva a orquestração em duas etapas do
             * BarApp (preparar → pintar → ativar): a animação começa quando
             * `morph.active` vira true e o alvo muda, não na montagem.
             */
            initial={false}
            animate={layer.animate}
            transition={surfaceTransition(morphIsExpanding)}
            onAnimationComplete={
              layer.shape === displayedShape ? handleAnimationComplete : undefined
            }
          />
        ))
      ) : displayedStableRect ? (
        <div
          aria-hidden="true"
          data-testid="floating-island-surface"
          data-shape={displayedShape}
          data-active="false"
          className={cn(
            "floating-island-surface text-card-foreground",
            isCompactShape(displayedMode)
              ? "floating-pill rounded-pill"
              : "window-shell rounded-premium",
          )}
          style={{
            ...resolveStablePlacement(displayedStableRect),
            borderRadius: `${radiusForEnvelopeMode(displayedMode as IslandEnvelopeMode)}px`,
          }}
        />
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
        <motion.div
          key={layer.mode}
          className={cn(
            "floating-island-content",
            isCompactShape(layer.mode) ? "rounded-pill" : "rounded-premium",
          )}
          data-phase={layer.phase}
          data-active={morph?.active ? "true" : "false"}
          aria-hidden={morph && !morph.settled ? "true" : undefined}
          inert={morph && !morph.settled ? true : undefined}
          style={
            layer.phase === "stable"
              ? layer.rect
                ? resolveStablePlacement(layer.rect)
                : undefined
              : layer.rect && morph
              ? contentRectStyle(layer.rect, morph.geometry)
              : undefined
          }
          {...contentAnimation(layer.phase)}
        >
          {shouldRenderContentLayer(layer.phase, morph)
            ? renderMode(layer.mode)
            : null}
        </motion.div>
      ))}
    </div>
  );
}
