import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatAttachmentImage } from "@/components/chat/chat-attachment-image";

const fetchBlob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chat/chat-attachments-api", () => ({
  fetchChatAttachmentBlob: fetchBlob,
}));

const attachment = {
  id: "att-1",
  kind: "image" as const,
  mimeType: "image/png" as const,
  filename: "context.png",
  sizeBytes: 5,
};

describe("ChatAttachmentImage", () => {
  const createObjectURL = vi.fn(() => "blob:downloaded");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("renders an existing attachment URL without downloading", () => {
    render(
      <ChatAttachmentImage
        attachment={{ ...attachment, url: "blob:optimistic" }}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByAltText("context.png")).toHaveAttribute(
      "src",
      "blob:optimistic",
    );
    expect(fetchBlob).not.toHaveBeenCalled();
  });

  it("downloads a historical attachment and revokes its URL", async () => {
    fetchBlob.mockResolvedValue(
      new Blob(["image"], { type: "image/png" }),
    );
    const rendered = render(
      <ChatAttachmentImage
        attachment={attachment}
        conversationId="conv-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByAltText("context.png")).toHaveAttribute(
        "src",
        "blob:downloaded",
      );
    });
    expect(fetchBlob).toHaveBeenCalledWith("conv-1", "att-1");

    rendered.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:downloaded");
  });

  it("shows a fallback when the image cannot be downloaded", async () => {
    fetchBlob.mockRejectedValue(new Error("offline"));
    render(
      <ChatAttachmentImage
        attachment={attachment}
        conversationId="conv-1"
      />,
    );

    expect(await screen.findByText("Imagem indisponível")).toBeInTheDocument();
  });
});
