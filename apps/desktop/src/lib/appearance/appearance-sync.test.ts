import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@linvo/shared";

import {
  APPEARANCE_CHANGED_EVENT,
  emitAppearanceChanged,
  listenAppearanceChanged,
} from "@/lib/appearance/appearance-sync";
import { emitMock, listenMock } from "@/test/mocks/tauri";

function makePrefs(
  overrides: Partial<AppearancePreferences> = {},
): AppearancePreferences {
  return {
    ...APPEARANCE_DEFAULTS,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("appearance-sync", () => {
  beforeEach(() => {
    emitMock.mockReset();
    emitMock.mockResolvedValue(undefined);
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {});
  });

  it("emits the appearance-changed event with prefs and origin", async () => {
    const prefs = makePrefs({ themeMode: "dark" });
    await emitAppearanceChanged(prefs, "panel");

    expect(emitMock).toHaveBeenCalledWith(APPEARANCE_CHANGED_EVENT, {
      prefs,
      origin: "panel",
    });
  });

  it("registers a listener on the appearance-changed event", async () => {
    await listenAppearanceChanged(() => {});
    expect(listenMock).toHaveBeenCalledWith(
      APPEARANCE_CHANGED_EVENT,
      expect.any(Function),
    );
  });

  it("invokes the handler when the event comes from another window", async () => {
    const handler = vi.fn();
    await listenAppearanceChanged(handler);

    const callback = listenMock.mock.calls[0]?.[1] as unknown as (
      event: unknown,
    ) => void;
    const prefs = makePrefs();
    callback({ payload: { prefs, origin: "panel" } });

    expect(handler).toHaveBeenCalledWith(prefs);
  });

  it("ignores the event when its origin is the current window (anti-echo)", async () => {
    const handler = vi.fn();
    await listenAppearanceChanged(handler);

    // getCurrentWindow() no mock compartilhado resolve sempre para label "main".
    const callback = listenMock.mock.calls[0]?.[1] as unknown as (
      event: unknown,
    ) => void;
    callback({ payload: { prefs: makePrefs(), origin: "main" } });

    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a dispose function", async () => {
    const dispose = await listenAppearanceChanged(() => {});
    expect(typeof dispose).toBe("function");
  });

  it("does not throw when emitting with the checklist window closed", async () => {
    await expect(
      emitAppearanceChanged(makePrefs(), "checklist"),
    ).resolves.toBeUndefined();
  });
});
