import { beforeEach, describe, expect, it, vi } from "vitest";

import { enterLoggedInDesktop } from "@/lib/auth/enter-logged-in-desktop";

const mocks = vi.hoisted(() => ({
  getTokens: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("@/lib/auth/token-store", () => ({
  getTokens: mocks.getTokens,
}));

vi.mock("@/lib/panel-window", () => ({
  openPanel: mocks.openPanel,
}));

const user = {
  id: "user-1",
  name: "Renan",
  email: "renan@test.com",
  createdAt: "2026-01-01",
};

describe("enterLoggedInDesktop", () => {
  beforeEach(() => {
    mocks.getTokens.mockReset();
    mocks.openPanel.mockReset();
    mocks.getTokens.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    mocks.openPanel.mockResolvedValue(undefined);
  });

  it("sem rota, abre o painel na home do workspace — nunca em /chat", async () => {
    await enterLoggedInDesktop(user);

    expect(mocks.openPanel).toHaveBeenCalledWith("/settings/workspace", user, {
      accessToken: "a",
      refreshToken: "r",
    });
    expect(mocks.openPanel).not.toHaveBeenCalledWith(
      "/chat",
      expect.anything(),
      expect.anything(),
    );
  });

  it("rota explícita continua respeitada", async () => {
    await enterLoggedInDesktop(user, "/chat/conv-1");

    expect(mocks.openPanel).toHaveBeenCalledWith("/chat/conv-1", user, {
      accessToken: "a",
      refreshToken: "r",
    });
  });
});
