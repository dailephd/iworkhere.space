import { detectImageFileFormat, validateImageFileDimension, type ImageFileDimension, type ImageFileFormat } from "./imageFile";

export class ImageFileError extends Error {}

export async function readImageFileFormat(file: File): Promise<ImageFileFormat> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const format = detectImageFileFormat(bytes);
    if (!format) throw new ImageFileError("This file is not valid JPEG, PNG, or WebP image content. Choose a supported image.");
    return format;
}

export async function decodeImageFile(file: File): Promise<ImageBitmap> {
    try {
        return await createImageBitmap(file);
    } catch {
        throw new ImageFileError("The file format is supported, but the image data could not be decoded. The file may be damaged or use an image variant this browser does not support. Choose another image.");
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
