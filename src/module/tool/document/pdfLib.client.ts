import { validatePdfBytes, PdfFileError } from "./pdfFile";
import { readPdfLibResponse, type PdfLibFailure } from "./pdfLib.workerType";
export interface PdfLibOperation { promise: Promise<Uint8Array>; cancel(): void }
export class PdfLibProcessingError extends Error {
    constructor(public readonly category: PdfLibFailure) { super("PdfLib processing could not complete."); this.name = "PdfLibProcessingError"; }
}
let nextId = 0;
export function startPdfLibOperation(bytes: Uint8Array, timeoutMs = 30_000): PdfLibOperation {
    const failure = validatePdfBytes(bytes);
    if (failure) throw new PdfFileError(failure);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new PdfLibProcessingError("timeout");
    const id = ++nextId;
    let worker: Worker;
    try { worker = new Worker(new URL("./pdfLib.worker.ts", import.meta.url), { type: "module" }); }
    catch { throw new PdfLibProcessingError("initialization"); }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectOperation: (error: Error) => void = () => {};
    function terminate() {
        settled = true; clearTimeout(timer);
        worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
    }
    const promise = new Promise<Uint8Array>((resolve, reject) => {
        rejectOperation = reject;
        const fail = (category: PdfLibFailure) => { if (settled) return; terminate(); reject(new PdfLibProcessingError(category)); };
        timer = setTimeout(() => fail("timeout"), timeoutMs);
        worker.onmessage = event => {
            if (settled || event.data?.id !== id) return;
            const response = readPdfLibResponse(event.data, id);
            if (!response) { fail("protocol"); return; }
            if (response.status === "error") { fail(response.category); return; }
            terminate(); resolve(response.bytes);
        };
        worker.onerror = event => { event.preventDefault(); fail("processing"); };
        worker.onmessageerror = () => fail("protocol");
        try { const input = bytes.slice(); worker.postMessage({ id, bytes: input }, [input.buffer]); }
        catch { fail("initialization"); }
    });
    return { promise, cancel() { if (settled) return; terminate(); rejectOperation(new DOMException("Operation cancelled", "AbortError")); } };
}
