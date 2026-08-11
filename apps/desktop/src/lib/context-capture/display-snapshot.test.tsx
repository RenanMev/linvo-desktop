import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DisplaySnapshotCancelledError,
  captureDisplaySnapshot,
  resolveDrawSizeForTests,
} from "@/lib/context-capture/display-snapshot";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveDrawSizeForTests", () => {
  it("keeps size when under the max dimension", () => {
    expect(resolveDrawSizeForTests(800, 600, 2048)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("scales down the longest side", () => {
    expect(resolveDrawSizeForTests(4096, 2048, 2048)).toEqual({
      width: 2048,
      height: 1024,
    });
  });
});

describe("captureDisplaySnapshot", () => {
  it.each(["NotAllowedError", "AbortError", "NotFoundError"])(
    "treats %s as picker cancellation",
    async (name) => {
      const error = new Error("cancelled");
      error.name = name;

      await expect(
        captureDisplaySnapshot({
          startDisplayMedia: async () => {
            throw error;
          },
        }),
      ).rejects.toBeInstanceOf(DisplaySnapshotCancelledError);
    },
  );

  it("propagates unexpected capture errors", async () => {
    await expect(
      captureDisplaySnapshot({
        startDisplayMedia: async () => {
          throw new Error("device failure");
        },
      }),
    ).rejects.toThrow("device failure");
  });

  it("captures a png frame and stops tracks", async () => {
    const { stream, stop } = createStream();
    mockMediaElements([
      new Blob(["img"], { type: "image/png" }),
    ]);

    const snapshot = await captureDisplaySnapshot({
      startDisplayMedia: async () => stream,
      waitForFrame: async () => undefined,
      now: () => new Date(2026, 7, 11, 15, 4, 5),
    });

    expect(snapshot).toEqual({
      blob: expect.any(Blob),
      mimeType: "image/png",
      filename: "context-20260811-150405.png",
      width: 640,
      height: 360,
      sourceLabel: "Janela Teste",
    });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("falls back to jpeg when png exceeds the byte limit", async () => {
    const { stream } = createStream();
    const { toBlob } = mockMediaElements([
      new Blob(["png-too-large"], { type: "image/png" }),
      new Blob(["jpeg"], { type: "image/jpeg" }),
    ]);

    const snapshot = await captureDisplaySnapshot({
      startDisplayMedia: async () => stream,
      waitForFrame: async () => undefined,
      maxBytes: 4,
    });

    expect(snapshot.mimeType).toBe("image/jpeg");
    expect(snapshot.filename).toMatch(/\.jpg$/);
    expect(toBlob).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      "image/jpeg",
      0.85,
    );
  });

  it("stops tracks when frame processing fails", async () => {
    const { stream, stop } = createStream();

    await expect(
      captureDisplaySnapshot({
        startDisplayMedia: async () => stream,
        waitForFrame: async () => {
          throw new Error("frame failure");
        },
      }),
    ).rejects.toThrow("frame failure");
    expect(stop).toHaveBeenCalledOnce();
  });
});

function createStream() {
  const stop = vi.fn();
  const track = { stop, label: "Janela Teste" };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

function mockMediaElements(blobs: Blob[]) {
  const originalCreateElement = document.createElement.bind(document);
  const toBlob = vi.fn(
    (
      callback: BlobCallback,
      _type?: string,
    ) => {
      callback(blobs.shift() ?? null);
    },
  );

  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName === "video") {
      const video = originalCreateElement("video") as HTMLVideoElement;
      Object.defineProperty(video, "videoWidth", { get: () => 640 });
      Object.defineProperty(video, "videoHeight", { get: () => 360 });
      video.play = vi.fn(async () => undefined) as typeof video.play;
      return video;
    }
    if (tagName === "canvas") {
      const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
      canvas.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
      })) as unknown as typeof canvas.getContext;
      canvas.toBlob = toBlob as typeof canvas.toBlob;
      return canvas;
    }
    return originalCreateElement(tagName);
  });

  return { toBlob };
}
