import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeMock } from "@/test/mocks/tauri";
import {
  applySyncedTokens,
  clearTokens,
  getTokens,
  normalizeStoredTokens,
  resetTokenStoreForTests,
  setTokens,
} from "@/lib/auth/token-store";
import * as authSync from "@/lib/auth-sync";

describe("token-store", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    resetTokenStoreForTests();
    vi.spyOn(authSync, "emitTokenSync").mockResolvedValue();
  });

  it("normalizeStoredTokens accepts camelCase and snake_case", () => {
    expect(
      normalizeStoredTokens({
        accessToken: "access",
        refreshToken: "refresh",
      }),
    ).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });

    expect(
      normalizeStoredTokens({
        access_token: "access",
        refresh_token: "refresh",
      }),
    ).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("setTokens calls auth_set_tokens with mapped fields", async () => {
    invokeMock.mockResolvedValue(undefined);

    await setTokens({
      accessToken: "access",
      refreshToken: "refresh",
    });

    expect(invokeMock).toHaveBeenCalledWith("auth_set_tokens", {
      access: "access",
      refresh: "refresh",
    });
  });

  it("returns tokens from memory without reading keychain", async () => {
    invokeMock.mockResolvedValue(null);

    await applySyncedTokens({
      accessToken: "memory-access",
      refreshToken: "memory-refresh",
    });

    await expect(getTokens()).resolves.toEqual({
      accessToken: "memory-access",
      refreshToken: "memory-refresh",
    });
    expect(invokeMock).not.toHaveBeenCalledWith("auth_get_tokens");
  });

  it("getTokens returns null when keychain is empty and memory is empty", async () => {
    invokeMock.mockResolvedValue(null);

    await expect(getTokens()).resolves.toBeNull();
  });

  it("getTokens maps stored tokens from keychain", async () => {
    invokeMock.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });

    await expect(getTokens()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("getTokens maps snake_case stored tokens", async () => {
    invokeMock.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
    });

    await expect(getTokens()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("clearTokens clears memory and keychain", async () => {
    invokeMock.mockResolvedValue(undefined);

    await applySyncedTokens({
      accessToken: "access",
      refreshToken: "refresh",
    });
    await clearTokens();

    invokeMock.mockResolvedValue(null);
    await expect(getTokens()).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("auth_clear_tokens");
  });
});
