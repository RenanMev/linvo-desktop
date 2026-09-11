import { beforeEach, describe, expect, it } from "vitest";

import {
  focusPreviousWindow,
  rememberPreviousWindow,
} from "@/lib/focus-previous-window";
import { invokeMock } from "@/test/mocks/tauri";

describe("focusPreviousWindow", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes the native restore and swallows failure", async () => {
    invokeMock.mockResolvedValueOnce(true);
    await expect(focusPreviousWindow()).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("focus_previous_window");

    invokeMock.mockRejectedValueOnce(new Error("win32"));
    await expect(focusPreviousWindow()).resolves.toBe(false);
  });

  it("records the previous window before Linvo takes over", async () => {
    invokeMock.mockResolvedValueOnce(null);
    await rememberPreviousWindow();
    expect(invokeMock).toHaveBeenCalledWith("remember_previous_window");
  });
});
