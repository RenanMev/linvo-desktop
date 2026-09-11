import { describe, expect, it, vi } from "vitest";

import { buildTrayMenuItems } from "@/lib/system-tray";
import { createFloatingTrayHandlers, defaultTrayHandlers } from "@/lib/tray-handlers";

describe("createFloatingTrayHandlers", () => {
  it("T6.1 openChat chama expandAssist e não openPanel", async () => {
    const expandAssist = vi.fn(async () => {});
    const openPanel = vi.fn(async () => {});
    const handlers = createFloatingTrayHandlers({
      expandAssist,
      openWorkspace: async () => {
        await openPanel("/chat");
      },
    });

    await handlers.openChat();

    expect(expandAssist).toHaveBeenCalledTimes(1);
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("T6.2 openWorkspace chama openPanel(/chat)", async () => {
    const expandAssist = vi.fn(async () => {});
    const openPanel = vi.fn(async () => {});
    const handlers = createFloatingTrayHandlers({
      expandAssist,
      openWorkspace: async () => {
        await openPanel("/chat");
      },
    });

    await handlers.openWorkspace();

    expect(openPanel).toHaveBeenCalledWith("/chat");
    expect(expandAssist).not.toHaveBeenCalled();
  });
});

describe("buildTrayMenuItems floating", () => {
  it("T6.3 menu floating contém Abrir workspace e Abrir chat", () => {
    const items = buildTrayMenuItems(
      {
        phase: "floating",
        user: {
          id: "1",
          name: "Renan",
          email: "renan@test.com",
          createdAt: "2026-01-01",
        },
      },
      defaultTrayHandlers,
    );

    const labels = items
      .filter((item) => typeof item === "object" && "text" in item)
      .map((item) => (item as { text: string }).text);

    expect(labels).toContain("Abrir workspace");
    expect(labels).toContain("Abrir chat");
  });
});
