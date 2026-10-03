import { afterEach, expect, it, vi } from "vitest";
import { validateImageFileSize, validateImageFileDimension } from "./imageFile";
import { decodeImageFile, readImageFileFormat } from "./imageFile.client";
import { validateImageResizerDimension } from "./imageResizer";
import { resizeImage } from "./imageResizer.client";
import { compressImage } from "./imageCompressor.client";
import { convertImage } from "./imageConverter.client";
import { HeicProcessingError, heicErrorResponse, readHeicResponse } from "./heicConverter.workerType";

afterEach(() => vi.unstubAllGlobals());
it("source byte limit explains actual size, maximum and recovery", () => {
    expect(validateImageFileSize(26 * 1024 * 1024)).toBe("This image is 26.0 MiB. The maximum file size is 25 MiB. Choose a smaller image.");
    expect(validateImageFileSize(0)).toBe("This file is empty. Choose a non-empty image.");
});
it("decoded area feedback includes actual dimensions and pixel count", () => {
    expect(validateImageFileDimension({ width: 8256, height: 5504 })).toBe("This image is 8256 × 5504 px (45,441,024 pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller image.");
    expect(validateImageFileDimension({ width: NaN, height: 0 })).toBe("The image reported invalid dimensions and cannot be processed. Choose another image.");
});
it("target area feedback identifies the requested output", () => {
    expect(validateImageResizerDimension({ width: 6000, height: 5001 })).toBe("The requested output is 6000 × 5001 px (30,006,000 pixels). The maximum is 30,000,000 pixels (30 MP). Choose smaller dimensions.");
});
it("signature failure names supported content and decode uncertainty does not assert corruption", async () => {
    await expect(readImageFileFormat(new File(["wrong"], "fake.jpg"))).rejects.toThrow("This file is not valid JPEG, PNG, or WebP image content. Choose a supported image.");
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("PRIVATE_DETAIL")));
    await expect(decodeImageFile(new File(["data"], "private"))).rejects.toThrow("The file format is supported, but the image data could not be decoded. The file may be damaged or use an image variant this browser does not support. Choose another image.");
});
it.each(["resize", "compress", "convert"] as const)("%s encoding feedback includes the format even for a thrown encoder", async operation => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() }));
    const toBlob = vi.fn(() => { throw new Error("PRIVATE_DETAIL"); });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), fillRect: vi.fn() }), toBlob }) });
    const file = new File([new Uint8Array([255, 216])], "source.jpg");
    const promise = operation === "resize" ? resizeImage(file, "jpeg", { width: 5, height: 5 })
        : operation === "compress" ? compressImage(file, "jpeg", 60) : convertImage(file, "webp", 60);
    await expect(promise).rejects.toThrow(operation === "resize" ? "encode the resized image as JPEG" : operation === "compress" ? "encode the compressed result as JPEG" : "produce a valid WebP result");
});
it.each([
    ["unsupported", "This file is not valid HEIC or HEIF content. Choose a HEIC or HEIF image."],
    ["decode-failed", "The file is HEIC/HEIF content, but its image data could not be decoded."],
    ["canvas-unavailable", "Use another current browser with OffscreenCanvas support."],
    ["worker-start-failed", "browser could not create the decoder worker. Reload the page"],
    ["worker-runtime-failed", "worker stopped unexpectedly while processing this image. Reset"],
    ["worker-response-invalid", "invalid response, so the result was discarded. Reset"],
] as const)("HEIC %s feedback identifies stage and action", (category, message) => {
    expect(new HeicProcessingError(category).message).toContain(message);
});
it.each(["jpeg", "png"] as const)("HEIC encoding feedback uses requested %s", target => {
    expect(new HeicProcessingError("encode-failed", undefined, target, "convert").message).toContain(`produce a valid ${target.toUpperCase()} result`);
});
it("HEIC inspection encoding feedback identifies its PNG preview", () => {
    expect(new HeicProcessingError("encode-failed", undefined, "png", "inspect").message).toBe(
        "The HEIC image decoded successfully, but the browser could not create its PNG preview. Reset the tool and try again, or try another current browser.",
    );
});
it("HEIC dimensions travel only in the bounded oversized-dimension category", () => {
    const request = { id: 3, operation: "inspect" as const, file: new File(["data"], "source") };
    const response = heicErrorResponse(3, "source-dimension-limit", { width: 8256, height: 5504 });
    expect(readHeicResponse(response, request)).toEqual(response);
    expect(new HeicProcessingError("source-dimension-limit", { width: 8256, height: 5504 }).message).toBe("This HEIC image is 8256 × 5504 px (45,441,024 pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller HEIC or HEIF image.");
    expect(heicErrorResponse(3, "decode-failed", { width: 8256, height: 5504 })).toEqual({ id: 3, status: "error", category: "decode-failed" });
});
it.each([
    { sourceWidth: 480, sourceHeight: 320 }, { sourceWidth: Infinity, sourceHeight: 5504 },
    { sourceWidth: -1, sourceHeight: 5504 }, { sourceWidth: 8256 },
    { sourceWidth: 8256, sourceHeight: 5504, stack: "PRIVATE_DETAIL" },
])("rejects invalid category-specific dimension fields %j", fields => {
    const request = { id: 3, operation: "inspect" as const, file: new File(["data"], "source") };
    expect(readHeicResponse({ id: 3, status: "error", category: "source-dimension-limit", ...fields }, request)).toBeNull();
    expect(readHeicResponse({ id: 3, status: "error", category: "decode-failed", ...fields }, request)).toBeNull();
});
