import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError } from "@/lib/auth/auth-api";
import { authorizedFetch, refreshStoredTokens, setUnauthorizedHandler } from "@/lib/auth/http";
import * as authSync from "@/lib/auth-sync";
import * as tokenStore from "@/lib/auth/token-store";
import * as authApi from "@/lib/auth/auth-api";

describe("authorizedFetch", () => {
  const fetchMock = vi.fn();
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onUnauthorized.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(onUnauthorized);
    vi.spyOn(tokenStore, "getTokens").mockReset();
    vi.spyOn(tokenStore, "setTokens").mockReset();
    vi.spyOn(tokenStore, "clearTokens").mockReset();
    vi.spyOn(authApi, "refresh").mockReset();
    vi.spyOn(authSync, "emitAuthSync").mockResolvedValue();
  });

  it("retries once after refreshing on 401", async () => {
    vi.spyOn(tokenStore, "getTokens").mockImplementation(async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    }));
    vi.spyOn(authApi, "refresh").mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    vi.spyOn(tokenStore, "setTokens").mockResolvedValue();

    fetchMock
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 });

    const response = await authorizedFetch("http://localhost/api/test");

    expect(authApi.refresh).toHaveBeenCalledWith("new-refresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it("clears tokens and notifies when refresh fails", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "old-access",
      refreshToken: "old-refresh",
    });
    vi.spyOn(authApi, "refresh").mockRejectedValue(
      new AuthApiError("sessão inválida", 401),
    );
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    fetchMock.mockResolvedValueOnce({ status: 401 });

    await expect(
      authorizedFetch("http://localhost/api/test"),
    ).rejects.toBeInstanceOf(AuthApiError);

    expect(tokenStore.clearTokens).toHaveBeenCalled();
    expect(authSync.emitAuthSync).toHaveBeenCalledWith("unauthorized");
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("does not clear tokens on network errors", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(
      authorizedFetch("http://localhost/api/test"),
    ).rejects.toThrow();

    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent refresh attempts", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "old-access",
      refreshToken: "old-refresh",
    });
    vi.spyOn(authApi, "refresh").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      };
    });
    vi.spyOn(tokenStore, "setTokens").mockResolvedValue();

    const [first, second] = await Promise.all([
      refreshStoredTokens(),
      refreshStoredTokens(),
    ]);

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(first).toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    expect(second).toEqual(first);
  });

  it("returns successful responses without refresh", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });

    fetchMock.mockResolvedValueOnce({ status: 200 });

    const response = await authorizedFetch("http://localhost/api/test");
    expect(response.status).toBe(200);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it("handles missing tokens as unauthorized", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue(null);
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    await expect(
      authorizedFetch("http://localhost/api/test"),
    ).rejects.toBeInstanceOf(AuthApiError);

    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("does not logout when onUnauthorized is throw on missing tokens", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue(null);
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    await expect(
      authorizedFetch("http://localhost/api/test", undefined, {
        onUnauthorized: "throw",
      }),
    ).rejects.toBeInstanceOf(AuthApiError);

    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
    expect(authSync.emitAuthSync).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not logout when onUnauthorized is throw after refresh fails", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "old-access",
      refreshToken: "old-refresh",
    });
    vi.spyOn(authApi, "refresh").mockRejectedValue(
      new AuthApiError("sessão inválida", 401),
    );
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    fetchMock.mockResolvedValueOnce({ status: 401 });

    await expect(
      authorizedFetch("http://localhost/api/test", undefined, {
        onUnauthorized: "throw",
      }),
    ).rejects.toBeInstanceOf(AuthApiError);

    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
    expect(authSync.emitAuthSync).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not logout when onUnauthorized is throw on retry 401", async () => {
    vi.spyOn(tokenStore, "getTokens").mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.spyOn(authApi, "refresh").mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    vi.spyOn(tokenStore, "setTokens").mockResolvedValue();
    vi.spyOn(tokenStore, "clearTokens").mockResolvedValue();

    fetchMock
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 401 });

    await expect(
      authorizedFetch("http://localhost/api/test", undefined, {
        onUnauthorized: "throw",
      }),
    ).rejects.toBeInstanceOf(AuthApiError);

    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
    expect(authSync.emitAuthSync).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("recovers from another window refresh when local refresh fails", async () => {
    vi.spyOn(tokenStore, "getTokens")
      .mockResolvedValueOnce({
        accessToken: "old-access",
        refreshToken: "old-refresh",
      })
      .mockResolvedValueOnce({
        accessToken: "synced-access",
        refreshToken: "synced-refresh",
      });
    vi.spyOn(authApi, "refresh").mockRejectedValue(
      new AuthApiError("sessão inválida", 401),
    );
    vi.spyOn(tokenStore, "setTokens").mockResolvedValue();

    fetchMock
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 });

    const response = await authorizedFetch("http://localhost/api/test", undefined, {
      onUnauthorized: "throw",
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStore.clearTokens).not.toHaveBeenCalled();
  });
});
