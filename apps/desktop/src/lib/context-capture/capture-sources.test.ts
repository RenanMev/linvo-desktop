import { describe, expect, it } from "vitest";

import {
  base64ToPngBlob,
  bytesToPngBlob,
} from "@/lib/context-capture/capture-sources";

describe("capture-sources helpers", () => {
  it("wraps raw bytes as a png blob", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = bytesToPngBlob(bytes);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });

  it("decodes base64 into a png blob", async () => {
    const blob = base64ToPngBlob(btoa("png-bytes"));
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("png-bytes");
  });
});
