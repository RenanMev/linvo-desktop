import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatReasoningPanel } from "@/components/chat/chat-reasoning-panel";

describe("ChatReasoningPanel", () => {
  it("renders unified timeline and reasoning markdown", () => {
    render(
      <ChatReasoningPanel
        isStreaming={false}
        activities={[
          {
            id: "a1",
            label: "Base de conhecimento",
            status: "done",
            kind: "research",
            detail: "cancelamento",
          },
        ]}
        toolUses={[{ name: "search_knowledge", label: "Base de conhecimento" }]}
        reasoning={"**Passo atual:** validar pedido"}
      />,
    );

    expect(screen.getByText("Base de conhecimento")).toBeInTheDocument();
    expect(screen.getByText("cancelamento")).toBeInTheDocument();
    expect(screen.getByText("Passo atual:")).toBeInTheDocument();
  });

  it("shows Analisando… while streaming without content", () => {
    render(<ChatReasoningPanel isStreaming activities={[]} />);
    expect(screen.getByText("Analisando…")).toBeInTheDocument();
    expect(screen.getAllByText("Analisando…")).toHaveLength(1);
  });
});
