import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/panel/account-menu";
import type { PanelSession } from "@/hooks/use-panel-session";

const session: PanelSession = {
  user: {
    id: "user-1",
    name: "Renan Silva",
    email: "renan@example.com",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  logout: vi.fn(),
};

describe("AccountMenu", () => {
  it("opens settings from the user icon", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
          <Route path="/chat" element={<AccountMenu session={session} />} />
          <Route
            path="/settings/general"
            element={<div>Página de configurações</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Abrir menu do usuário" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Configurações" }),
    );

    expect(screen.getByText("Página de configurações")).toBeInTheDocument();
  });
});
