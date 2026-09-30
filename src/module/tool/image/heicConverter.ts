import { imageFileBasename, type ImageFileDimension } from "./imageFile";

export type HeicConverterTarget = "jpeg" | "png";
export const HEIC_OUTPUT = ["jpeg", "png"] as const;
export const HEIC_DEFAULT_OUTPUT: HeicConverterTarget = "jpeg";
export const HEIC_DEFAULT_QUALITY = 90;

export function heicQuality(target: HeicConverterTarget, quality?: number): number | undefined {
    if (target === "png") return undefined;
    if (quality === undefined || !Number.isInteger(quality) || quality < 10 || quality > 100 || quality % 5 !== 0) {
        throw new Error("Choose a JPEG quality from 10 to 100 in steps of 5.");
    }
    return quality / 100;
}

export function heicFilename(name: string, target: HeicConverterTarget): string {
    return `${imageFileBasename(name)}-converted.${target === "jpeg" ? "jpg" : "png"}`;
}

export function heicPreviewDimension(width: number, height: number): ImageFileDimension {
    const scale = Math.min(1, 512 / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function heicRequiresWhite(target: HeicConverterTarget): boolean {
    return target === "jpeg";
}
