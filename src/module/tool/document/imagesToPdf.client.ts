import { validateImageFileSize, validateImageFileDimension } from "../image/imageFile";
import { ImageFileError, readImageFileFormat, inspectImageFile } from "../image/imageFile.client";
import type { ImagesToPdfSource } from "./imagesToPdf";

/** Abort pipeline continuation; the inherited inspection owner closes native bitmaps. */
export async function inspectImagesToPdfFile(file: File, signal: AbortSignal): Promise<ImagesToPdfSource> {
    signal.throwIfAborted();
    const failure = validateImageFileSize(file.size);
    if (failure) throw new ImageFileError(failure);
    const format = await readImageFileFormat(file);
    signal.throwIfAborted();
    if (format === "webp") throw new ImageFileError("WebP is unsupported for Images to PDF. Choose JPEG or PNG images.");
    const dimension = await inspectImageFile(file);
    signal.throwIfAborted();
    const dimensionError = validateImageFileDimension(dimension);
    if (dimensionError) throw new ImageFileError(dimensionError);
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    return { bytes, format, ...dimension };
}
