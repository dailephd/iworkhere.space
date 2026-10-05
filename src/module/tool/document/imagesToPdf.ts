import { MAX_IMAGES, MAX_AGGREGATE_IMAGE_BYTES } from "./pdfFile";
import type { ImageFileDimension } from "../image/imageFile";
export interface ImagesToPdfSource extends ImageFileDimension { bytes: Uint8Array; format: "jpeg" | "png" }
export function imagesToPdfAdditionError(current: readonly { size: number }[], addition: readonly { size: number }[]): string | null {
    if (current.length + addition.length > MAX_IMAGES) return "Choose at most 20 images. This selection batch was not added.";
    if ([...current, ...addition].reduce((total, file) => total + file.size, 0) > MAX_AGGREGATE_IMAGE_BYTES) return "Images together must be at most 25 MiB. This selection batch was not added.";
    return null;
}
