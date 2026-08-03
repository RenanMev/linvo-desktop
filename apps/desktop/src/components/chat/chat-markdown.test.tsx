import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChatMarkdown,
  isAllowedExternalHref,
} from "@/components/chat/chat-markdown";

const { openUrlMock } = vi.hoisted(() => ({
  openUrlMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
}));

describe("ChatMarkdown links", () => {
  beforeEach(() => {
    openUrlMock.mockClear();
  });

  it("allows only explicitly supported external protocols", () => {
    expect(isAllowedExternalHref("https://example.com")).toBe(true);
    expect(isAllowedExternalHref("http://example.com")).toBe(true);
    expect(isAllowedExternalHref("mailto:user@example.com")).toBe(true);
    expect(isAllowedExternalHref("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalHref("/relative")).toBe(false);
  });

  it("opens allowed links with the Tauri opener and neutralizes blocked links", async () => {
    const user = userEvent.setup();
    render(
      <ChatMarkdown content="[Seguro](https://example.com) [Bloqueado](file:///etc/passwd)" />,
    );

    await user.click(screen.getByRole("link", { name: "Seguro" }));

    expect(openUrlMock).toHaveBeenCalledWith("https://example.com");
    expect(screen.getByText("Bloqueado").closest("a")).toBeNull();
  });
});
