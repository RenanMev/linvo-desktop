import { describe, expect, it } from "vitest";

import {
  deriveIslandStatus,
  islandStatusLabel,
  islandStatusLive,
} from "@/lib/island-status";

const ready = {
  floatingReady: true,
  apiHealthy: true,
  sessionWarning: null as string | null,
};

describe("deriveIslandStatus", () => {
  it("never reports live green before bootstrap is ready", () => {
    expect(
      deriveIslandStatus({
        floatingReady: false,
        apiHealthy: true,
        sessionWarning: null,
      }),
    ).toBe("offline");
  });

  it("prefers session expiry over API and thinking", () => {
    expect(
      deriveIslandStatus({
        ...ready,
        apiHealthy: false,
        sessionWarning: "expired",
        isThinking: true,
      }),
    ).toBe("session-expired");
  });

  it("reports API down instead of a live green pill", () => {
    expect(deriveIslandStatus({ ...ready, apiHealthy: false })).toBe("api-down");
  });

  it("reports thinking and listening ahead of online", () => {
    expect(deriveIslandStatus({ ...ready, isThinking: true })).toBe("thinking");
    expect(deriveIslandStatus({ ...ready, isListening: true })).toBe(
      "listening",
    );
  });

  it("reports online only when the island is actually healthy", () => {
    expect(deriveIslandStatus(ready)).toBe("online");
  });
});

describe("islandStatusLabel", () => {
  it("uses operational Portuguese labels", () => {
    expect(islandStatusLabel("online")).toBe("Online");
    expect(islandStatusLabel("api-down")).toBe("API indisponível");
    expect(islandStatusLabel("session-expired")).toBe("Sessão expirada");
    expect(islandStatusLabel("thinking")).toBe("Pensando");
    expect(islandStatusLabel("listening")).toBe("Ouvindo");
    expect(islandStatusLabel("offline")).toBe("Sistema inativo");
  });
});

describe("islandStatusLive", () => {
  it("keeps the live dot only for healthy in-progress states", () => {
    expect(islandStatusLive("online")).toBe(true);
    expect(islandStatusLive("thinking")).toBe(true);
    expect(islandStatusLive("listening")).toBe(true);
    expect(islandStatusLive("api-down")).toBe(false);
    expect(islandStatusLive("session-expired")).toBe(false);
    expect(islandStatusLive("offline")).toBe(false);
  });
});
