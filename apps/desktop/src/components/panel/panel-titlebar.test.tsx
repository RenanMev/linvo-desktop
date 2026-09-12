import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PanelTitlebar } from "@/components/panel/panel-titlebar";
import type { PanelSession } from "@/hooks/use-panel-session";
import { invokeMock, panelWindowMock, windowMock } from "@/test/mocks/tauri";

const session: PanelSession = {
  user: {
    id: "user-1",
    name: "Renan Silva",
    email: "renan@example.com",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  logout: vi.fn(),
};

function renderTitlebar(overrides: Partial<React.ComponentProps<typeof PanelTitlebar>> = {}) {
  const onToggleSidebar = vi.fn();
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <PanelTitlebar
        session={session}
        maximized={false}
        onToggleMaximize={vi.fn()}
        sidebarCollapsed={false}
        onToggleSidebar={onToggleSidebar}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onToggleSidebar };
}

describe("PanelTitlebar", () => {
  beforeEach(() => {
    invokeMock.mockClear();
    vi.mocked(windowMock.minimize).mockClear();
    vi.mocked(panelWindowMock.minimize).mockClear();
  });

  it("puts the sidebar toggle on the left, before the drag region", () => {
    renderTitlebar();

    const header = screen.getByRole("banner");
    const toggle = screen.getByRole("button", { name: "Recolher sidebar" });

    expect(header.firstElementChild).toBe(toggle);
  });

  it("keeps profile and window controls on the right, in order", () => {
    renderTitlebar();

    const header = screen.getByRole("banner");
    const rightGroup = header.lastElementChild as HTMLElement;

    const labels = within(rightGroup)
      .getAllByRole("button")
      .map((button) => button.getAttribute("title") ?? button.getAttribute("aria-label"));

    expect(labels).toEqual(["Conta", "Minimizar", "Maximizar", "Fechar"]);
  });

  it("toggles the sidebar and flips its label when collapsed", async () => {
    const user = userEvent.setup();
    const { onToggleSidebar } = renderTitlebar();

    await user.click(screen.getByRole("button", { name: "Recolher sidebar" }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    renderTitlebar({ sidebarCollapsed: true });
    expect(
      screen.getAllByRole("button", { name: "Expandir sidebar" }).length,
    ).toBeGreaterThan(0);
  });

  it("minimizes the panel window, not the floating bar", async () => {
    const user = userEvent.setup();
    renderTitlebar();

    await user.click(screen.getByTitle("Minimizar"));

    expect(panelWindowMock.minimize).toHaveBeenCalledTimes(1);
    expect(windowMock.minimize).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith("panel_close");
    expect(invokeMock).not.toHaveBeenCalledWith("show_window_no_activate");
  });
});
