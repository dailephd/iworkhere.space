export const MAX_SINGLE_PDF_BYTES: number = 10 * 1024 * 1024;
export const MAX_PDF_PAGES: number = 100;
export const MAX_INPUT_PDFS: number = 10;
export const MAX_AGGREGATE_PDF_BYTES: number = 25 * 1024 * 1024;
export const MAX_AGGREGATE_PAGES: number = 100;
export const MAX_IMAGES: number = 20;
export const MAX_AGGREGATE_IMAGE_BYTES: number = 25 * 1024 * 1024;
export const MAX_OUTPUT_IMAGES_PER_OPERATION: number = 20;
export const MAX_SPLIT_OUTPUT_GROUPS: number = 20;
export const MAX_RENDER_SIDE: number = 4096;
export const MAX_RENDER_AREA: number = 16_000_000;
export const PDF_HEADER_BYTES: number = 1024;

export type PdfFileFailure = "empty" | "source-limit" | "signature" | "encrypted" | "malformed" |
    "page-limit" | "geometry" | "render-limit" | "runtime";
export interface PdfPageGeometry { width: number; height: number; rotation: number }
export interface PdfInspection { pageCount: number; page: PdfPageGeometry[] }

const MESSAGE: Record<PdfFileFailure, string> = {
    empty: "This PDF is empty. Choose a non-empty PDF.",
    "source-limit": "This PDF exceeds the 10 MiB source limit. Choose a smaller PDF.",
    signature: "This file does not contain a supported PDF header. Choose a PDF file.",
    encrypted: "Encrypted or password-protected PDFs are unsupported. Choose an unprotected PDF.",
    malformed: "The PDF could not be parsed safely. Choose another PDF or export it again from its source application.",
    "page-limit": "This PDF exceeds the 100-page limit. Choose a PDF with fewer pages.",
    geometry: "The PDF reported invalid page geometry. Choose another PDF.",
    "render-limit": "The requested raster exceeds the supported page or image bounds. Select a valid page or use a lower rendering scale.",
    runtime: "PDF inspection could not complete. Reload and try again in a current browser.",
};
export class PdfFileError extends Error {
    constructor(public readonly category: PdfFileFailure) { super(MESSAGE[category]); this.name = "PdfFileError"; }
}
export function validatePdfSize(size: number): PdfFileFailure | null {
    if (!Number.isSafeInteger(size) || size <= 0) return "empty";
    return size > MAX_SINGLE_PDF_BYTES ? "source-limit" : null;
}
export function hasPdfHeader(bytes: Uint8Array): boolean {
    const header = String.fromCharCode(...bytes.subarray(0, PDF_HEADER_BYTES));
    return /%PDF-(?:1\.[0-7]|2\.0)(?=[\x00\x09\x0a\x0c\x0d\x20])/.test(header);
}
export function validatePdfBytes(bytes: Uint8Array): PdfFileFailure | null {
    return validatePdfSize(bytes.byteLength) ?? (hasPdfHeader(bytes) ? null : "signature");
}
export function validatePdfPageCount(count: number): PdfFileFailure | null {
    if (!Number.isSafeInteger(count) || count <= 0) return "malformed";
    return count > MAX_PDF_PAGES ? "page-limit" : null;
}
export function validatePdfGeometry(page: PdfPageGeometry): PdfFileFailure | null {
    if (!Number.isFinite(page.width) || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0 ||
        !Number.isInteger(page.rotation) || page.rotation < 0 || page.rotation >= 360 || page.rotation % 90 !== 0) return "geometry";
    return null;
}
export function validatePdfRender(width: number, height: number): PdfFileFailure | null {
    if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
        width > MAX_RENDER_SIDE || height > MAX_RENDER_SIDE || width * height > MAX_RENDER_AREA) return "render-limit";
    return null;
}
export function classifyPdfFailure(error: unknown): PdfFileFailure {
    if (error instanceof PdfFileError) return error.category;
    const name = error && typeof error === "object" && "name" in error ? error.name : "";
    if (name === "PasswordException") return "encrypted";
    if (name === "InvalidPDFException" || name === "FormatError") return "malformed";
    return "runtime";
}
export function pdfFileBasename(name: string): string {
    const leaf = name.split(/[\\/]/).at(-1) ?? "";
    const clean = leaf.replace(/[\x00-\x1f\x7f]/g, "");
    const dot = clean.lastIndexOf(".");
    return (dot > 0 ? clean.slice(0, dot) : clean).trim().slice(0, 120) || "document";
}
export function formatPdfBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
