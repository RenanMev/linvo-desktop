import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthApiError,
  AuthNetworkError,
  login,
  register,
  refresh,
} from "@/lib/auth/auth-api";

const fetchMock = vi.fn();

describe("auth-api", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers and parses auth result", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        accessToken: "access",
        refreshToken: "refresh",
        user: {
          id: "u1",
          name: "Renan",
          email: "renan@example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    });

    const result = await register({
      name: "Renan",
      email: "renan@example.com",
      password: "Abcdef1!",
    });

    expect(result.user.email).toBe("renan@example.com");
  });

  it("maps 409 register errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "email já cadastrado" }),
    });

    await expect(
      register({
        name: "Renan",
        email: "renan@example.com",
        password: "Abcdef1!",
      }),
    ).rejects.toEqual(new AuthApiError("email já cadastrado", 409));
  });

  it("maps 401 login errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "email ou senha inválidos" }),
    });

    await expect(
      login({
        email: "renan@example.com",
        password: "wrong",
      }),
    ).rejects.toEqual(new AuthApiError("email ou senha inválidos", 401));
  });

  it("maps 400 validation errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "email inválido" }),
    });

    await expect(
      login({
        email: "bad",
        password: "x",
      }),
    ).rejects.toEqual(new AuthApiError("email inválido", 400));
  });

  it("refreshes tokens", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      }),
    });

    const result = await refresh("old-refresh");
    expect(result.accessToken).toBe("new-access");
  });

  it("throws network errors", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(
      login({
        email: "renan@example.com",
        password: "Abcdef1!",
      }),
    ).rejects.toBeInstanceOf(AuthNetworkError);
  });
});
