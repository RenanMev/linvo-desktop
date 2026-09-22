import { vi } from "vitest";

const {
  invokeMock,
  setPositionMock,
  setSizeMock,
  setFocusMock,
  setDecorationsMock,
  setAlwaysOnTopMock,
  setSkipTaskbarMock,
  setResizableMock,
  setMaximizableMock,
  setMinSizeMock,
  setMaxSizeMock,
  showMock,
  hideMock,
  unminimizeMock,
  emitMock,
  emitToMock,
  listenMock,
  availableMonitorsMock,
  currentMonitorMock,
  pluginStoreData,
  pluginStoreMock,
  autostartEnableMock,
  autostartDisableMock,
  autostartIsEnabledMock,
  defaultMonitor,
} = vi.hoisted(() => {
  const monitor = {
    name: "DISPLAY1",
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
  };
  const storeData = new Map<string, unknown>();
  return {
    invokeMock: vi.fn(),
    setPositionMock: vi.fn(() => Promise.resolve()),
    setSizeMock: vi.fn(() => Promise.resolve()),
    setFocusMock: vi.fn(() => Promise.resolve()),
    setDecorationsMock: vi.fn(() => Promise.resolve()),
    setAlwaysOnTopMock: vi.fn(() => Promise.resolve()),
    setSkipTaskbarMock: vi.fn(() => Promise.resolve()),
    setResizableMock: vi.fn(() => Promise.resolve()),
    setMaximizableMock: vi.fn(() => Promise.resolve()),
    setMinSizeMock: vi.fn(() => Promise.resolve()),
    setMaxSizeMock: vi.fn(() => Promise.resolve()),
    showMock: vi.fn(() => Promise.resolve()),
    hideMock: vi.fn(() => Promise.resolve()),
    unminimizeMock: vi.fn(() => Promise.resolve()),
    emitMock: vi.fn(() => Promise.resolve()),
    emitToMock: vi.fn(() => Promise.resolve()),
    listenMock: vi.fn((..._args: unknown[]) => Promise.resolve(() => {})),
    availableMonitorsMock: vi.fn(() => Promise.resolve([monitor])),
    currentMonitorMock: vi.fn(() => Promise.resolve(monitor)),
    pluginStoreData: storeData,
    pluginStoreMock: {
      get: vi.fn(async (key: string) => storeData.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        storeData.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        storeData.delete(key);
      }),
      save: vi.fn(async () => {}),
      has: vi.fn(async (key: string) => storeData.has(key)),
    },
    autostartEnableMock: vi.fn(() => Promise.resolve()),
    autostartDisableMock: vi.fn(() => Promise.resolve()),
    autostartIsEnabledMock: vi.fn(() => Promise.resolve(false)),
    defaultMonitor: monitor,
  };
});

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
    onScaleChanged: vi.fn(() => Promise.resolve(() => {})),
    outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
    outerSize: vi.fn(() => Promise.resolve({ width: 140, height: 40 })),
    scaleFactor: vi.fn(() => Promise.resolve(1)),
    currentMonitor: vi.fn(() => Promise.resolve(defaultMonitor)),
  };
}

export const windowMock = createWindowMock("main");
export const panelWindowMock = createWindowMock("panel");

class Window {
  static getByLabel(label: string) {
    if (label === "main") {
      return Promise.resolve(windowMock);
    }
    if (label === "panel") {
      return Promise.resolve(panelWindowMock);
    }
    return Promise.resolve(null);
  }
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  isTauri: () => false,
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(() => Promise.resolve("0.1.1")),
  defaultWindowIcon: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: emitMock,
  emitTo: emitToMock,
  listen: listenMock,
}));

vi.mock("@tauri-apps/api/window", () => ({
  Window,
  getCurrentWindow: () => windowMock,
  currentMonitor: currentMonitorMock,
  availableMonitors: availableMonitorsMock,
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

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(() => Promise.resolve(pluginStoreMock)),
  },
}));

vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: autostartEnableMock,
  disable: autostartDisableMock,
  isEnabled: autostartIsEnabledMock,
}));

export function resetPluginStoreMock() {
  pluginStoreData.clear();
  pluginStoreMock.get.mockClear();
  pluginStoreMock.set.mockClear();
  pluginStoreMock.delete.mockClear();
  pluginStoreMock.save.mockClear();
  pluginStoreMock.has.mockClear();
}

export {
  invokeMock,
  emitMock,
  emitToMock,
  listenMock,
  setPositionMock,
  setSizeMock,
  setFocusMock,
  setDecorationsMock,
  setAlwaysOnTopMock,
  setResizableMock,
  setMaximizableMock,
  setMinSizeMock,
  setMaxSizeMock,
  showMock,
  hideMock,
  unminimizeMock,
  availableMonitorsMock,
  currentMonitorMock,
  pluginStoreData,
  pluginStoreMock,
  autostartEnableMock,
  autostartDisableMock,
  autostartIsEnabledMock,
};
