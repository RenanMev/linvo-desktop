import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-windows", () => ({
  hideAllWindows: vi.fn().mockResolvedValue(undefined),
}));

import { OnboardingTitlebar } from "@/components/onboarding/onboarding-titlebar";
import { hideAllWindows } from "@/lib/app-windows";

const user = {
  id: "user-1",
  name: "Renan Silva",
  email: "renan@example.com",
  role: "USER" as const,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

describe("OnboardingTitlebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the user initials", () => {
    render(<OnboardingTitlebar user={user} />);

    expect(screen.getByText("RS")).toBeInTheDocument();
  });

  it("handles minimize and close actions", async () => {
    const pointer = userEvent.setup();
    render(<OnboardingTitlebar user={user} />);

    await pointer.click(screen.getByTitle("Minimizar"));
    await pointer.click(screen.getByTitle("Fechar"));

    expect(hideAllWindows).toHaveBeenCalledTimes(2);
  });
});
