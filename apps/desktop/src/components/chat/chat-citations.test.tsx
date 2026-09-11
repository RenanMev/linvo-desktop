import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/panel-window", () => ({
  openPanel: vi.fn(() => Promise.resolve()),
}));

import { ChatCitations } from "@/components/chat/chat-citations";
import { openPanel } from "@/lib/panel-window";

const workspaceId = "ws-1";

describe("ChatCitations", () => {
  beforeEach(() => {
    vi.mocked(openPanel).mockClear();
  });

  it("T7.6 renders a chip for each citation label", () => {
    render(
      <ChatCitations
        workspaceId={workspaceId}
        citations={[
          { id: "d1", kind: "document", label: "Política comercial" },
          { id: "p1", kind: "procedure", label: "Cancelar plano" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Política comercial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar plano" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Não encontrei na base"),
    ).not.toBeInTheDocument();
  });

  it("T7.7 renders no chips and no fallback when citations is omitted", () => {
    const { container } = render(<ChatCitations workspaceId={workspaceId} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Não encontrei na base"),
    ).not.toBeInTheDocument();
  });

  it("T7.8 shows Não encontrei na base and zero chips when citations is []", () => {
    render(<ChatCitations workspaceId={workspaceId} citations={[]} />);

    expect(screen.getByText("Não encontrei na base")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("T7.9 opens the workspace settings for document and never /documents", async () => {
    const user = userEvent.setup();
    render(
      <ChatCitations
        workspaceId={workspaceId}
        citations={[{ id: "d1", kind: "document", label: "Política comercial" }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Política comercial" }));

    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(openPanel).toHaveBeenCalledWith(`/settings/workspace/${workspaceId}`);
    expect(vi.mocked(openPanel).mock.calls[0]?.[0]).not.toContain("/documents");
  });

  it("T7.10 opens the procedures list for procedure", async () => {
    const user = userEvent.setup();
    render(
      <ChatCitations
        workspaceId={workspaceId}
        citations={[{ id: "p1", kind: "procedure", label: "Cancelar plano" }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar plano" }));

    expect(openPanel).toHaveBeenCalledWith(
      `/settings/workspace/${workspaceId}/procedures`,
    );
  });

  it("opens the workspace settings for rule", async () => {
    const user = userEvent.setup();
    render(
      <ChatCitations
        workspaceId={workspaceId}
        citations={[{ id: "r1", kind: "rule", label: "Regra de reembolso" }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Regra de reembolso" }));

    expect(openPanel).toHaveBeenCalledWith(`/settings/workspace/${workspaceId}`);
  });

  it("uses href when the citation includes one", async () => {
    const user = userEvent.setup();
    render(
      <ChatCitations
        workspaceId={workspaceId}
        citations={[
          {
            id: "d1",
            kind: "document",
            label: "Política comercial",
            href: "/settings/workspace/ws-1/knowledge/d1",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Política comercial" }));

    expect(openPanel).toHaveBeenCalledWith(
      "/settings/workspace/ws-1/knowledge/d1",
    );
  });
});
