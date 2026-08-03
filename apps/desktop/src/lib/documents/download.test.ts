import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import * as api from "@/lib/documents/documents-api";
import { downloadArtifact } from "@/lib/documents/download";

const input = {
  workspaceId: "ws-1",
  documentId: "doc-1",
  filename: "relatorio.pdf",
};

describe("downloadArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suggests the filename, fetches the bytes and writes to the chosen path", async () => {
    vi.mocked(save).mockResolvedValue("C:\\Users\\ana\\relatorio.pdf");
    const fetchSpy = vi
      .spyOn(api, "fetchDocumentBytes")
      .mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    await expect(downloadArtifact(input)).resolves.toBe(true);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "relatorio.pdf" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith("ws-1", "doc-1");
    expect(invoke).toHaveBeenCalledWith("documents_save_file", {
      path: "C:\\Users\\ana\\relatorio.pdf",
      contents: [37, 80, 68, 70],
    });
  });

  it("does nothing when the user cancels the dialog", async () => {
    vi.mocked(save).mockResolvedValue(null);
    const fetchSpy = vi.spyOn(api, "fetchDocumentBytes");

    await expect(downloadArtifact(input)).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("propagates a download failure without writing anything", async () => {
    vi.mocked(save).mockResolvedValue("C:\\Users\\ana\\relatorio.pdf");
    vi.spyOn(api, "fetchDocumentBytes").mockRejectedValue(
      new api.DocumentApiError("documento não encontrado", 404),
    );

    await expect(downloadArtifact(input)).rejects.toMatchObject({ status: 404 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("propagates a write failure from the native side", async () => {
    vi.mocked(save).mockResolvedValue("C:\\Users\\ana\\relatorio.pdf");
    vi.spyOn(api, "fetchDocumentBytes").mockResolvedValue(new Uint8Array([1]));
    vi.mocked(invoke).mockRejectedValue(new Error("pasta não encontrada"));

    await expect(downloadArtifact(input)).rejects.toThrow("pasta não encontrada");
  });
});
