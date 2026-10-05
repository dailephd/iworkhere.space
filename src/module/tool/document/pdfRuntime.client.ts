import type { PDFDocumentProxy } from "pdfjs-dist";
import { MAX_AGGREGATE_PDF_BYTES, hasPdfHeader, PdfFileError, classifyPdfFailure, validatePdfBytes, validatePdfGeometry, validatePdfPageCount, validatePdfRender, type PdfInspection } from "./pdfFile";

export const PDFJS_ASSET_ROOT = "/vendor/pdfjs/6.4.299/";
export interface PdfDocumentOperation { promise: Promise<PdfDocumentHandle>; cancel(): void }
export interface PdfDocumentHandle { document: PDFDocumentProxy; inspection: PdfInspection; close(): Promise<void> }
let engine: Promise<typeof import("pdfjs-dist")> | undefined;
async function acquireEngine() {
    engine ??= import("pdfjs-dist").catch(error => { engine = undefined; throw error; });
    const pdfjs = await engine;
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSET_ROOT}pdf.worker.mjs`;
    return pdfjs;
}

export function openPdfDocument(bytes: Uint8Array, purpose: "source" | "generated-output" = "source"): PdfDocumentOperation {
    const failure = purpose === "source" ? validatePdfBytes(bytes) :
        bytes.length === 0 || bytes.length > MAX_AGGREGATE_PDF_BYTES || !hasPdfHeader(bytes) ? "malformed" : null;
    if (failure) throw new PdfFileError(failure);
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    let rejectCancellation: (error: Error) => void = () => {};
    const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
    const work = (async (): Promise<PdfDocumentHandle> => {
        try {
            const pdfjs = await acquireEngine();
            if (cancelled) throw new DOMException("Operation cancelled", "AbortError");
            // Own a copy: PDF.js transfers its data into its native worker.
            task = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0, stopAtErrors: true,
                enableXfa: false, useSystemFonts: false, standardFontDataUrl: `${PDFJS_ASSET_ROOT}standard_fonts/`,
                useWasm: false });
            const document = await task.promise;
            if (await document.getPermissions() !== null) throw new PdfFileError("encrypted");
            const pageFailure = validatePdfPageCount(document.numPages);
            if (pageFailure) throw new PdfFileError(pageFailure);
            const inspection: PdfInspection = { pageCount: document.numPages, page: [] };
            for (let index = 1; index <= document.numPages; index++) {
                if (cancelled) throw new DOMException("Operation cancelled", "AbortError");
                const page = await document.getPage(index);
                const viewport = page.getViewport({ scale: 1, rotation: 0 });
                const geometry = { width: viewport.width, height: viewport.height, rotation: ((page.rotate % 360) + 360) % 360 };
                if (validatePdfGeometry(geometry)) throw new PdfFileError("geometry");
                inspection.page.push(geometry);
                page.cleanup();
            }
            let closed = false;
            return { document, inspection, async close() { if (closed) return; closed = true; await task?.destroy(); } };
        } catch (error) {
            await task?.destroy();
            if (cancelled) throw new DOMException("Operation cancelled", "AbortError");
            throw new PdfFileError(classifyPdfFailure(error));
        }
    })();
    return { promise: Promise.race([work, cancellation]), cancel() {
        if (cancelled) return;
        cancelled = true;
        void task?.destroy();
        rejectCancellation(new DOMException("Operation cancelled", "AbortError"));
    } };
}

export async function renderPdfPage(handle: PdfDocumentHandle, pageNumber: number, canvas: HTMLCanvasElement, scale = 1, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > handle.inspection.pageCount || !Number.isFinite(scale) || scale <= 0) throw new PdfFileError("render-limit");
    let page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | undefined;
    try {
        page = await handle.document.getPage(pageNumber);
        signal?.throwIfAborted();
        const viewport = page.getViewport({ scale });
        const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
        if (validatePdfRender(width, height)) throw new PdfFileError("render-limit");
        canvas.width = width; canvas.height = height;
        const task = page.render({ canvas, viewport });
        const cancel = () => task.cancel();
        signal?.addEventListener("abort", cancel, { once: true });
        try { await task.promise; }
        finally { signal?.removeEventListener("abort", cancel); }
    } catch (error) {
        const name = error && typeof error === "object" && "name" in error ? error.name : "";
        if (signal?.aborted || name === "RenderingCancelledException" || name === "AbortError") throw new DOMException("Operation cancelled", "AbortError");
        throw new PdfFileError(classifyPdfFailure(error));
    }
    finally { page?.cleanup(); }
}
