import { afterEach, expect, it, vi } from "vitest";
import { encodeHeicBitmap } from "./heicConverter.canvas";

afterEach(() => vi.unstubAllGlobals());

function canvasFixture(mime: string) {
    const order: string[] = [];
    const context = { fillStyle: "", fillRect: vi.fn(() => order.push("white")), drawImage: vi.fn(() => order.push("draw")) };
    const convertToBlob = vi.fn(async () => new Blob(["encoded"], { type: mime }));
    const construct = vi.fn();
    class Canvas {
        constructor(width: number, height: number) { construct(width, height); }
        getContext() { return context; }
        convertToBlob = convertToBlob;
    }
    vi.stubGlobal("OffscreenCanvas", Canvas);
    return { order, context, convertToBlob, construct };
}
const bitmap = { width: 4000, height: 3000 } as ImageBitmap;

it("fills the entire JPEG output white before drawing at exact dimensions", async () => {
    const canvas = canvasFixture("image/jpeg");
    await encodeHeicBitmap(bitmap, 4000, 3000, "jpeg", 60);
    expect(canvas.construct).toHaveBeenCalledWith(4000, 3000);
    expect(canvas.context.fillStyle).toBe("#ffffff");
    expect(canvas.context.fillRect).toHaveBeenCalledWith(0, 0, 4000, 3000);
    expect(canvas.order).toEqual(["white", "draw"]);
    expect(canvas.convertToBlob).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.6 });
});
it("PNG draws without opaque fill or a quality property", async () => {
    const canvas = canvasFixture("image/png");
    await encodeHeicBitmap(bitmap, 512, 384, "png");
    expect(canvas.context.fillRect).not.toHaveBeenCalled();
    expect(canvas.context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 512, 384);
    expect(canvas.convertToBlob).toHaveBeenCalledWith({ type: "image/png" });
});
it("rejects missing canvas support and MIME mismatch", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    await expect(encodeHeicBitmap(bitmap, 10, 10, "png")).rejects.toMatchObject({ category: "canvas-unavailable" });
    canvasFixture("image/webp");
    await expect(encodeHeicBitmap(bitmap, 10, 10, "png")).rejects.toMatchObject({ category: "encode-failed" });
});
it("recovers from missing context and failed encoding", async () => {
    vi.stubGlobal("OffscreenCanvas", class { getContext() { return null; } });
    await expect(encodeHeicBitmap(bitmap, 10, 10, "png")).rejects.toMatchObject({ category: "canvas-unavailable" });
    const canvas = canvasFixture("image/png");
    canvas.convertToBlob.mockRejectedValue(new Error("browser encoder failed"));
    await expect(encodeHeicBitmap(bitmap, 10, 10, "png")).rejects.toMatchObject({ category: "encode-failed" });
});
