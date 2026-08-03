export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type MonitorInfo = {
  position: Position;
  size: Size;
};

export function computeBottomLeft(
  monitor: MonitorInfo,
  winSize: Size,
  margin: number,
): Position {
  return {
    x: monitor.position.x + margin,
    y: monitor.position.y + monitor.size.height - winSize.height - margin,
  };
}

export function computeTopCenter(
  monitor: MonitorInfo,
  winSize: Size,
  margin: number,
): Position {
  return {
    x:
      monitor.position.x +
      Math.max(0, Math.floor((monitor.size.width - winSize.width) / 2)),
    y: monitor.position.y + margin,
  };
}

export function clampToMonitor(
  pos: Position,
  winSize: Size,
  monitor: MonitorInfo,
): Position {
  const minX = monitor.position.x;
  const minY = monitor.position.y;
  const maxX = monitor.position.x + Math.max(0, monitor.size.width - winSize.width);
  const maxY = monitor.position.y + Math.max(0, monitor.size.height - winSize.height);

  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

export function isFullyVisibleOnMonitor(
  pos: Position,
  winSize: Size,
  monitor: MonitorInfo,
): boolean {
  const clamped = clampToMonitor(pos, winSize, monitor);
  return clamped.x === pos.x && clamped.y === pos.y;
}

export function serializePosition(pos: Position): string {
  return JSON.stringify({ x: pos.x, y: pos.y });
}

export function parsePosition(raw: string | null): Position | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "x" in value &&
      "y" in value &&
      typeof (value as Position).x === "number" &&
      typeof (value as Position).y === "number" &&
      Number.isFinite((value as Position).x) &&
      Number.isFinite((value as Position).y)
    ) {
      return { x: (value as Position).x, y: (value as Position).y };
    }
    return null;
  } catch {
    return null;
  }
}
