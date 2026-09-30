import { describe, expect, it } from "vitest";
import { HEIC_DEFAULT_OUTPUT, HEIC_DEFAULT_QUALITY, HEIC_OUTPUT, heicFilename, heicPreviewDimension, heicQuality, heicRequiresWhite } from "./heicConverter";
import { heicErrorResponse, readHeicResponse, requireHeicBlob, type HeicWorkerRequest } from "./heicConverter.workerType";

describe("HEIC output contract", () => {
    it("offers only JPEG/PNG and defaults to JPEG at quality 90", () => {
        expect(HEIC_OUTPUT).toEqual(["jpeg", "png"]);
        expect(HEIC_DEFAULT_OUTPUT).toBe("jpeg");
        expect(HEIC_DEFAULT_QUALITY).toBe(90);
        expect(heicQuality("jpeg", HEIC_DEFAULT_QUALITY)).toBe(0.9);
    });
    it.each([10, 60, 100])("maps JPEG quality %s to a fraction", quality => {
        expect(heicQuality("jpeg", quality)).toBe(quality / 100);
    });
    it.each([undefined, 0, 9, 101, 12, 50.5, NaN, Infinity])("rejects invalid JPEG quality %s", quality => {
        expect(() => heicQuality("jpeg", quality)).toThrow();
    });
    it("PNG has no quality semantics; only JPEG requires white", () => {
        expect(heicQuality("png")).toBeUndefined();
        expect(heicQuality("png", 90)).toBeUndefined();
        expect(heicRequiresWhite("jpeg")).toBe(true);
        expect(heicRequiresWhite("png")).toBe(false);
    });
    it.each([
        ["photo.heic", "photo-converted.jpg"], ["camera.heif", "camera-converted.jpg"],
        ["my.photo.heic", "my.photo-converted.jpg"], ["", "image-converted.jpg"], [".heic", "image-converted.jpg"],
    ])("names %s", (name, expected) => { expect(heicFilename(name, "jpeg")).toBe(expected); });
    it("names PNG output", () => { expect(heicFilename("camera.heif", "png")).toBe("camera-converted.png"); });
    it.each([
        [4000, 3000, 512, 384], [3000, 4000, 384, 512], [256, 128, 256, 128], [1, 1, 1, 1], [512, 512, 512, 512],
    ])("preview %s × %s preserves ratio without upscaling", (width, height, expectedWidth, expectedHeight) => {
        expect(heicPreviewDimension(width, height)).toEqual({ width: expectedWidth, height: expectedHeight });
    });
});

describe("HEIC terminal protocol", () => {
    const request: HeicWorkerRequest = { id: 7, operation: "inspect", file: new File(["data"], "test.heic") };
    const previewBlob = new Blob(["png"], { type: "image/png" });
    const response = { id: 7, status: "inspected", sourceWidth: 100, sourceHeight: 50, previewBlob };
    it("accepts bounded inspection and conversion responses", () => {
        expect(readHeicResponse(response, request)).toEqual(response);
        const convert: HeicWorkerRequest = { ...request, operation: "convert", target: "jpeg", quality: 60 };
        const result = { id: 7, status: "converted", sourceWidth: 100, sourceHeight: 50, blob: new Blob(["jpeg"], { type: "image/jpeg" }) };
        expect(readHeicResponse(result, convert)).toEqual(result);
        expect(readHeicResponse(result, request)).toBeNull();
    });
    it("rejects stale identities and invalid dimensions", () => {
        expect(readHeicResponse({ ...response, id: 6 }, request)).toBeNull();
        expect(readHeicResponse({ ...response, sourceWidth: 0 }, request)).toBeNull();
        expect(readHeicResponse({ ...response, sourceHeight: 500_000 }, request)).toBeNull();
    });
    it("returns only a safe category and never serializes errors/stacks", () => {
        const safe = heicErrorResponse(7, "decode-failed");
        expect(safe).toEqual({ id: 7, status: "error", category: "decode-failed" });
        expect(readHeicResponse(safe, request)).toEqual(safe);
        expect(readHeicResponse({ ...safe, stack: "private stack" }, request)).toBeNull();
        expect(readHeicResponse({ ...safe, category: new Error("private data") }, request)).toBeNull();
        expect(readHeicResponse({ ...response, metadata: "private" }, request)).toBeNull();
        expect(readHeicResponse(null, request)).toBeNull();
    });
    it("exact MIME and non-empty output are mandatory", () => {
        expect(() => requireHeicBlob(new Blob(["data"], { type: "image/webp" }), "image/jpeg")).toThrow();
        expect(() => requireHeicBlob(new Blob([], { type: "image/png" }), "image/png")).toThrow();
        expect(() => readHeicResponse({ ...response, previewBlob: new Blob(["x"], { type: "image/jpeg" }) }, request)).toThrow();
    });
});
