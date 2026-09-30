import { MAX_PIXEL_AREA, IMAGE_FILE_ENCODING as IMAGE_RESIZER_ENCODING, imageFileBasename, validateImageFileDimension,
    type ImageFileDimension as ImageResizerDimension, type ImageFileFormat as ImageResizerFormat } from "./imageFile";

export function validateImageResizerDimension(dimension: ImageResizerDimension, source = false): string | null {
    if (source) return validateImageFileDimension(dimension);
    if (!Number.isFinite(dimension.width) || !Number.isInteger(dimension.width) || dimension.width <= 0) {
        return "Width must be a positive whole number.";
    }
    if (!Number.isFinite(dimension.height) || !Number.isInteger(dimension.height) || dimension.height <= 0) {
        return "Height must be a positive whole number.";
    }
    if (dimension.width * dimension.height > MAX_PIXEL_AREA) {
        return "The resized image must contain 30 megapixels or fewer.";
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
    const basename = imageFileBasename(name);
    return `${basename}-${dimension.width}x${dimension.height}.${IMAGE_RESIZER_ENCODING[format].extension}`;
}
