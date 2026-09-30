import { IMAGE_FILE_ENCODING, validateImageFileDimension, validateImageFileSize, type ImageFileFormat } from "./imageFile";
import { decodeImageFile, ImageFileError, readImageFileFormat } from "./imageFile.client";
import { imageConverterQuality, imageConverterRequiresWhite, imageConverterSupportsQuality,
    validateImageConverterPair, validateImageConverterQuality } from "./imageConverter";

export async function convertImage(file: File, target: ImageFileFormat, quality: number): Promise<Blob> {
    const sizeError = validateImageFileSize(file.size);
    if (sizeError) throw new ImageFileError(sizeError);
    const source = await readImageFileFormat(file);
    const pairError = validateImageConverterPair(source, target);
    if (pairError) throw new ImageFileError(pairError);
    const qualityError = imageConverterSupportsQuality(target) ? validateImageConverterQuality(quality) : null;
    if (qualityError) throw new ImageFileError(qualityError);
    const bitmap = await decodeImageFile(file);
    let canvas: HTMLCanvasElement | undefined;
    try {
        const dimensionError = validateImageFileDimension({ width: bitmap.width, height: bitmap.height });
        if (dimensionError) throw new ImageFileError(dimensionError);
        canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new ImageFileError("Your browser could not create a canvas for conversion. Try again.");
        if (imageConverterRequiresWhite(target)) {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob | null>(resolve => {
            if (imageConverterSupportsQuality(target)) canvas!.toBlob(resolve, IMAGE_FILE_ENCODING[target].mime, imageConverterQuality(quality));
            else canvas!.toBlob(resolve, IMAGE_FILE_ENCODING[target].mime);
        });
        if (!blob || blob.size === 0 || blob.type !== IMAGE_FILE_ENCODING[target].mime) {
            throw new ImageFileError("Your browser could not encode the selected output format. Try again or select another format.");
        }
        return blob;
    } finally {
        bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}
