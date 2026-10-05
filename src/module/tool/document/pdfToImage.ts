import { MAX_OUTPUT_IMAGES_PER_OPERATION, PdfFileError, pdfFileBasename } from "./pdfFile";
export type PdfImageFormat = "png" | "jpeg";
export type PdfImageDpi = 72 | 150 | 300;
export interface PdfToImageOption { format: PdfImageFormat; dpi: PdfImageDpi; quality: number }
export interface PdfToImageOutput { pageNumber: number; format: PdfImageFormat; width: number; height: number; blob: Blob }
export type PdfToImageFailure = "option" | "encoding" | "verification";
export class PdfToImageError extends Error {
    constructor(public readonly category: PdfToImageFailure) { super("PDF page conversion could not complete."); this.name = "PdfToImageError"; }
}
export function validPdfToImageOption(option: PdfToImageOption): boolean {
    return (option.format === "png" || option.format === "jpeg") && [72, 150, 300].includes(option.dpi) &&
        (option.format !== "jpeg" || (Number.isFinite(option.quality) && option.quality >= .5 && option.quality <= 1));
}
export function validPdfToImagePage(page: readonly number[], pageCount: number): boolean {
    return page.length > 0 && page.length <= MAX_OUTPUT_IMAGES_PER_OPERATION && new Set(page).size === page.length &&
        page.every(value => Number.isSafeInteger(value) && value >= 1 && value <= pageCount);
}
export function pdfToImageFilename(name: string, pageNumber: number, format: PdfImageFormat): string {
    const basename = pdfFileBasename(name).replace(/[<>:"|?*]/g, "-");
    return `${basename}-page-${String(pageNumber).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "png"}`;
}
export function pdfToImageErrorMessage(error: unknown): string {
    if (error instanceof PdfFileError) {
        if (error.category === "render-limit") return "At least one selected page exceeds the 4096-pixel side or 16 MP render limit. Select a lower DPI and try again.";
        if (error.category !== "runtime") return error.message;
    }
    if (error instanceof PdfToImageError) {
        if (error.category === "option") return "Choose valid pages, PNG or JPG, a supported DPI and JPEG quality from 0.50 to 1.00.";
        if (error.category === "encoding") return "The browser could not encode all selected pages. No downloads were kept. Try a lower DPI or another current browser.";
        if (error.category === "verification") return "The generated images could not all be verified. No downloads were kept. Try a lower DPI or another output format.";
    }
    return "PDF page conversion could not complete in this browser. Try fewer pages or a lower DPI, or reload and try again.";
}
