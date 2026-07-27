import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatToolsMenu } from "@/components/chat/chat-tools-menu";

describe("ChatToolsMenu", () => {
  it("lista atalhos web e knowledge", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChatToolsMenu value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Tools/i }));
    expect(screen.getByText("Busca na internet")).toBeInTheDocument();
    expect(screen.getByText("Base de conhecimento")).toBeInTheDocument();

    await user.click(screen.getByText("Busca na internet"));
    expect(onChange).toHaveBeenCalledWith("web_search");
  });
});
