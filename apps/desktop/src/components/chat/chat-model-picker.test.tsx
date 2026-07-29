import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatModelPicker } from "@/components/chat/chat-model-picker";

describe("ChatModelPicker", () => {
  it("renders selected model label", () => {
    render(
      <ChatModelPicker
        models={[
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
          { id: "gpt-4o", label: "GPT-4o" },
        ]}
        value="gpt-4o-mini"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("GPT-4o mini")).toBeInTheDocument();
  });

  it("calls onChange when selecting another model", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChatModelPicker
        models={[
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
          { id: "gpt-4o", label: "GPT-4o" },
        ]}
        value="gpt-4o-mini"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByTitle("Selecionar modelo"));
    await user.click(await screen.findByText("GPT-4o"));
    expect(onChange).toHaveBeenCalledWith("gpt-4o");
  });
});
