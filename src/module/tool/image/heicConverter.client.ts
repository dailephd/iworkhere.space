import { validateImageFileSize } from "./imageFile";
import { HeicProcessingError, readHeicResponse, type HeicWorkerRequest, type HeicWorkerResponse } from "./heicConverter.workerType";

export interface HeicOperation { promise: Promise<HeicWorkerResponse>; cancel(): void }

export function startHeicOperation(request: HeicWorkerRequest): HeicOperation {
    const sizeError = validateImageFileSize(request.file.size);
    if (sizeError) throw new Error(sizeError);
    let worker: Worker;
    try { worker = new Worker(new URL("./heicConverter.worker.ts", import.meta.url), { type: "module" }); }
    catch { throw new HeicProcessingError("worker-start-failed"); }
    let settled = false;
    let rejectOperation: (error: Error) => void = () => {};
    function terminate() {
        settled = true;
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
    }
    const promise = new Promise<HeicWorkerResponse>((resolve, reject) => {
        rejectOperation = reject;
        function fail(error: Error) { if (settled) return; terminate(); reject(error); }
        worker.onmessage = event => {
            if (settled) return;
            // A stale identity never completes the current operation.
            if (event.data?.id !== request.id) return;
            try {
                const response = readHeicResponse(event.data, request);
                if (!response) { fail(new HeicProcessingError("worker-response-invalid")); return; }
                if (response.status === "error") {
                    const dimension = response.sourceWidth !== undefined && response.sourceHeight !== undefined
                        ? { width: response.sourceWidth, height: response.sourceHeight } : undefined;
                    fail(new HeicProcessingError(response.category, dimension, request.operation === "convert" ? request.target : "png", request.operation)); return;
                }
                terminate(); resolve(response);
            } catch { fail(new HeicProcessingError("worker-response-invalid")); }
        };
        worker.onerror = event => { event.preventDefault(); fail(new HeicProcessingError("worker-runtime-failed")); };
        worker.onmessageerror = () => fail(new HeicProcessingError("worker-runtime-failed"));
        try { worker.postMessage(request); } catch { fail(new HeicProcessingError("worker-start-failed")); }
    });
    return { promise, cancel() {
        if (settled) return;
        terminate(); rejectOperation(new DOMException("Operation cancelled", "AbortError"));
    } };
}
