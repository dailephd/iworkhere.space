import { detectImageFileFormat, validateImageFileDimension, type ImageFileDimension, type ImageFileFormat } from "./imageFile";

export class ImageFileError extends Error {}

export async function readImageFileFormat(file: File): Promise<ImageFileFormat> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const format = detectImageFileFormat(bytes);
    if (!format) throw new ImageFileError("Select a JPEG, PNG or WebP image. The file encoding is not supported.");
    return format;
}

export async function decodeImageFile(file: File): Promise<ImageBitmap> {
    try {
        return await createImageBitmap(file);
    } catch {
        throw new ImageFileError("This image could not be decoded. It may be corrupt or unsupported by your browser.");
    }
}

export async function inspectImageFile(file: File): Promise<ImageFileDimension> {
    const bitmap = await decodeImageFile(file);
    try {
        const dimension = { width: bitmap.width, height: bitmap.height };
        const error = validateImageFileDimension(dimension);
        if (error) throw new ImageFileError(error);
        return dimension;
    } finally {
        bitmap.close();
    }
}
