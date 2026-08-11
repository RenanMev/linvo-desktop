import { beforeEach, describe, expect, it, vi } from "vitest";

import * as http from "@/lib/auth/http";
import {
  fetchChatAttachmentBlob,
  uploadChatAttachment,
} from "@/lib/chat/chat-attachments-api";
import type { ChatApiError } from "@/lib/chat/chat-api";

const attachment = {
  id: "att_1",
  kind: "image" as const,
  mimeType: "image/png" as const,
  filename: "context.png",
  sizeBytes: 5,
  width: 800,
  height: 600,
};

describe("chat attachments API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads the image as multipart with capture metadata", async () => {
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      Response.json({ attachment }, { status: 201 }),
    );
    const file = new File(["image"], "context.png", { type: "image/png" });

    await expect(
      uploadChatAttachment("conv-1", file, {
        filename: file.name,
        source: "display_capture",
      }),
    ).resolves.toEqual(attachment);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/conversations\/conv-1\/attachments$/),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
      { onUnauthorized: "throw" },
    );
    const init = fetchSpy.mock.calls[0]?.[1];
    const form = init?.body as FormData;
    expect(form.get("file")).toBeInstanceOf(File);
    expect(form.get("kind")).toBe("image");
    expect(form.get("source")).toBe("display_capture");
    expect(init?.headers).toBeUndefined();
  });

  it("preserves the API status and first error message", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      Response.json(
        { message: ["imagem excede o limite", "detalhe"] },
        { status: 413 },
      ),
    );

    await expect(
      uploadChatAttachment(
        "conv-1",
        new Blob(["large"], { type: "image/png" }),
      ),
    ).rejects.toMatchObject({
      name: "ChatApiError",
      status: 413,
      message: "imagem excede o limite",
    } satisfies Partial<ChatApiError>);
  });

  it("rejects an invalid successful payload", async () => {
    vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      Response.json({ attachment: { id: "incomplete" } }),
    );

    await expect(
      uploadChatAttachment(
        "conv-1",
        new Blob(["image"], { type: "image/png" }),
      ),
    ).rejects.toThrow();
  });

  it("downloads an authenticated attachment blob", async () => {
    const expected = new Blob(["image"], { type: "image/png" });
    const fetchSpy = vi.spyOn(http, "authorizedFetch").mockResolvedValue(
      new Response(expected, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const result = await fetchChatAttachmentBlob("conv-1", "att_1");

    expect(result.type).toBe("image/png");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/conversations\/conv-1\/attachments\/att_1$/,
      ),
      { method: "GET" },
      { onUnauthorized: "throw" },
    );
  });
});
