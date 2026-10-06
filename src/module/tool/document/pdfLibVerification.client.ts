import type { PdfPageGeometry } from "./pdfFile";
import { openPdfDocument } from "./pdfRuntime.client";

/** Independent verification of page-copy outputs; no producing parser is used. */
export async function verifyPdfLibOutput(bytes: Uint8Array, expected: readonly PdfPageGeometry[], signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const operation = openPdfDocument(bytes, "generated-output");
    const cancel = () => operation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
        const handle = await operation.promise;
        try {
            signal.throwIfAborted();
            const actual = handle.inspection;
            if (actual.pageCount !== expected.length || actual.page.some((page, index) => {
                const source = expected[index];
                return !source || Math.abs(page.width - source.width) > 0.001 || Math.abs(page.height - source.height) > 0.001 || page.rotation !== source.rotation;
            })) throw new Error("PDF output verification failed");
        } finally { await handle.close(); }
    } finally { signal.removeEventListener("abort", cancel); }
}
