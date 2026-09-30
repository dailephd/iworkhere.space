/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeImageFile, ImageFileError, inspectImageFile, readImageFileFormat } from "./imageFile.client";
import { compressImage } from "./imageCompressor.client";

afterEach(() => vi.unstubAllGlobals());
const file = new File(["local"], "private.jpg");
describe("common image source browser boundaries", () => {
    it("reads only the initial twelve bytes", async () => {
        const slice = vi.fn(() => ({ arrayBuffer: async () => new Uint8Array([255, 216]).buffer }));
        expect(await readImageFileFormat({ slice } as unknown as File)).toBe("jpeg");
        expect(slice).toHaveBeenCalledWith(0, 12);
    });
    it("normalizes unsupported signature feedback", async () => {
        await expect(readImageFileFormat({ slice: () => ({ arrayBuffer: async () => new Uint8Array([0]).buffer }) } as unknown as File)).rejects.toThrow("not valid JPEG, PNG, or WebP image content");
    });
    it("normalizes decode exceptions without exposing source details", async () => {
        vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("private browser detail")));
        await expect(decodeImageFile(file)).rejects.toThrow(ImageFileError);
        await expect(decodeImageFile(file)).rejects.toThrow("image data could not be decoded.");
    });
    it("returns dimensions and closes an inspected bitmap", async () => {
        const close = vi.fn(); vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 240, height: 180, close }));
        expect(await inspectImageFile(file)).toEqual({ width: 240, height: 180 }); expect(close).toHaveBeenCalledOnce();
    });
    it.each([{ width: 0, height: 1 }, { width: 6000, height: 5001 }])("closes a rejected source bitmap %j", async dimension => {
        const close = vi.fn(); vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ ...dimension, close }));
        await expect(inspectImageFile(file)).rejects.toThrow(ImageFileError); expect(close).toHaveBeenCalledOnce();
    });
    it("Compressor rejects invalid quality before decoding or allocating canvas", async () => {
        const decode = vi.fn(); vi.stubGlobal("createImageBitmap", decode);
        await expect(compressImage(file, "jpeg", 101)).rejects.toThrow("Quality must be"); expect(decode).not.toHaveBeenCalled();
    });
});
