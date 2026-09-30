export const MAX_SOURCE_BYTES = 26_214_400;
export const MAX_PIXEL_AREA = 30_000_000;

export type ImageFileFormat = "jpeg" | "png" | "webp";

export interface ImageFileDimension {
    width: number;
    height: number;
}

export interface ImageFileEncoding {
    mime: string;
    extension: string;
    label: string;
}

export const IMAGE_FILE_ENCODING: Record<ImageFileFormat, ImageFileEncoding> = {
    jpeg: { mime: "image/jpeg", extension: "jpg", label: "JPEG" },
    png: { mime: "image/png", extension: "png", label: "PNG" },
    webp: { mime: "image/webp", extension: "webp", label: "WebP" },
};

export function detectImageFileFormat(bytes: Uint8Array): ImageFileFormat | null {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) return "png";
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
    return null;
}

export function validateImageFileSize(size: number): string | null {
    if (!Number.isFinite(size) || size <= 0) return "This file is empty. Choose a non-empty image.";
    if (size > MAX_SOURCE_BYTES) return `This image is ${formatImageFileBytes(size)}. The maximum file size is 25 MiB. Choose a smaller image.`;
    return null;
}

export function validateImageFileDimension(dimension: ImageFileDimension): string | null {
    if (!Number.isFinite(dimension.width) || !Number.isInteger(dimension.width) || dimension.width <= 0 ||
        !Number.isFinite(dimension.height) || !Number.isInteger(dimension.height) || dimension.height <= 0) {
        return "The image reported invalid dimensions and cannot be processed. Choose another image.";
    }
    if (dimension.width * dimension.height > MAX_PIXEL_AREA) return `This image is ${dimension.width} \u00d7 ${dimension.height} px (${(dimension.width * dimension.height).toLocaleString("en-US")} pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller image.`;
    return null;
}

export function imageFileBasename(name: string): string {
    const finalDot = name.lastIndexOf(".");
    return (finalDot >= 0 ? name.slice(0, finalDot) : name).trim() || "image";
}

export function formatImageFileBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
