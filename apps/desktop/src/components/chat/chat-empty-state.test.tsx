import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";

describe("ChatEmptyState", () => {
  it("renders minimal empty state", () => {
    render(<ChatEmptyState onSuggestion={() => {}} />);

    expect(screen.getByText("Como posso ajudar?")).toBeInTheDocument();
    expect(
      screen.getByText("Envie uma mensagem para iniciar a conversa."),
    ).toBeInTheDocument();
  });
});
