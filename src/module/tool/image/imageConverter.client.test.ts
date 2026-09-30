import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertImage } from "./imageConverter.client";

const file = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "source.png");
describe("Converter native encoding and cleanup", () => {
    const close = vi.fn(), fillRect = vi.fn(), drawImage = vi.fn();
    const context = { fillStyle: "", fillRect, drawImage };
    const toBlob = vi.fn();
    const canvas = { width: 0, height: 0, getContext: vi.fn(), toBlob };
    beforeEach(() => {
        vi.clearAllMocks(); context.fillStyle = "";
        canvas.getContext.mockReturnValue(context);
        toBlob.mockImplementation((callback: (blob: Blob) => void, mime: string) => callback(new Blob(["encoded"], { type: mime })));
        vi.stubGlobal("document", { createElement: () => canvas });
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 240, height: 180, close }));
    });
    afterEach(() => vi.unstubAllGlobals());
    it("fills JPEG white before drawing and encodes the requested quality", async () => {
        const output = await convertImage(file(), "jpeg", 60);
        expect(output.type).toBe("image/jpeg");
        expect(context.fillStyle).toBe("#ffffff");
        expect(fillRect).toHaveBeenCalledWith(0, 0, 240, 180);
        expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(drawImage.mock.invocationCallOrder[0]);
        expect(toBlob.mock.calls[0].slice(1)).toEqual(["image/jpeg", 0.6]);
        expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
    });
    it("retains alpha-capable WebP without a background fill", async () => {
        expect((await convertImage(file(), "webp", 90)).type).toBe("image/webp");
        expect(fillRect).not.toHaveBeenCalled();
        expect(toBlob.mock.calls[0].slice(1)).toEqual(["image/webp", 0.9]);
    });
    it("encodes PNG without a quality argument", async () => {
        const jpeg = new File([new Uint8Array([255, 216])], "source.jpg");
        expect((await convertImage(jpeg, "png", NaN)).type).toBe("image/png");
        expect(toBlob.mock.calls[0]).toHaveLength(2); expect(fillRect).not.toHaveBeenCalled();
    });
    it("rejects same-format and invalid quality before decode", async () => {
        await expect(convertImage(file(), "png", 90)).rejects.toThrow("different output format");
        await expect(convertImage(file(), "jpeg", 11)).rejects.toThrow("steps of 5");
        expect(createImageBitmap).not.toHaveBeenCalled();
    });
    it("rejects empty and unsupported input before decode", async () => {
        await expect(convertImage(new File([], "empty"), "jpeg", 90)).rejects.toThrow("non-empty");
        await expect(convertImage(new File(["unsupported"], "wrong"), "jpeg", 90)).rejects.toThrow("not valid JPEG, PNG, or WebP");
        expect(createImageBitmap).not.toHaveBeenCalled();
    });
    it("closes oversized decoded sources without creating an output", async () => {
        vi.mocked(createImageBitmap).mockResolvedValueOnce({ width: 6000, height: 6000, close } as unknown as ImageBitmap);
        await expect(convertImage(file(), "jpeg", 90)).rejects.toThrow("30,000,000 pixels (30 MP)");
        expect(close).toHaveBeenCalledOnce(); expect(toBlob).not.toHaveBeenCalled();
    });
    it("closes and releases canvas on context failure", async () => {
        canvas.getContext.mockReturnValueOnce(null);
        await expect(convertImage(file(), "jpeg", 90)).rejects.toThrow("could not create the canvas");
        expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
    });
    it.each([null, new Blob([], { type: "image/jpeg" }), new Blob(["fallback"], { type: "image/png" })])("rejects failed/empty/fallback serialization", async blob => {
        toBlob.mockImplementationOnce((callback: (blob: Blob | null) => void) => callback(blob));
        await expect(convertImage(file(), "jpeg", 90)).rejects.toThrow("could not produce a valid JPEG result");
        expect(close).toHaveBeenCalledOnce(); expect(canvas.height).toBe(0);
    });
    it("closes and releases canvas if drawing throws", async () => {
        drawImage.mockImplementationOnce(() => { throw new Error("draw failed"); });
        await expect(convertImage(file(), "jpeg", 90)).rejects.toThrow("draw failed");
        expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
    });
});
