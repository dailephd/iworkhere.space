import { IMAGE_FILE_ENCODING, imageFileBasename, type ImageFileFormat } from "./imageFile";

export const DEFAULT_QUALITY = 90;

export function imageConverterOutputOptions(source: ImageFileFormat): ImageFileFormat[] {
    const format: ImageFileFormat[] = ["jpeg", "png", "webp"];
    return format.filter(target => target !== source);
}

export function imageConverterDefaultOutput(source: ImageFileFormat): ImageFileFormat {
    return imageConverterOutputOptions(source)[0];
}

export function validateImageConverterPair(source: ImageFileFormat, target: ImageFileFormat): string | null {
    return imageConverterOutputOptions(source).includes(target) ? null : "Choose a different output format. The source and output formats cannot be the same.";
}

export function imageConverterSupportsQuality(target: ImageFileFormat): boolean { return target !== "png"; }

export function validateImageConverterQuality(quality: number): string | null {
    return Number.isInteger(quality) && quality >= 10 && quality <= 100 && quality % 5 === 0
        ? null : "Quality must be between 10 and 100 in steps of 5.";
}

export function imageConverterQuality(quality: number): number { return quality / 100; }

export function imageConverterRequiresWhite(target: ImageFileFormat): boolean { return target === "jpeg"; }

export function imageConverterFilename(name: string, target: ImageFileFormat): string {
    return `${imageFileBasename(name)}-converted.${IMAGE_FILE_ENCODING[target].extension}`;
}
