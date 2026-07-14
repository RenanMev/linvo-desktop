import { defaultWindowIcon } from "@tauri-apps/api/app";
import {
  Menu,
  type MenuItemOptions,
  type PredefinedMenuItemOptions,
} from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";

import {
  hideAllWindows,
  isAnyWindowVisible,
  showMainBar,
  toggleAppVisibility,
} from "@/lib/app-windows";
import {
  defaultTrayHandlers,
  type TrayAppState,
  type TrayHandlers,
} from "@/lib/tray-handlers";

const TRAY_ID = "linvo-desktop-tray";

let trayInstance: TrayIcon | null = null;
let initPromise: Promise<void> | null = null;
let trayState: TrayAppState = { phase: "checking", user: null };
let trayHandlers: TrayHandlers = defaultTrayHandlers;

export function updateTrayAuthState(state: TrayAppState): void {
  trayState = state;
  void rebuildTrayMenu();
}

export function registerTrayHandlers(handlers: TrayHandlers): void {
  trayHandlers = handlers;
  void rebuildTrayMenu();
}

function isFloatingPhase(phase: TrayAppState["phase"]): boolean {
  return phase === "floating";
}

export function buildTrayMenuItems(
  state: TrayAppState,
  handlers: TrayHandlers,
): Array<MenuItemOptions | PredefinedMenuItemOptions> {
  const floating = isFloatingPhase(state.phase);
  const hasUser = state.user !== null;

  if (floating) {
    return [
      {
        id: "show-bar",
        text: "Mostrar barra",
        action: () => {
          void showMainBar();
        },
      },
      {
        id: "open-chat",
        text: "Abrir chat",
        enabled: hasUser,
        action: () => {
          void handlers.openChat();
        },
      },
      {
        id: "open-settings",
        text: "Abrir configurações",
        enabled: hasUser,
        action: () => {
          void handlers.openSettings();
        },
      },
      { item: "Separator" },
      {
        id: "hide-all",
        text: "Ocultar tudo",
        action: () => {
          void hideAllWindows();
        },
      },
      { item: "Separator" },
      {
        id: "quit",
        text: "Sair",
        action: () => {
          void handlers.logoutAndQuit();
        },
      },
    ];
  }

  return [
    {
      id: "show",
      text: "Abrir Linvo Desktop",
      action: () => {
        void showMainBar();
      },
    },
    {
      id: "hide",
      text: "Ocultar",
      action: () => {
        void hideAllWindows();
      },
    },
    { item: "Separator" },
    {
      id: "quit",
      text: "Sair",
      action: () => {
        void handlers.logoutAndQuit();
      },
    },
  ];
}

async function updateTrayTooltip(): Promise<void> {
  if (!trayInstance) {
    return;
  }
  const visible = await isAnyWindowVisible();
  await trayInstance.setTooltip(
    visible ? "Linvo Desktop — Ativo" : "Linvo Desktop — Oculto",
  );
}

export async function rebuildTrayMenu(): Promise<void> {
  if (!trayInstance) {
    return;
  }

  const menu = await Menu.new({
    items: buildTrayMenuItems(trayState, trayHandlers),
  });
  await trayInstance.setMenu(menu);
  await updateTrayTooltip();
}

export async function initSystemTray(): Promise<void> {
  if (trayInstance) {
    await rebuildTrayMenu();
    return;
  }

  initPromise ??= createTrayOnce();
  await initPromise;
}

async function createTrayOnce(): Promise<void> {
  const existing = await TrayIcon.getById(TRAY_ID);
  if (existing) {
    trayInstance = existing;
    await rebuildTrayMenu();
    return;
  }

  const menu = await Menu.new({
    items: buildTrayMenuItems(trayState, trayHandlers),
  });

  const icon = await defaultWindowIcon();
  const visible = await isAnyWindowVisible();

  trayInstance = await TrayIcon.new({
    id: TRAY_ID,
    icon: icon ?? undefined,
    tooltip: visible ? "Linvo Desktop — Ativo" : "Linvo Desktop — Oculto",
    menu,
    showMenuOnLeftClick: false,
    action: (event) => {
      if (
        event.type === "Click" &&
        event.button === "Left" &&
        event.buttonState === "Up"
      ) {
        void toggleAppVisibility().then(() => rebuildTrayMenu());
      }
    },
  });

  await rebuildTrayMenu();
}

export { hideAllWindows, showMainBar as showMainWindow, toggleAppVisibility };
