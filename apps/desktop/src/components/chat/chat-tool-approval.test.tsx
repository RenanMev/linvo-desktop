import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatToolApproval } from "@/components/chat/chat-tool-approval";

describe("ChatToolApproval", () => {
  it("chama onApprove e onDeny", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();

    render(
      <ChatToolApproval
        request={{
          requestId: "r1",
          name: "read_clipboard",
          label: "Área de transferência",
          args: {},
          requiresApproval: true,
        }}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    await user.click(screen.getByRole("button", { name: "Recusar" }));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });
});
