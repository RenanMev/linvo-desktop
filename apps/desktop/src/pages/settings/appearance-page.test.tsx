import { APPEARANCE_DEFAULTS } from "@linvo/shared";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useAppearance } from "@/context/appearance-context";
import { AppearancePage } from "@/pages/settings/appearance-page";

vi.mock("@/context/appearance-context", () => ({
  useAppearance: vi.fn(),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("AppearancePage", () => {
  it("renders the system, light and dark theme control", () => {
    vi.mocked(useAppearance).mockReturnValue({
      preferences: {
        ...APPEARANCE_DEFAULTS,
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      setPreference: vi.fn(),
      resetToDefaults: vi.fn(),
      isSyncing: false,
    });

    render(<AppearancePage />);

    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Claro" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Escuro" })).toBeInTheDocument();
  });
});
