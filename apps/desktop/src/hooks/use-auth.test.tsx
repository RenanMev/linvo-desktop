import type { UserPublic } from "@linvo/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reviewHandler: null as (() => void) | null,
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  clearStoredAppearance: vi.fn(),
  clearChatLocalCache: vi.fn(),
  clearStoredWorkspaceId: vi.fn(),
  clearOnboardingCompleted: vi.fn(),
  hasCompletedOnboarding: vi.fn(),
  isOnboardingForced: vi.fn(),
  markOnboardingCompleted: vi.fn(),
  clearOnboardingProgress: vi.fn(),
  listenOnboardingReview: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  refreshStoredTokens: vi.fn(),
  clearTokens: vi.fn(),
  getTokens: vi.fn(),
  setTokens: vi.fn(),
  applySyncedTokens: vi.fn(),
  applyWindowSurface: vi.fn(),
  applyOnboardingWindowSurface: vi.fn(),
  emitAuthSync: vi.fn(),
  listenAuthSync: vi.fn(),
  listenTokenSync: vi.fn(),
  notifyDesktopEvent: vi.fn(),
  closePanel: vi.fn(),
  enterLoggedInDesktop: vi.fn(),
}));

vi.mock("@/lib/auth/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/auth-api")>(
    "@/lib/auth/auth-api",
  );
  return {
    ...actual,
    login: mocks.login,
    logout: mocks.logout,
    me: mocks.me,
    register: mocks.register,
  };
});

vi.mock("@/lib/appearance/appearance-store", () => ({
  clearStoredAppearance: mocks.clearStoredAppearance,
}));

vi.mock("@/lib/chat/chat-local-store", () => ({
  clearChatLocalCache: mocks.clearChatLocalCache,
}));

vi.mock("@/lib/workspace/workspace-store", () => ({
  clearStoredWorkspaceId: mocks.clearStoredWorkspaceId,
}));

vi.mock("@/lib/onboarding/onboarding-store", () => ({
  clearOnboardingCompleted: mocks.clearOnboardingCompleted,
  hasCompletedOnboarding: mocks.hasCompletedOnboarding,
  isOnboardingForced: mocks.isOnboardingForced,
  markOnboardingCompleted: mocks.markOnboardingCompleted,
}));

vi.mock("@/lib/onboarding/onboarding-progress-store", () => ({
  clearOnboardingProgress: mocks.clearOnboardingProgress,
}));

vi.mock("@/lib/onboarding-review-sync", () => ({
  listenOnboardingReview: mocks.listenOnboardingReview,
}));

vi.mock("@/lib/auth/http", () => ({
  setUnauthorizedHandler: mocks.setUnauthorizedHandler,
  refreshStoredTokens: mocks.refreshStoredTokens,
}));

vi.mock("@/lib/auth/token-store", () => ({
  clearTokens: mocks.clearTokens,
  getTokens: mocks.getTokens,
  setTokens: mocks.setTokens,
  applySyncedTokens: mocks.applySyncedTokens,
}));

vi.mock("@/lib/auth/apply-window-surface", () => ({
  applyWindowSurface: mocks.applyWindowSurface,
}));

vi.mock("@/lib/auth/onboarding-window-surface", () => ({
  applyOnboardingWindowSurface: mocks.applyOnboardingWindowSurface,
}));

vi.mock("@/lib/auth-sync", () => ({
  emitAuthSync: mocks.emitAuthSync,
  listenAuthSync: mocks.listenAuthSync,
  listenTokenSync: mocks.listenTokenSync,
}));

vi.mock("@/lib/desktop-notifications", () => ({
  notifyDesktopEvent: mocks.notifyDesktopEvent,
}));

vi.mock("@/lib/panel-window", () => ({
  closePanel: mocks.closePanel,
}));

vi.mock("@/lib/auth/enter-logged-in-desktop", () => ({
  enterLoggedInDesktop: mocks.enterLoggedInDesktop,
}));

import { useAuth } from "@/hooks/use-auth";

const user = {
  id: "user-1",
  name: "Renan",
  email: "renan@example.com",
} as UserPublic;

describe("useAuth onboarding integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviewHandler = null;
    mocks.getTokens.mockResolvedValue(null);
    mocks.me.mockResolvedValue(user);
    mocks.hasCompletedOnboarding.mockReturnValue(true);
    mocks.isOnboardingForced.mockReturnValue(false);
    mocks.listenOnboardingReview.mockImplementation(
      async (handler: () => void) => {
        mocks.reviewHandler = handler;
        return vi.fn();
      },
    );
    mocks.listenAuthSync.mockResolvedValue(vi.fn());
    mocks.listenTokenSync.mockResolvedValue(vi.fn());
    mocks.applyWindowSurface.mockResolvedValue(undefined);
    mocks.applyOnboardingWindowSurface.mockResolvedValue(undefined);
    mocks.enterLoggedInDesktop.mockResolvedValue(undefined);
    mocks.closePanel.mockResolvedValue(undefined);
  });

  it("forces onboarding during authenticated boot", async () => {
    mocks.getTokens.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    mocks.isOnboardingForced.mockReturnValue(true);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.phase).toBe("onboarding"));
    expect(mocks.enterLoggedInDesktop).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.applyOnboardingWindowSurface).toHaveBeenCalled(),
    );
  });

  it("reopens onboarding from a cross-window review request", async () => {
    mocks.getTokens.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.phase).toBe("floating"));
    await waitFor(() => expect(mocks.reviewHandler).not.toBeNull());

    act(() => mocks.reviewHandler?.());

    expect(mocks.clearOnboardingCompleted).toHaveBeenCalledWith("user-1");
    await waitFor(() => expect(result.current.phase).toBe("onboarding"));
    await waitFor(() =>
      expect(mocks.applyOnboardingWindowSurface).toHaveBeenCalled(),
    );
  });

  it("ignores a review request when no user is authenticated", async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.phase).toBe("unauthenticated"));
    act(() => mocks.reviewHandler?.());

    expect(result.current.phase).toBe("unauthenticated");
    expect(mocks.clearOnboardingCompleted).not.toHaveBeenCalled();
  });

  it("clears saved progress when onboarding completes", async () => {
    mocks.getTokens.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    mocks.isOnboardingForced.mockReturnValue(true);
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.phase).toBe("onboarding"));
    await act(async () => result.current.completeOnboarding("/chat"));

    expect(mocks.markOnboardingCompleted).toHaveBeenCalledWith("user-1");
    expect(mocks.clearOnboardingProgress).toHaveBeenCalledWith("user-1");
    expect(mocks.enterLoggedInDesktop).toHaveBeenCalledWith(user, "/chat");
  });
});
