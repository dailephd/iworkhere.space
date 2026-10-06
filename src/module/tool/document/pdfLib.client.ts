import { validatePdfBytes, PdfFileError } from "./pdfFile";
import type { ImagesToPdfSource } from "./imagesToPdf";
import { readPdfLibRequest, readPdfLibResponse, type PdfLibFailure, type PdfLibRequest } from "./pdfLib.workerType";
export interface PdfLibOperation { promise: Promise<Uint8Array>; cancel(): void }
export interface PdfLibSplitOperation { promise: Promise<Uint8Array[]>; cancel(): void }
export class PdfLibProcessingError extends Error {
    constructor(public readonly category: PdfLibFailure) { super("PdfLib processing could not complete."); this.name = "PdfLibProcessingError"; }
}
let nextId = 0;
export function startImagesToPdfOperation(image: readonly ImagesToPdfSource[], timeoutMs = 30_000): PdfLibOperation {
    const operation = start({ id: ++nextId, operation: "images-to-pdf", image: image.map(value => ({ bytes: value.bytes, format: value.format, width: value.width, height: value.height })) }, timeoutMs);
    return { promise: operation.promise.then(output => output[0]), cancel: operation.cancel };
}
export function startPdfLibOperation(bytes: Uint8Array, timeoutMs = 30_000): PdfLibOperation {
    const failure = validatePdfBytes(bytes);
    if (failure) throw new PdfFileError(failure);
    const operation = start({ id: ++nextId, bytes }, timeoutMs);
    return { promise: operation.promise.then(output => output[0]), cancel: operation.cancel };
}
export function startMergePdfOperation(input: readonly Uint8Array[], timeoutMs = 30_000): PdfLibOperation {
    for (const bytes of input) {
        const failure = validatePdfBytes(bytes);
        if (failure) throw new PdfFileError(failure);
    }
    const operation = start({ id: ++nextId, operation: "merge", input: [...input] }, timeoutMs);
    return { promise: operation.promise.then(output => output[0]), cancel: operation.cancel };
}
export function startSplitPdfOperation(bytes: Uint8Array, group: readonly number[][], timeoutMs = 30_000): PdfLibSplitOperation {
    const failure = validatePdfBytes(bytes);
    if (failure) throw new PdfFileError(failure);
    return start({ id: ++nextId, operation: "split", bytes, group: group.map(page => [...page]) }, timeoutMs);
}
function start(request: PdfLibRequest, timeoutMs: number): PdfLibSplitOperation {
    if (!readPdfLibRequest(request)) throw new PdfLibProcessingError("protocol");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new PdfLibProcessingError("timeout");
    const { id } = request;
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
    const promise = new Promise<Uint8Array[]>((resolve, reject) => {
        rejectOperation = reject;
        const fail = (category: PdfLibFailure) => { if (settled) return; terminate(); reject(new PdfLibProcessingError(category)); };
        timer = setTimeout(() => fail("timeout"), timeoutMs);
        worker.onmessage = event => {
            if (settled) return;
            if (Number.isSafeInteger(event.data?.id) && event.data.id !== id) return;
            const response = readPdfLibResponse(event.data, id, request.operation ?? "foundation", request.operation === "split" ? request.group.length : 0);
            if (!response) { fail("protocol"); return; }
            if (response.status === "error") { fail(response.category); return; }
            terminate(); resolve("output" in response ? response.output : [response.bytes]);
        };
        worker.onerror = event => { event.preventDefault(); fail("processing"); };
        worker.onmessageerror = () => fail("protocol");
        try {
            if (request.operation === "images-to-pdf") {
                const image = request.image.map(value => ({ ...value, bytes: value.bytes.slice() }));
                worker.postMessage({ ...request, image }, image.map(value => value.bytes.buffer));
            } else if (request.operation === "merge") {
                const input = request.input.map(bytes => bytes.slice());
                worker.postMessage({ ...request, input }, input.map(bytes => bytes.buffer));
            } else {
                const bytes = request.bytes.slice();
                worker.postMessage({ ...request, bytes }, [bytes.buffer]);
            }
        }
        catch { fail("initialization"); }
    });
    return { promise, cancel() { if (settled) return; terminate(); rejectOperation(new DOMException("Operation cancelled", "AbortError")); } };
}
