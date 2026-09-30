import { IMAGE_FILE_ENCODING as IMAGE_RESIZER_ENCODING, validateImageFileDimension,
    type ImageFileDimension as ImageResizerDimension, type ImageFileFormat as ImageResizerFormat } from "./imageFile";
import { ImageFileError as ImageResizerError, decodeImageFile } from "./imageFile.client";
import { validateImageResizerDimension } from "./imageResizer";

export async function resizeImage(file: File, format: ImageResizerFormat, dimension: ImageResizerDimension): Promise<Blob> {
    const error = validateImageResizerDimension(dimension);
    if (error) throw new ImageResizerError(error);
    const bitmap = await decodeImageFile(file);
    let canvas: HTMLCanvasElement | undefined;
    try {
        const sourceError = validateImageFileDimension({ width: bitmap.width, height: bitmap.height });
        if (sourceError) throw new ImageResizerError(sourceError);
        canvas = document.createElement("canvas");
        canvas.width = dimension.width;
        canvas.height = dimension.height;
        const context = canvas.getContext("2d");
        if (!context) throw new ImageResizerError("The browser could not create the canvas needed to resize this image. Reset the tool and try again. If the problem repeats, try another current browser.");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, dimension.width, dimension.height);
        const encodingError = `The browser could not encode the resized image as ${IMAGE_RESIZER_ENCODING[format].label}. Reset the tool and try again. If the problem repeats, try another current browser.`;
        const blob = await new Promise<Blob | null>(resolve => {
            if (format === "png") canvas!.toBlob(resolve, IMAGE_RESIZER_ENCODING[format].mime);
            else canvas!.toBlob(resolve, IMAGE_RESIZER_ENCODING[format].mime, 0.92);
        }).catch(() => { throw new ImageResizerError(encodingError); });
        if (!blob || blob.size === 0 || blob.type !== IMAGE_RESIZER_ENCODING[format].mime) {
            throw new ImageResizerError(encodingError);
        }
        return blob;
    } finally {
        bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}
