import { imageFileBasename, IMAGE_FILE_ENCODING as IMAGE_COMPRESSOR_ENCODING,
    type ImageFileFormat as ImageCompressorFormat } from "./imageFile";

export const DEFAULT_QUALITY = 80;
export interface ImageCompressorSavings { reduced: boolean; bytesSaved: number; percentSaved: number }

export function validateImageCompressorQuality(quality: number): string | null {
    return Number.isInteger(quality) && quality >= 10 && quality <= 100 && quality % 5 === 0
        ? null : "Quality must be between 10 and 100 in steps of 5.";
}

export function imageCompressorQuality(quality: number): number { return quality / 100; }

export function imageCompressorSavings(inputBytes: number, outputBytes: number): ImageCompressorSavings {
    const reduced = outputBytes < inputBytes;
    const bytesSaved = reduced ? inputBytes - outputBytes : 0;
    return { reduced, bytesSaved, percentSaved: reduced ? bytesSaved / inputBytes * 100 : 0 };
}

export function imageCompressorFilename(name: string, format: ImageCompressorFormat): string {
    const basename = imageFileBasename(name);
    return `${basename}-compressed.${IMAGE_COMPRESSOR_ENCODING[format].extension}`;
}
