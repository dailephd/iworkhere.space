import { IMAGE_FILE_ENCODING as IMAGE_COMPRESSOR_ENCODING, validateImageFileDimension as validateImageCompressorDimension,
    type ImageFileFormat as ImageCompressorFormat } from "./imageFile";
import { ImageFileError as ImageCompressorError, decodeImageFile } from "./imageFile.client";
import { imageCompressorQuality, validateImageCompressorQuality } from "./imageCompressor";

export async function compressImage(file: File, format: ImageCompressorFormat, quality: number): Promise<Blob> {
    const qualityError = format === "png" ? null : validateImageCompressorQuality(quality);
    if (qualityError) throw new ImageCompressorError(qualityError);
    const bitmap = await decodeImageFile(file);
    let canvas: HTMLCanvasElement | undefined;
    try {
        const sourceError = validateImageCompressorDimension({ width: bitmap.width, height: bitmap.height });
        if (sourceError) throw new ImageCompressorError(sourceError);
        canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new ImageCompressorError("The browser could not create the canvas needed to compress this image. Reset the tool and try again. If the problem repeats, try another current browser.");
        context.drawImage(bitmap, 0, 0);
        const encodingError = `The browser could not encode the compressed result as ${IMAGE_COMPRESSOR_ENCODING[format].label}. Reset the tool and try again. If the problem repeats, try another current browser.`;
        const blob = await new Promise<Blob | null>(resolve => {
            if (format === "png") canvas!.toBlob(resolve, IMAGE_COMPRESSOR_ENCODING[format].mime);
            else canvas!.toBlob(resolve, IMAGE_COMPRESSOR_ENCODING[format].mime, imageCompressorQuality(quality));
        }).catch(() => { throw new ImageCompressorError(encodingError); });
        if (!blob || blob.size === 0 || blob.type !== IMAGE_COMPRESSOR_ENCODING[format].mime) {
            throw new ImageCompressorError(encodingError);
        }
        return blob;
    } finally {
        bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}
