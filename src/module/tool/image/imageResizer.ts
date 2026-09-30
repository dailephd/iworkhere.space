export const MAX_SOURCE_BYTES = 26_214_400;
export const MAX_PIXEL_AREA = 30_000_000;

export type ImageResizerFormat = "jpeg" | "png" | "webp";

export interface ImageResizerDimension {
    width: number;
    height: number;
}

export interface ImageResizerEncoding {
    mime: string;
    extension: string;
    label: string;
}

export const IMAGE_RESIZER_ENCODING: Record<ImageResizerFormat, ImageResizerEncoding> = {
    jpeg: { mime: "image/jpeg", extension: "jpg", label: "JPEG" },
    png: { mime: "image/png", extension: "png", label: "PNG" },
    webp: { mime: "image/webp", extension: "webp", label: "WebP" },
};

export function detectImageResizerFormat(bytes: Uint8Array): ImageResizerFormat | null {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) return "png";
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
    return null;
}

export function validateImageResizerSize(size: number): string | null {
    if (!Number.isFinite(size) || size <= 0) return "Select a non-empty image file.";
    if (size > MAX_SOURCE_BYTES) return "The source image must be 25 MiB or smaller.";
    return null;
}

export function validateImageResizerDimension(dimension: ImageResizerDimension, source = false): string | null {
    if (!Number.isFinite(dimension.width) || !Number.isInteger(dimension.width) || dimension.width <= 0) {
        return source ? "The source image has invalid dimensions." : "Width must be a positive whole number.";
    }
    if (!Number.isFinite(dimension.height) || !Number.isInteger(dimension.height) || dimension.height <= 0) {
        return source ? "The source image has invalid dimensions." : "Height must be a positive whole number.";
    }
    if (dimension.width * dimension.height > MAX_PIXEL_AREA) {
        return source ? "The source image must contain 30 megapixels or fewer." : "The resized image must contain 30 megapixels or fewer.";
    }
    return null;
}

export function heightFromWidth(width: number, source: ImageResizerDimension): number {
    return Math.max(1, Math.round(width * source.height / source.width));
}

export function widthFromHeight(height: number, source: ImageResizerDimension): number {
    return Math.max(1, Math.round(height * source.width / source.height));
}

export function imageResizerFilename(name: string, dimension: ImageResizerDimension, format: ImageResizerFormat): string {
    const finalDot = name.lastIndexOf(".");
    const basename = (finalDot >= 0 ? name.slice(0, finalDot) : name).trim() || "image";
    return `${basename}-${dimension.width}x${dimension.height}.${IMAGE_RESIZER_ENCODING[format].extension}`;
}

export function formatImageResizerBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
