import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/documents/download", () => ({ downloadArtifact: vi.fn() }));
vi.mock("@/context/workspace-context", () => ({ useWorkspace: vi.fn() }));

import { ChatArtifactCard } from "@/components/chat/chat-artifact-card";
import { useWorkspace } from "@/context/workspace-context";
import { downloadArtifact } from "@/lib/documents/download";

const artifact = {
  id: "doc-1",
  kind: "pdf" as const,
  title: "Relatório de julho",
  filename: "relatorio-de-julho.pdf",
  sizeBytes: 204_800,
  pageCount: 3,
};

describe("ChatArtifactCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspace).mockReturnValue({
      activeWorkspace: { id: "ws-1" },
    } as unknown as ReturnType<typeof useWorkspace>);
  });

  it("shows title, size and page count", () => {
    render(<ChatArtifactCard artifact={artifact} />);

    expect(screen.getByText("Relatório de julho")).toBeInTheDocument();
    expect(screen.getByText("200 KB · 3 páginas")).toBeInTheDocument();
  });

  it("downloads the document of the active workspace", async () => {
    const user = userEvent.setup();
    vi.mocked(downloadArtifact).mockResolvedValue(true);

    render(<ChatArtifactCard artifact={artifact} />);
    await user.click(
      screen.getByRole("button", { name: "Baixar relatorio-de-julho.pdf" }),
    );

    expect(downloadArtifact).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      documentId: "doc-1",
      filename: "relatorio-de-julho.pdf",
    });
  });

  it("offers a retry after a failed download", async () => {
    const user = userEvent.setup();
    vi.mocked(downloadArtifact).mockRejectedValue(new Error("rede fora"));

    render(<ChatArtifactCard artifact={artifact} />);
    await user.click(
      screen.getByRole("button", { name: "Baixar relatorio-de-julho.pdf" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível baixar. Tente de novo."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Baixar relatorio-de-julho.pdf" }),
    ).toHaveTextContent("Tentar de novo");
  });

  it("omits the page count when the API did not report one", () => {
    render(<ChatArtifactCard artifact={{ ...artifact, pageCount: undefined }} />);

    expect(screen.getByText("200 KB")).toBeInTheDocument();
  });
});
