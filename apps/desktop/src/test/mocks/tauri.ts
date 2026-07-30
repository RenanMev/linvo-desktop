import { vi } from "vitest";

const invokeMock = vi.fn();

const setPositionMock = vi.fn(() => Promise.resolve());
const setSizeMock = vi.fn(() => Promise.resolve());
const setFocusMock = vi.fn(() => Promise.resolve());
const setDecorationsMock = vi.fn(() => Promise.resolve());
const setAlwaysOnTopMock = vi.fn(() => Promise.resolve());
const setSkipTaskbarMock = vi.fn(() => Promise.resolve());
const setResizableMock = vi.fn(() => Promise.resolve());
const setMaximizableMock = vi.fn(() => Promise.resolve());
const setMinSizeMock = vi.fn(() => Promise.resolve());
const setMaxSizeMock = vi.fn(() => Promise.resolve());
const showMock = vi.fn(() => Promise.resolve());
const hideMock = vi.fn(() => Promise.resolve());
const unminimizeMock = vi.fn(() => Promise.resolve());

function createWindowMock(label: string) {
  return {
    label,
    setPosition: setPositionMock,
    setSize: setSizeMock,
    setFocus: setFocusMock,
    setDecorations: setDecorationsMock,
    setAlwaysOnTop: setAlwaysOnTopMock,
    setSkipTaskbar: setSkipTaskbarMock,
    setResizable: setResizableMock,
    setMaximizable: setMaximizableMock,
    setMinSize: setMinSizeMock,
    setMaxSize: setMaxSizeMock,
    minimize: vi.fn(() => Promise.resolve()),
    maximize: vi.fn(() => Promise.resolve()),
    unmaximize: vi.fn(() => Promise.resolve()),
    toggleMaximize: vi.fn(() => Promise.resolve()),
    isMaximized: vi.fn(() => Promise.resolve(false)),
    close: vi.fn(() => Promise.resolve()),
    hide: hideMock,
    unminimize: unminimizeMock,
    isVisible: vi.fn(() => Promise.resolve(label === "main")),
    center: vi.fn(() => Promise.resolve()),
    show: showMock,
    onMoved: vi.fn(() => Promise.resolve(() => {})),
    onResized: vi.fn(() => Promise.resolve(() => {})),
    onCloseRequested: vi.fn(() => Promise.resolve(() => {})),
    onFocusChanged: vi.fn(() => Promise.resolve(() => {})),
    outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
    outerSize: vi.fn(() => Promise.resolve({ width: 140, height: 40 })),
    scaleFactor: vi.fn(() => Promise.resolve(1)),
    currentMonitor: vi.fn(() =>
      Promise.resolve({
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      }),
    ),
  };
}

export const windowMock = createWindowMock("main");
export const panelWindowMock = createWindowMock("panel");
export const checklistWindowMock = createWindowMock("checklist");

const emitMock = vi.fn(() => Promise.resolve());
const emitToMock = vi.fn(() => Promise.resolve());
const listenMock = vi.fn((..._args: unknown[]) =>
  Promise.resolve(() => {}),
);

class Window {
  static getByLabel(label: string) {
    if (label === "main") {
      return Promise.resolve(windowMock);
    }
    if (label === "panel") {
      return Promise.resolve(panelWindowMock);
    }
    if (label === "checklist") {
      return Promise.resolve(checklistWindowMock);
    }
    return Promise.resolve(null);
  }
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  isTauri: () => false,
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: emitMock,
  emitTo: emitToMock,
  listen: listenMock,
}));

vi.mock("@tauri-apps/api/window", () => ({
  Window,
  getCurrentWindow: () => windowMock,
  currentMonitor: vi.fn(() =>
    Promise.resolve({
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    }),
  ),
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
  LogicalSize: class LogicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
  PhysicalPosition: class PhysicalPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
  PhysicalSize: class PhysicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
}));

export {
  invokeMock,
  emitMock,
  emitToMock,
  listenMock,
  setPositionMock,
  setSizeMock,
  setFocusMock,
  setDecorationsMock,
  setResizableMock,
  setMaximizableMock,
  setMinSizeMock,
  setMaxSizeMock,
  showMock,
  hideMock,
};
