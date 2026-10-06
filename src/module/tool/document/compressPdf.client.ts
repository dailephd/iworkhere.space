import { startCompressPdfOperation } from "./qpdf.client";
import { verifyCompressedPdf } from "./compressPdfVerification.client";
import { PdfFileError } from "./pdfFile";
import { QpdfProcessingError } from "./qpdf.client";

export interface CompressPdfSmaller { status: "smaller"; bytes: Uint8Array; savedBytes: number; percentage: number }
export interface CompressPdfNoReduction { status: "no-reduction" }
export type CompressPdfOutcome = CompressPdfSmaller | CompressPdfNoReduction;
export class CompressPdfVerificationError extends Error {
    constructor() { super("PDF output verification could not complete."); this.name = "CompressPdfVerificationError"; }
}
export async function compressPdf(bytes: Uint8Array, signal: AbortSignal): Promise<CompressPdfOutcome> {
    signal.throwIfAborted();
    const operation = startCompressPdfOperation(bytes);
    const cancel = () => operation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
        const candidate = await operation.promise;
        signal.throwIfAborted();
        if (candidate.length >= bytes.length) return { status: "no-reduction" };
        try { await verifyCompressedPdf(bytes, candidate, signal); }
        catch { signal.throwIfAborted(); throw new CompressPdfVerificationError(); }
        signal.throwIfAborted();
        const savedBytes = bytes.length - candidate.length;
        return { status: "smaller", bytes: candidate, savedBytes, percentage: savedBytes / bytes.length * 100 };
    } finally { signal.removeEventListener("abort", cancel); }
}
export function compressPdfErrorMessage(error: unknown): string {
    if (error instanceof PdfFileError) return error.message;
    if (error instanceof CompressPdfVerificationError) return "The smaller PDF could not pass independent page verification. No download was created. Keep the original or export another PDF from its source application.";
    if (error instanceof QpdfProcessingError) {
        if (error.category === "encrypted") return "Encrypted or password-protected PDFs are unsupported. Choose an unprotected PDF.";
        if (error.category === "timeout") return "PDF compression exceeded the processing time limit. Try a smaller PDF.";
        if (error.category === "initialization") return "PDF compression could not initialize. Reload and try again in a current browser.";
    }
    return "PDF structural compression could not complete safely. No download was created. Keep the original or export another PDF from its source application.";
}
