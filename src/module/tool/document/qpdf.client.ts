import { validatePdfBytes, PdfFileError } from "./pdfFile";
import { readQpdfResponse, type QpdfFailure, type QpdfOperationKind } from "./qpdf.workerType";
import { openPdfDocument } from "./pdfRuntime.client";
export interface QpdfOperation { promise: Promise<Uint8Array>; cancel(): void }
export class QpdfProcessingError extends Error {
    constructor(public readonly category: QpdfFailure) { super("Qpdf processing could not complete."); this.name = "QpdfProcessingError"; }
}
let nextId = 0;
export function startQpdfOperation(bytes: Uint8Array, timeoutMs = 30_000): QpdfOperation {
    return startValidatedQpdfOperation(bytes, "rewrite", timeoutMs);
}
export function startCompressPdfOperation(bytes: Uint8Array, timeoutMs = 30_000): QpdfOperation {
    return startValidatedQpdfOperation(bytes, "compress", timeoutMs);
}
function startValidatedQpdfOperation(bytes: Uint8Array, kind: QpdfOperationKind, timeoutMs: number): QpdfOperation {
    const failure = validatePdfBytes(bytes);
    if (failure) throw new PdfFileError(failure);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new QpdfProcessingError("timeout");
    const inspection = openPdfDocument(bytes);
    let operation: QpdfOperation | undefined;
    let cancelled = false;
    const promise = (async () => {
        const handle = await inspection.promise;
        await handle.close();
        if (cancelled) throw new DOMException("Operation cancelled", "AbortError");
        operation = startQpdfWorker(bytes, kind, timeoutMs);
        return await operation.promise;
    })();
    return { promise, cancel() { if (cancelled) return; cancelled = true; inspection.cancel(); operation?.cancel(); } };
}
function startQpdfWorker(bytes: Uint8Array, kind: QpdfOperationKind, timeoutMs: number): QpdfOperation {
    const id = ++nextId;
    let worker: Worker;
    try { worker = new Worker(new URL("./qpdf.worker.ts", import.meta.url), { type: "module" }); }
    catch { throw new QpdfProcessingError("initialization"); }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectOperation: (error: Error) => void = () => {};
    function terminate() {
        settled = true; clearTimeout(timer);
        worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
    }
    const promise = new Promise<Uint8Array>((resolve, reject) => {
        rejectOperation = reject;
        const fail = (category: QpdfFailure) => { if (settled) return; terminate(); reject(new QpdfProcessingError(category)); };
        timer = setTimeout(() => fail("timeout"), timeoutMs);
        worker.onmessage = event => {
            if (settled || event.data?.id !== id) return;
            const response = readQpdfResponse(event.data, id);
            if (!response) { fail("protocol"); return; }
            if (response.status === "error") { fail(response.category); return; }
            terminate(); resolve(response.bytes);
        };
        worker.onerror = event => { event.preventDefault(); fail("processing"); };
        worker.onmessageerror = () => fail("protocol");
        try { const input = bytes.slice(); worker.postMessage({ id, operation: kind, bytes: input }, [input.buffer]); }
        catch { fail("initialization"); }
    });
    return { promise, cancel() { if (settled) return; terminate(); rejectOperation(new DOMException("Operation cancelled", "AbortError")); } };
}
