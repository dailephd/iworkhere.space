import { PDF_HEADER_BYTES, PdfFileError, classifyPdfFailure, validatePdfBytes, validatePdfSize, type PdfInspection } from "./pdfFile";
import { openPdfDocument } from "./pdfRuntime.client";

export interface PdfFileInspection { bytes: Uint8Array; inspection: PdfInspection }
export async function inspectPdfFile(file: File, signal?: AbortSignal): Promise<PdfFileInspection> {
    try { return await readAndInspectPdfFile(file, signal); }
    catch (error) {
        const name = error && typeof error === "object" && "name" in error ? error.name : "";
        if (signal?.aborted || name === "AbortError") throw new DOMException("Operation cancelled", "AbortError");
        throw new PdfFileError(classifyPdfFailure(error));
    }
}
async function readAndInspectPdfFile(file: File, signal?: AbortSignal): Promise<PdfFileInspection> {
    const failure = validatePdfSize(file.size);
    if (failure) throw new PdfFileError(failure);
    signal?.throwIfAborted();
    const header = new Uint8Array(await file.slice(0, PDF_HEADER_BYTES).arrayBuffer());
    if (validatePdfBytes(header)) throw new PdfFileError("signature");
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal?.throwIfAborted();
    const byteFailure = validatePdfBytes(bytes);
    if (byteFailure) throw new PdfFileError(byteFailure);
    const operation = openPdfDocument(bytes);
    const cancel = () => operation.cancel();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
        const handle = await operation.promise;
        try { signal?.throwIfAborted(); return { bytes, inspection: handle.inspection }; }
        finally { await handle.close(); }
    } finally { signal?.removeEventListener("abort", cancel); }
}
