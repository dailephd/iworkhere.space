import { describe, expect, it } from "vitest";
import { heightFromWidth, widthFromHeight, imageResizerFilename, validateImageResizerDimension } from "./imageResizer";
import { detectImageFileFormat as detectImageResizerFormat, formatImageFileBytes as formatImageResizerBytes,
    MAX_SOURCE_BYTES, validateImageFileSize as validateImageResizerSize, type ImageFileFormat as ImageResizerFormat } from "./imageFile";


describe("Image Resizer signatures", () => {
    it.each([
        [[0xff, 0xd8], "jpeg"],
        [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png"],
        [[0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50], "webp"],
        [[], null], [[0xff], null], [[1, 2, 3], null],
        [[0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20], null],
    ])("detects bytes %j as %s", (bytes, format) => {
        expect(detectImageResizerFormat(new Uint8Array(bytes as number[]))).toBe(format);
    });
    it("does not consume filename or declared MIME to determine format", () => {
        const selected = { name: "misleading.png", type: "image/webp", bytes: new Uint8Array([0xff, 0xd8]) };
        expect(detectImageResizerFormat(selected.bytes)).toBe("jpeg");
    });
});

describe("Image Resizer limits", () => {
    it.each([0, -1, Number.NaN])("rejects empty/invalid source size %s", size => expect(validateImageResizerSize(size)).toBeTruthy());
    it("accepts exactly 25 MiB", () => expect(validateImageResizerSize(MAX_SOURCE_BYTES)).toBeNull());
    it("rejects more than 25 MiB", () => expect(validateImageResizerSize(MAX_SOURCE_BYTES + 1)).toContain("25 MiB"));
    it("accepts positive integer dimensions", () => expect(validateImageResizerDimension({ width: 80, height: 60 })).toBeNull());
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid width and height %s", value => {
        expect(validateImageResizerDimension({ width: value, height: 60 })).toContain("Width");
        expect(validateImageResizerDimension({ width: 80, height: value })).toContain("Height");
        expect(validateImageResizerDimension({ width: value, height: 60 }, true)).toContain("invalid dimensions");
    });
    it.each([true, false])("accepts exactly 30 MP (source=%s)", source => expect(validateImageResizerDimension({ width: 6000, height: 5000 }, source)).toBeNull());
    it.each([true, false])("rejects above 30 MP (source=%s)", source => expect(validateImageResizerDimension({ width: 6000, height: 5001 }, source)).toContain("30,000,000 pixels (30 MP)"));
});

describe("Image Resizer original aspect ratio", () => {
    it("derives height from original 800x600", () => expect(heightFromWidth(400, { width: 800, height: 600 })).toBe(300));
    it("derives width from original 800x600", () => expect(widthFromHeight(300, { width: 800, height: 600 })).toBe(400));
    it("rounds without accumulating previous ratio drift", () => expect(heightFromWidth(333, { width: 800, height: 600 })).toBe(250));
    it("keeps derived dimensions at least one", () => {
        expect(heightFromWidth(1, { width: 800, height: 1 })).toBe(1);
        expect(widthFromHeight(1, { width: 1, height: 800 })).toBe(1);
    });
});

describe("Image Resizer filenames and byte display", () => {
    it.each(["jpeg", "png", "webp"] as ImageResizerFormat[])("uses canonical %s extension", format => {
        expect(imageResizerFilename("photo.wrong", { width: 40, height: 30 }, format)).toBe(`photo-40x30.${format === "jpeg" ? "jpg" : format}`);
    });
    it("strips only the final extension", () => expect(imageResizerFilename("photo.edit.jpg", { width: 40, height: 30 }, "jpeg")).toBe("photo.edit-40x30.jpg"));
    it.each(["", ".png", "   "])("falls back for unusable basename %s", name => expect(imageResizerFilename(name, { width: 40, height: 30 }, "png")).toBe("image-40x30.png"));
    it("retains a name without an extension", () => expect(imageResizerFilename("photo", { width: 40, height: 30 }, "webp")).toBe("photo-40x30.webp"));
    it.each([[0, "0 B"], [1023, "1023 B"], [1024, "1.0 KiB"], [1048576, "1.0 MiB"], [MAX_SOURCE_BYTES, "25.0 MiB"]])("formats %s bytes", (bytes, label) => expect(formatImageResizerBytes(bytes as number)).toBe(label));
});
