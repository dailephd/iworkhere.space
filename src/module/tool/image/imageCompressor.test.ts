import { describe, expect, it } from "vitest";
import { DEFAULT_QUALITY, validateImageCompressorQuality, imageCompressorQuality, imageCompressorSavings, imageCompressorFilename } from "./imageCompressor";
import { MAX_SOURCE_BYTES, detectImageFileFormat as detectImageCompressorFormat,
    validateImageFileSize as validateImageCompressorSize, validateImageFileDimension as validateImageCompressorDimension,
    formatImageFileBytes as formatImageCompressorBytes } from "./imageFile";


describe("Compressor common source rules after proven extraction", () => {
    it.each([
        [[255, 216], "jpeg"], [[137, 80, 78, 71, 13, 10, 26, 10], "png"],
        [[82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], "webp"], [[0, 1, 2], null], [[], null],
    ])("identifies encoding from bytes %j", (bytes, expected) => {
        expect(detectImageCompressorFormat(new Uint8Array(bytes as number[]))).toBe(expected);
    });
    it("does not consult filenames or declared MIME", () => {
        expect(detectImageCompressorFormat(new Uint8Array([255, 216]))).toBe("jpeg");
    });
    it.each([0, -1, NaN, Infinity])("rejects empty/invalid byte size %s", size => expect(validateImageCompressorSize(size)).toContain("non-empty"));
    it("accepts exactly 25 MiB", () => expect(validateImageCompressorSize(MAX_SOURCE_BYTES)).toBeNull());
    it("rejects more than 25 MiB", () => expect(validateImageCompressorSize(MAX_SOURCE_BYTES + 1)).toContain("25 MiB"));
    it.each([{ width: 0, height: 1 }, { width: -1, height: 1 }, { width: 1.5, height: 2 }, { width: 1, height: 0 }, { width: 1, height: Infinity }])("rejects invalid source dimensions %j", dimension => expect(validateImageCompressorDimension(dimension)).toContain("invalid dimensions"));
    it("accepts positive dimensions", () => expect(validateImageCompressorDimension({ width: 240, height: 180 })).toBeNull());
    it("accepts exactly 30 MP", () => expect(validateImageCompressorDimension({ width: 6000, height: 5000 })).toBeNull());
    it("rejects more than 30 MP", () => expect(validateImageCompressorDimension({ width: 6000, height: 5001 })).toContain("30,000,000 pixels (30 MP)"));
});

describe("Compressor quality and measured outcomes", () => {
    it("defaults to 80", () => expect(DEFAULT_QUALITY).toBe(80));
    it.each([10, 60, 80, 100])("accepts quality %s", quality => expect(validateImageCompressorQuality(quality)).toBeNull());
    it.each([5, 105, 60.5, 61, NaN])("rejects invalid quality %s", quality => expect(validateImageCompressorQuality(quality)).not.toBeNull());
    it.each([[80, 0.8], [60, 0.6]])("converts quality %s", (quality, expected) => expect(imageCompressorQuality(quality)).toBe(expected));
    it("calculates actual reduction", () => expect(imageCompressorSavings(1000, 600)).toEqual({ reduced: true, bytesSaved: 400, percentSaved: 40 }));
    it.each([1000, 1200])("does not claim reduction for %s bytes", output => expect(imageCompressorSavings(1000, output)).toEqual({ reduced: false, bytesSaved: 0, percentSaved: 0 }));
    it.each([
        ["photo.jpeg", "jpeg", "photo-compressed.jpg"], ["graphic.png", "png", "graphic-compressed.png"],
        ["photo.webp", "webp", "photo-compressed.webp"], ["diagram.final.png", "png", "diagram.final-compressed.png"],
        ["", "jpeg", "image-compressed.jpg"], [".png", "png", "image-compressed.png"], ["  ", "webp", "image-compressed.webp"],
    ] as const)("names output for %s", (name, format, expected) => expect(imageCompressorFilename(name, format)).toBe(expected));
    it.each([[0, "0 B"], [1023, "1023 B"], [1024, "1.0 KiB"], [1048576, "1.0 MiB"]])("formats %s bytes", (bytes, expected) => expect(formatImageCompressorBytes(Number(bytes))).toBe(expected));
});
