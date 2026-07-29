import { clampToMonitor, type MonitorInfo, type Position, type Size } from "@/lib/window-position";

export type EdgeAnchor = {
  horizontal: "left" | "right" | null;
  vertical: "top" | "bottom" | null;
};

export const NO_ANCHOR: EdgeAnchor = { horizontal: null, vertical: null };

export function isAnchored(anchor: EdgeAnchor): boolean {
  return anchor.horizontal !== null || anchor.vertical !== null;
}

export function applyAnchor(input: {
  anchor: EdgeAnchor;
  size: Size;
  workArea: MonitorInfo;
  previousPosition: Position;
}): Position {
  const { anchor, size, workArea, previousPosition } = input;

  let x = previousPosition.x;
  let y = previousPosition.y;

  if (anchor.horizontal === "left") {
    x = workArea.position.x;
  } else if (anchor.horizontal === "right") {
    x = workArea.position.x + workArea.size.width - size.width;
  }

  if (anchor.vertical === "top") {
    y = workArea.position.y;
  } else if (anchor.vertical === "bottom") {
    y = workArea.position.y + workArea.size.height - size.height;
  }

  return clampToMonitor({ x, y }, size, workArea);
}

export function resolveSnap(input: {
  position: Position;
  size: Size;
  workArea: MonitorInfo;
  threshold: number;
}): { position: Position; anchor: EdgeAnchor } {
  const { position, size, workArea, threshold } = input;

  const distLeft = position.x - workArea.position.x;
  const distRight =
    workArea.position.x + workArea.size.width - (position.x + size.width);
  const distTop = position.y - workArea.position.y;
  const distBottom =
    workArea.position.y + workArea.size.height - (position.y + size.height);

  let horizontal: EdgeAnchor["horizontal"] = null;
  if (distLeft <= threshold && distLeft <= distRight) {
    horizontal = "left";
  } else if (distRight <= threshold) {
    horizontal = "right";
  }

  let vertical: EdgeAnchor["vertical"] = null;
  if (distTop <= threshold && distTop <= distBottom) {
    vertical = "top";
  } else if (distBottom <= threshold) {
    vertical = "bottom";
  }

  if (horizontal === null && vertical === null) {
    return { position, anchor: NO_ANCHOR };
  }

  const anchor: EdgeAnchor = { horizontal, vertical };
  return {
    position: applyAnchor({ anchor, size, workArea, previousPosition: position }),
    anchor,
  };
}

export function serializeAnchor(anchor: EdgeAnchor): string {
  return JSON.stringify(anchor);
}

export function parseAnchor(raw: string | null): EdgeAnchor | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const horizontal = (value as EdgeAnchor).horizontal;
    const vertical = (value as EdgeAnchor).vertical;
    const validHorizontal =
      horizontal === "left" || horizontal === "right" || horizontal === null;
    const validVertical =
      vertical === "top" || vertical === "bottom" || vertical === null;

    if (validHorizontal && validVertical) {
      return { horizontal, vertical };
    }
    return null;
  } catch {
    return null;
  }
}
