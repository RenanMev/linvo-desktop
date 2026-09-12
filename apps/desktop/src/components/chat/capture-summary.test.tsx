import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CaptureSummary } from "@/components/chat/capture-summary";

describe("CaptureSummary", () => {
  it("T8.1 renders 3 collapsible bullets", async () => {
    const user = userEvent.setup();
    render(
      <CaptureSummary
        bullets={[
          "pedido de cancelamento",
          "protocolo 123",
          "sem multa no período",
        ]}
      />,
    );

    expect(screen.getByText("pedido de cancelamento")).toBeInTheDocument();
    expect(screen.getByText("protocolo 123")).toBeInTheDocument();
    expect(screen.getByText("sem multa no período")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Resumo do print" }));

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("T8.2 renders nothing when the field is absent", () => {
    const { container } = render(<CaptureSummary />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText("Resumo do print")).not.toBeInTheDocument();
  });
});
