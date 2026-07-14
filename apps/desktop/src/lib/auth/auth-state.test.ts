import { describe, expect, it } from "vitest";

import {
  authReducer,
  initialAuthState,
  isAuthWindowPhase,
} from "@/lib/auth/auth-state";

const sampleUser = {
  id: "u1",
  name: "Renan",
  email: "renan@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("authReducer", () => {
  it("starts in checking state", () => {
    expect(initialAuthState.phase).toBe("checking");
  });

  it("moves to unauthenticated when boot has no token", () => {
    const next = authReducer(initialAuthState, { type: "BOOT_NO_TOKEN" });
    expect(next.phase).toBe("unauthenticated");
  });

  it("moves to floating when boot succeeds", () => {
    const next = authReducer(initialAuthState, {
      type: "BOOT_SUCCESS",
      user: sampleUser,
    });
    expect(next.phase).toBe("floating");
    expect(next.user?.name).toBe("Renan");
  });

  it("keeps refresh token on boot network error", () => {
    const next = authReducer(initialAuthState, { type: "BOOT_NETWORK_ERROR" });
    expect(next.phase).toBe("unauthenticated");
    expect(next.sessionWarning).toBe("Não foi possível validar sua sessão");
  });

  it("moves to floating after login success", () => {
    const next = authReducer(initialAuthState, {
      type: "LOGIN_SUCCESS",
      user: sampleUser,
    });
    expect(next.phase).toBe("floating");
  });

  it("keeps floating after START_FLOATING", () => {
    const loggedIn = authReducer(initialAuthState, {
      type: "LOGIN_SUCCESS",
      user: sampleUser,
    });
    const next = authReducer(loggedIn, { type: "START_FLOATING" });
    expect(next.phase).toBe("floating");
  });

  it("returns to unauthenticated on logout", () => {
    const loggedIn = authReducer(initialAuthState, {
      type: "LOGIN_SUCCESS",
      user: sampleUser,
    });
    const next = authReducer(loggedIn, { type: "LOGOUT" });
    expect(next.phase).toBe("unauthenticated");
    expect(next.user).toBeNull();
  });

  it("returns to unauthenticated on unauthorized", () => {
    const floating = authReducer(initialAuthState, { type: "START_FLOATING" });
    const next = authReducer(floating, { type: "UNAUTHORIZED" });
    expect(next.phase).toBe("unauthenticated");
  });
});

describe("isAuthWindowPhase", () => {
  it("returns true for auth phases", () => {
    expect(isAuthWindowPhase("checking")).toBe(true);
    expect(isAuthWindowPhase("unauthenticated")).toBe(true);
  });

  it("returns false for floating", () => {
    expect(isAuthWindowPhase("floating")).toBe(false);
  });
});
