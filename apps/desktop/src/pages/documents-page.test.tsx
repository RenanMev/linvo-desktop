import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/documents/download", () => ({ downloadArtifact: vi.fn() }));
vi.mock("@/context/workspace-context", () => ({ useWorkspace: vi.fn() }));

import { useWorkspace } from "@/context/workspace-context";
import * as documentsApi from "@/lib/documents/documents-api";
import { downloadArtifact } from "@/lib/documents/download";
import { DocumentsPage } from "@/pages/documents-page";

const document = {
  id: "doc-1",
  title: "Relatório de julho",
  filename: "relatorio-de-julho.pdf",
  sizeBytes: 204_800,
  pageCount: 3,
  createdByName: "Ana",
  createdAt: "2026-07-31T13:05:00.000Z",
};

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkspace).mockReturnValue({
      activeWorkspace: { id: "ws-1" },
    } as unknown as ReturnType<typeof useWorkspace>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the workspace documents with author, size and page count", async () => {
    vi.spyOn(documentsApi, "listDocuments").mockResolvedValue([document]);

    render(<DocumentsPage />);

    expect(await screen.findByText("Relatório de julho")).toBeInTheDocument();
    expect(screen.getByText(/Ana · 200 KB · 3 páginas/)).toBeInTheDocument();
    expect(documentsApi.listDocuments).toHaveBeenCalledWith("ws-1");
  });

  it("guides the user when the workspace has no documents", async () => {
    vi.spyOn(documentsApi, "listDocuments").mockResolvedValue([]);

    render(<DocumentsPage />);

    expect(await screen.findByText("Nenhum documento ainda")).toBeInTheDocument();
  });

  it("downloads through the native save flow", async () => {
    const user = userEvent.setup();
    vi.spyOn(documentsApi, "listDocuments").mockResolvedValue([document]);
    vi.mocked(downloadArtifact).mockResolvedValue(true);

    render(<DocumentsPage />);
    await user.click(
      await screen.findByRole("button", { name: "Baixar relatorio-de-julho.pdf" }),
    );

    expect(downloadArtifact).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      documentId: "doc-1",
      filename: "relatorio-de-julho.pdf",
    });
  });

  it("deletes only after confirmation and drops the row from the list", async () => {
    const user = userEvent.setup();
    vi.spyOn(documentsApi, "listDocuments").mockResolvedValue([document]);
    const deleteSpy = vi
      .spyOn(documentsApi, "deleteDocument")
      .mockResolvedValue(undefined);
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    render(<DocumentsPage />);
    const deleteButton = await screen.findByRole("button", {
      name: "Excluir Relatório de julho",
    });

    await user.click(deleteButton);
    expect(deleteSpy).not.toHaveBeenCalled();

    await user.click(deleteButton);
    expect(deleteSpy).toHaveBeenCalledWith("ws-1", "doc-1");
    await waitFor(() => {
      expect(screen.queryByText("Relatório de julho")).not.toBeInTheDocument();
    });
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the list fails to load", async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(documentsApi, "listDocuments")
      .mockRejectedValueOnce(new Error("rede fora"))
      .mockResolvedValueOnce([document]);

    render(<DocumentsPage />);

    expect(
      await screen.findByText("Não foi possível carregar os documentos."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Relatório de julho")).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
