import { afterEach, describe, expect, it, vi } from "vitest";

import { checkApiHealth } from "@/lib/api-health";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

describe("checkApiHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when health endpoint responds with success", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkApiHealth()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/health`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns not ok when health endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );

    await expect(checkApiHealth()).resolves.toEqual({ ok: false });
  });

  it("returns not ok when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));

    await expect(checkApiHealth()).resolves.toEqual({ ok: false });
  });
});
