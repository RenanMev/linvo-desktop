import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatToolUses } from "@/components/chat/chat-tool-uses";

describe("ChatToolUses", () => {
  it("renderiza badge com label da tool", () => {
    render(
      <ChatToolUses
        toolUses={[{ name: "search_knowledge", label: "Base de conhecimento" }]}
      />,
    );

    expect(screen.getByText("Base de conhecimento")).toBeInTheDocument();
  });

  it("renderiza fallback label para tool desconhecida", () => {
    render(
      <ChatToolUses toolUses={[{ name: "custom_tool", label: "Ferramenta: custom_tool" }]} />,
    );

    expect(screen.getByText("Ferramenta: custom_tool")).toBeInTheDocument();
  });

  it("não renderiza quando lista vazia", () => {
    const { container } = render(<ChatToolUses toolUses={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
