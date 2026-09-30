import { describe, expect, it } from "vitest";
import { DEFAULT_QUALITY, imageConverterDefaultOutput, imageConverterFilename, imageConverterOutputOptions,
    imageConverterQuality, imageConverterRequiresWhite, imageConverterSupportsQuality,
    validateImageConverterPair, validateImageConverterQuality } from "./imageConverter";
import type { ImageFileFormat } from "./imageFile";

const format: ImageFileFormat[] = ["jpeg", "png", "webp"];
describe("Image Converter operation rules", () => {
    it.each([
        ["jpeg", ["png", "webp"], "png"],
        ["png", ["jpeg", "webp"], "jpeg"],
        ["webp", ["jpeg", "png"], "jpeg"],
    ] as const)("orders distinct targets and defaults for %s", (source, target, defaultTarget) => {
        expect(imageConverterOutputOptions(source)).toEqual(target);
        expect(imageConverterDefaultOutput(source)).toBe(defaultTarget);
    });
    for (const source of format) for (const target of format) {
        it(`${source} to ${target} pair validation`, () => {
            expect(validateImageConverterPair(source, target)).toBe(source === target ? "Select another output format to convert this image." : null);
        });
    }
    it.each([10, 15, 60, 90, 100])("accepts quality %s", quality => {
        expect(validateImageConverterQuality(quality)).toBeNull();
        expect(imageConverterQuality(quality)).toBe(quality / 100);
    });
    it.each([0, 9, 11, 99, 101, 60.5, NaN, Infinity])("rejects invalid quality %s", quality => {
        expect(validateImageConverterQuality(quality)).not.toBeNull();
    });
    it("defaults to 90 and applies quality only to JPEG/WebP", () => {
        expect(DEFAULT_QUALITY).toBe(90);
        expect(imageConverterQuality(DEFAULT_QUALITY)).toBe(0.9);
        expect(format.map(imageConverterSupportsQuality)).toEqual([true, false, true]);
    });
    it("requires white flattening only for JPEG", () => {
        expect(format.map(imageConverterRequiresWhite)).toEqual([true, false, false]);
    });
    it.each([["jpeg", "jpg"], ["png", "png"], ["webp", "webp"]] as const)("names %s output", (target, extension) => {
        expect(imageConverterFilename("graphic.final.webp", target)).toBe(`graphic.final-converted.${extension}`);
        expect(imageConverterFilename("photo.png", target)).toBe(`photo-converted.${extension}`);
        expect(imageConverterFilename(".png", target)).toBe(`image-converted.${extension}`);
        expect(imageConverterFilename("", target)).toBe(`image-converted.${extension}`);
    });
});
