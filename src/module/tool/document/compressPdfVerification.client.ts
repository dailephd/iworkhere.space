import { openPdfDocument, renderPdfPage, type PdfDocumentHandle } from "./pdfRuntime.client";

async function pageText(handle: PdfDocumentHandle, number: number, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const page = await handle.document.getPage(number);
    try {
        const content = await page.getTextContent();
        signal.throwIfAborted();
        return JSON.stringify(content.items.flatMap(item => "str" in item && item.str ? [[item.str, item.hasEOL]] : []));
    } finally { page.cleanup(); }
}
async function raster(handle: PdfDocumentHandle, number: number, scale: number, signal: AbortSignal): Promise<Uint8ClampedArray> {
    const canvas = document.createElement("canvas");
    try {
        await renderPdfPage(handle, number, canvas, scale, signal, "#ffffff");
        signal.throwIfAborted();
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDF verification unavailable");
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
    } finally { canvas.width = 0; canvas.height = 0; }
}

/** Independent static-page verification; QPDF is never used as the verifier. */
export async function verifyCompressedPdf(source: Uint8Array, candidate: Uint8Array, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const original = openPdfDocument(source);
    let output: ReturnType<typeof openPdfDocument> | undefined;
    let before: PdfDocumentHandle | undefined, after: PdfDocumentHandle | undefined;
    const cancel = () => { original.cancel(); output?.cancel(); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
        before = await original.promise;
        signal.throwIfAborted();
        output = openPdfDocument(candidate, "generated-output");
        after = await output.promise;
        signal.throwIfAborted();
        const expected = before.inspection, actual = after.inspection;
        if (actual.pageCount !== expected.pageCount || actual.page.some((page, index) => {
            const reference = expected.page[index];
            return !reference || Math.abs(page.width - reference.width) > 0.001 || Math.abs(page.height - reference.height) > 0.001 || page.rotation !== reference.rotation;
        })) throw new Error("PDF verification mismatch");
        for (let number = 1; number <= expected.pageCount; number++) {
            const text = await pageText(before, number, signal);
            if (text !== await pageText(after, number, signal)) throw new Error("PDF verification mismatch");
        }
        const representative = new Set([1, expected.pageCount]);
        if (expected.pageCount > 2) representative.add(Math.ceil(expected.pageCount / 2));
        for (const number of representative) {
            const geometry = expected.page[number - 1];
            const scale = Math.min(0.5, 512 / Math.max(geometry.width, geometry.height));
            const reference = await raster(before, number, scale, signal);
            const rendered = await raster(after, number, scale, signal);
            if (reference.length !== rendered.length || reference.some((value, index) => value !== rendered[index])) throw new Error("PDF verification mismatch");
        }
    } finally {
        signal.removeEventListener("abort", cancel);
        await before?.close();
        await after?.close();
    }
}
