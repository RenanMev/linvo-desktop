import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ChatToolbar } from "@/components/chat/chat-toolbar";

describe("ChatToolbar", () => {
  it("renders conversation title", () => {
    render(
      <MemoryRouter>
        <ChatToolbar title="Conversa de teste" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Conversa de teste")).toBeInTheDocument();
  });

  it("navigates to settings when Configurações is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
          <Route path="/chat" element={<ChatToolbar title="Nova conversa" />} />
          <Route
            path="/settings/general"
            element={<div>Página de configurações</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /configurações/i }));

    expect(screen.getByText("Página de configurações")).toBeInTheDocument();
  });
});
