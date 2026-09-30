import {
    detectImageResizerFormat, IMAGE_RESIZER_ENCODING, validateImageResizerDimension,
    type ImageResizerDimension, type ImageResizerFormat,
} from "./imageResizer";

export class ImageResizerError extends Error {}

export async function readImageResizerFormat(file: File): Promise<ImageResizerFormat> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const format = detectImageResizerFormat(bytes);
    if (!format) throw new ImageResizerError("Select a JPEG, PNG or WebP image. The file encoding is not supported.");
    return format;
}

async function decodeImageResizer(file: File): Promise<ImageBitmap> {
    try {
        return await createImageBitmap(file);
    } catch {
        throw new ImageResizerError("This image could not be decoded. It may be corrupt or unsupported by your browser.");
    }
}

export async function inspectImageResizer(file: File): Promise<ImageResizerDimension> {
    const bitmap = await decodeImageResizer(file);
    try {
        const dimension = { width: bitmap.width, height: bitmap.height };
        const error = validateImageResizerDimension(dimension, true);
        if (error) throw new ImageResizerError(error);
        return dimension;
    } finally {
        bitmap.close();
    }
}

export async function resizeImage(file: File, format: ImageResizerFormat, dimension: ImageResizerDimension): Promise<Blob> {
    const error = validateImageResizerDimension(dimension);
    if (error) throw new ImageResizerError(error);
    const bitmap = await decodeImageResizer(file);
    let canvas: HTMLCanvasElement | undefined;
    try {
        const sourceError = validateImageResizerDimension({ width: bitmap.width, height: bitmap.height }, true);
        if (sourceError) throw new ImageResizerError(sourceError);
        canvas = document.createElement("canvas");
        canvas.width = dimension.width;
        canvas.height = dimension.height;
        const context = canvas.getContext("2d");
        if (!context) throw new ImageResizerError("Your browser could not create a canvas for resizing. Try again.");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, dimension.width, dimension.height);
        const blob = await new Promise<Blob | null>(resolve => {
            if (format === "png") canvas!.toBlob(resolve, IMAGE_RESIZER_ENCODING[format].mime);
            else canvas!.toBlob(resolve, IMAGE_RESIZER_ENCODING[format].mime, 0.92);
        });
        if (!blob || blob.size === 0 || blob.type !== IMAGE_RESIZER_ENCODING[format].mime) {
            throw new ImageResizerError("Your browser could not encode the resized image in its original format. Try again.");
        }
        return blob;
    } finally {
        bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}
