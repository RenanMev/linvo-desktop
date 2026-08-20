import {
  applyWindowBoundsImmediate,
  logicalToPhysical,
  readWindowBounds,
  releaseMinWindowSize,
} from "@/lib/window-animation";
import { COMPACT_SIZE, windowSizeForVisual } from "@/lib/window-mode";
import { clampToMonitor, type Size } from "@/lib/window-position";
import {
  clearRestoreOrigin,
  loadRestoreOrigin,
  resolveRestorePosition,
} from "@/lib/window-restore-origin";
import { loadSavedAnchor, saveSavedPosition } from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";
import { applyIslandWindowRegion } from "@/lib/window-region";

/**
 * Tolerância de 1px: os bounds físicos vêm de `Math.ceil` sobre a escala do
 * monitor, então em 125%/150% o tamanho lido pode ficar 1px acima do alvo.
 */
export const COMPACT_BOUNDS_TOLERANCE_PX = 1;

export type EnsureCompactBoundsOptions = {
  /**
   * Reavaliado logo antes de aplicar os bounds. A tarefa fica numa fila
   * (`enqueueWindowAnimation`), então uma expansão pode ter começado entre o
   * agendamento e a execução — sem esta checagem a reconciliação encolheria a
   * janela recém-expandida.
   */
  shouldApply?: () => boolean;
};

export function isCompactWindowSize(
  current: Size,
  target: Size,
  tolerance = COMPACT_BOUNDS_TOLERANCE_PX,
): boolean {
  return (
    Math.abs(current.width - target.width) <= tolerance &&
    Math.abs(current.height - target.height) <= tolerance
  );
}

/**
 * Devolve a janela ao tamanho da pílula quando ela ficou expandida sem que o
 * React ainda esteja no modo expandido.
 *
 * Existe porque o morph é feito em duas metades independentes — bounds nativos
 * de um lado, CSS do outro. Todo caminho que aborta no meio (deadline de fecho
 * estourado, intenção trocada durante a expansão, erro de IPC) deixa a janela
 * grande com a barra compacta desenhada dentro dela. Em vez de tapar cada um
 * desses buracos, o estado compacto é reconciliado quando assenta.
 *
 * @returns `true` se precisou corrigir os bounds.
 */
export async function ensureCompactWindowBounds(
  options: EnsureCompactBoundsOptions = {},
): Promise<boolean> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(windowSizeForVisual(COMPACT_SIZE), scale);
    const current = await readWindowBounds(win);

    if (isCompactWindowSize(current.size, targetSize)) {
      return false;
    }
    if (options.shouldApply?.() === false) {
      return false;
    }

    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;
    const restored = resolveRestorePosition({
      origin:
        loadRestoreOrigin("quick-menu") ?? loadRestoreOrigin("checklist"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    const position = restored
      ? monitorInfo
        ? clampToMonitor(restored, targetSize, monitorInfo)
        : restored
      : resolveCollapsePosition({
          currentPosition: current.position,
          currentSize: current.size,
          targetSize,
          monitor: monitorInfo,
          anchor,
        });

    if (options.shouldApply?.() === false) {
      return false;
    }

    // Sem limpar o mínimo do quick menu o Windows trava o `SetWindowPos` no
    // tamanho expandido e a janela não encolhe.
    await releaseMinWindowSize(win);
    await win.setResizable(false);
    await applyWindowBoundsImmediate(win, { position, size: targetSize });
    // A região faz parte do estado compacto: um morph abortado deixa a janela
    // sem recorte, e sem isto as faixas laterais seguiriam captando cliques.
    await applyIslandWindowRegion({
      visual: COMPACT_SIZE,
      scaleFactor: scale,
      radius: COMPACT_SIZE.height / 2,
    });

    clearRestoreOrigin("quick-menu");
    clearRestoreOrigin("checklist");
    saveSavedPosition(position);
    return true;
  });
}
