import { MAX_AGGREGATE_PAGES, MAX_AGGREGATE_PDF_BYTES, MAX_INPUT_PDFS, pdfFileBasename } from "./pdfFile";

export interface MergePdfSourceSize { size: number }
export function mergePdfAdditionError(current: readonly MergePdfSourceSize[], addition: readonly MergePdfSourceSize[]): string | null {
    if (current.length + addition.length > MAX_INPUT_PDFS) return "Merge accepts at most 10 PDFs. Remove a file or choose fewer files.";
    if ([...current, ...addition].reduce((sum, file) => sum + file.size, 0) > MAX_AGGREGATE_PDF_BYTES) return "The combined sources exceed 25 MiB. Remove a file or choose smaller PDFs.";
    return null;
}
export function mergePdfPageError(pageCount: readonly number[]): string | null {
    return pageCount.reduce((sum, count) => sum + count, 0) > MAX_AGGREGATE_PAGES ? "The combined sources exceed 100 pages. Remove a file or choose PDFs with fewer pages." : null;
}
export function mergePdfFilename(name: string): string { return `${pdfFileBasename(name).replace(/[<>:"|?*]/g, "-")}-merged.pdf`; }
