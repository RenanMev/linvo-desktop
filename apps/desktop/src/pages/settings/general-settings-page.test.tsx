import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding-review-sync", () => ({
  requestOnboardingReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/panel-window", () => ({
  closePanel: vi.fn().mockResolvedValue(undefined),
}));

import { requestOnboardingReview } from "@/lib/onboarding-review-sync";
import { closePanel } from "@/lib/panel-window";
import { GeneralSettingsPage } from "@/pages/settings/general-settings-page";

describe("GeneralSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests an onboarding review and closes the panel", async () => {
    const pointer = userEvent.setup();
    render(<GeneralSettingsPage />);

    await pointer.click(
      screen.getByRole("button", { name: "Rever onboarding" }),
    );

    await waitFor(() =>
      expect(requestOnboardingReview).toHaveBeenCalledTimes(1),
    );
    expect(closePanel).toHaveBeenCalledTimes(1);
  });
});
