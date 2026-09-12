import {
  applyWindowBoundsImmediate,
  logicalToPhysical,
  readWindowBounds,
  releaseMinWindowSize,
} from "@/lib/window-animation";
import {
  COMPACT_SIZE,
  envelopePositionForPill,
  ISLAND_ENVELOPE_SIZE,
  pillPositionForEnvelope,
  type IslandGrowthDirection,
} from "@/lib/window-mode";
import { clampToMonitor, type Size } from "@/lib/window-position";
import { applyIslandRegionForMode } from "@/lib/window-region";
import {
  clearRestoreOrigin,
  loadRestoreOrigin,
  resolveRestorePosition,
} from "@/lib/window-restore-origin";
import { loadSavedAnchor, saveIslandPillPosition } from "@/lib/window-storage";
import {
  enqueueWindowAnimation,
  getCurrentWindow,
  resolveCollapsePosition,
} from "@/lib/window-transition";
import { readWorkArea } from "@/lib/window-work-area";

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
 * Devolve a janela ao envelope fixo (ver `docs/SDD-ILHA-ENVELOPE.md`) e
 * reconcilia a região de recorte para a pílula, quando algo ficou fora do
 * lugar.
 *
 * Desde o envelope fixo, `compact`/`quick-menu`/`checklist` nunca redimensionam
 * a janela — só o modo `edge-collapsed` ainda faz isso, encolhendo para o
 * tamanho do handle. Um caminho que aborta no meio dessa ida-e-volta (deadline
 * de fecho estourado, erro de IPC) pode deixar a janela do tamanho do handle
 * em vez do envelope; é esse desvio que esta função corrige.
 *
 * A região é reconciliada mesmo quando o tamanho já está certo: um morph
 * abortado no meio (compact ↔ quick-menu/checklist) deixa o recorte na forma
 * errada sem nunca mexer no tamanho da janela, e reaplicar o recorte é uma
 * chamada de IPC barata e idempotente.
 *
 * @returns `true` se precisou corrigir os bounds da janela (não conta a
 * reconciliação de região sozinha).
 */
export async function ensureCompactWindowBounds(
  growth: IslandGrowthDirection,
  options: EnsureCompactBoundsOptions = {},
): Promise<boolean> {
  return enqueueWindowAnimation(async () => {
    const win = getCurrentWindow();
    const scale = await win.scaleFactor();
    const targetSize = logicalToPhysical(ISLAND_ENVELOPE_SIZE, scale);
    const current = await readWindowBounds(win);

    if (isCompactWindowSize(current.size, targetSize)) {
      if (options.shouldApply?.() === false) {
        return false;
      }
      await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });
      return false;
    }

    if (options.shouldApply?.() === false) {
      return false;
    }

    const monitorInfo = await readWorkArea();
    const anchor = loadSavedAnchor() ?? undefined;
    const pillTargetSize = logicalToPhysical(COMPACT_SIZE, scale);

    // Só o edge mode ainda move a janela de verdade; se ele ficou destravado
    // no meio, a origem salva devolve a pílula ao pixel exato de onde saiu.
    const restoredPill = resolveRestorePosition({
      origin: loadRestoreOrigin("edge"),
      currentPosition: current.position,
      currentSize: current.size,
    });
    const pillPosition =
      restoredPill ??
      resolveCollapsePosition({
        currentPosition: current.position,
        currentSize: current.size,
        targetSize: pillTargetSize,
        monitor: monitorInfo,
        anchor,
      });

    let envelopePosition = envelopePositionForPill({
      pillPosition,
      growth,
      scaleFactor: scale,
    });
    if (monitorInfo) {
      envelopePosition = clampToMonitor(envelopePosition, targetSize, monitorInfo);
    }

    if (options.shouldApply?.() === false) {
      return false;
    }

    // Sem limpar o mínimo do quick menu o Windows trava o `SetWindowPos` no
    // tamanho expandido e a janela não encolhe.
    await releaseMinWindowSize(win);
    await win.setResizable(false);
    await applyWindowBoundsImmediate(win, { position: envelopePosition, size: targetSize });
    await applyIslandRegionForMode({ mode: "compact", growth, scaleFactor: scale });

    clearRestoreOrigin("edge");
    saveIslandPillPosition(
      pillPositionForEnvelope({ envelopePosition, growth, scaleFactor: scale }),
    );
    return true;
  });
}
