import { render, waitFor } from "@testing-library/react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGlobalShortcut } from "@/hooks/use-global-shortcut";
import { toggleAppVisibility } from "@/lib/app-windows";

vi.mock("@/lib/app-windows", () => ({
  toggleAppVisibility: vi.fn(() => Promise.resolve()),
}));

function Harness({
  enabled = true,
  onTrigger,
}: {
  enabled?: boolean;
  onTrigger?: () => void;
}) {
  useGlobalShortcut({ enabled, onTrigger });
  return null;
}

describe("useGlobalShortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(register).mockResolvedValue();
    vi.mocked(unregister).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the primary shortcut and toggles only on press", async () => {
    render(<Harness />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        "CommandOrControl+Shift+L",
        expect.any(Function),
      ),
    );

    const handler = vi.mocked(register).mock.calls[0]?.[1];
    handler?.({
      shortcut: "CommandOrControl+Shift+L",
      id: 1,
      state: "Released",
    });
    expect(toggleAppVisibility).not.toHaveBeenCalled();

    handler?.({
      shortcut: "CommandOrControl+Shift+L",
      id: 1,
      state: "Pressed",
    });
    expect(toggleAppVisibility).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next accelerator alias when the first one fails", async () => {
    vi.mocked(register)
      .mockRejectedValueOnce(new Error("invalid accelerator"))
      .mockResolvedValueOnce();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<Harness />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        "CmdOrControl+Shift+L",
        expect.any(Function),
      ),
    );
  });

  it("calls onTrigger instead of toggleAppVisibility when provided", async () => {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        "CommandOrControl+Shift+L",
        expect.any(Function),
      ),
    );

    const handler = vi.mocked(register).mock.calls[0]?.[1];
    handler?.({
      shortcut: "CommandOrControl+Shift+L",
      id: 1,
      state: "Pressed",
    });

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(toggleAppVisibility).not.toHaveBeenCalled();
  });

  it("unregisters the shortcut that actually registered", async () => {
    const { unmount } = render(<Harness />);

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    unmount();

    expect(unregister).toHaveBeenCalledWith("CommandOrControl+Shift+L");
  });
});
