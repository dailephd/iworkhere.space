import { afterEach, describe, expect, it, vi } from "vitest";
import { startPdfLibOperation } from "./pdfLib.client";
import { startQpdfOperation, startCompressPdfOperation } from "./qpdf.client";
import { readPdfLibRequest, readPdfLibResponse } from "./pdfLib.workerType";
import { readQpdfRequest, readQpdfResponse } from "./qpdf.workerType";
vi.mock("./pdfRuntime.client", () => ({ openPdfDocument: () => ({ promise: Promise.resolve({ close: async () => {} }), cancel() {} }) }));
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture");
class InstrumentedWorker {
    static created: InstrumentedWorker[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminate = vi.fn();
    request!: { id: number; bytes: Uint8Array };
    transfer?: Transferable[];
    constructor() { InstrumentedWorker.created.push(this); }
    postMessage(request: { id: number; bytes: Uint8Array }, transfer: Transferable[]) { this.request = request; this.transfer = transfer; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); InstrumentedWorker.created = []; });
describe.each([["pdf-lib", startPdfLibOperation], ["QPDF", startQpdfOperation], ["QPDF compression", startCompressPdfOperation]] as const)("%s lifecycle", (_, start) => {
    async function begin(timeout = 30000) { vi.stubGlobal("Worker", InstrumentedWorker); const operation = start(bytes, timeout); await Promise.resolve(); await Promise.resolve(); return { operation, worker: InstrumentedWorker.created.at(-1)! }; }
    it("creates per operation, transfers an owned copy, ignores stale identities and terminates on success", async () => {
        for (let count = 0; count < 2; count++) {
            const { operation, worker } = await begin();
            expect(worker.request.bytes).not.toBe(bytes); expect(worker.transfer).toEqual([worker.request.bytes.buffer]);
            worker.onmessage?.({ data: { id: worker.request.id + 1, status: "success", bytes } } as MessageEvent);
            expect(worker.terminate).not.toHaveBeenCalled();
            worker.onmessage?.({ data: { id: worker.request.id, status: "success", bytes } } as MessageEvent);
            await expect(operation.promise).resolves.toEqual(bytes); expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.onmessage).toBeNull();
            operation.cancel(); expect(worker.terminate).toHaveBeenCalledOnce();
        }
        expect(InstrumentedWorker.created).toHaveLength(2);
    });
    it.each(["error", "protocol", "runtime", "message"])("terminates on %s failure", async kind => {
        const { operation, worker } = await begin();
        const rejected = expect(operation.promise).rejects.toThrow();
        if (kind === "runtime") worker.onerror?.({ preventDefault() {} } as ErrorEvent);
        else if (kind === "message") worker.onmessageerror?.();
        else worker.onmessage?.({ data: { id: worker.request.id, status: kind === "error" ? "error" : "invalid", category: "processing" } } as MessageEvent);
        await rejected; expect(worker.terminate).toHaveBeenCalledOnce();
    });
    it("terminates on timeout and explicit cancellation", async () => {
        vi.useFakeTimers();
        const timed = await begin(20); const rejection = expect(timed.operation.promise).rejects.toMatchObject({ category: "timeout" });
        await vi.advanceTimersByTimeAsync(20); await rejection; expect(timed.worker.terminate).toHaveBeenCalledOnce();
        const cancelled = await begin(); const aborted = expect(cancelled.operation.promise).rejects.toMatchObject({ name: "AbortError" });
        cancelled.operation.cancel(); await aborted; expect(cancelled.worker.terminate).toHaveBeenCalledOnce();
    });
    it("rejects source and worker startup failures before work", async () => {
        expect(() => start(new Uint8Array())).toThrow();
        vi.stubGlobal("Worker", class { constructor() { throw new Error("private diagnostic"); } });
        if (start === startPdfLibOperation) expect(() => start(bytes)).toThrow("processing could not complete");
        else await expect(start(bytes).promise).rejects.toThrow("processing could not complete");
    });
});
it("validates bounded typed worker messages", () => {
    expect(readQpdfRequest({ id: 1, operation: "compress", bytes })).toEqual({ id: 1, operation: "compress", bytes });
    expect(readQpdfRequest({ id: 1, operation: "lossy", bytes })).toBeNull();
    expect(readQpdfRequest({ id: 1, operation: "compress", bytes: new TextEncoder().encode("false PDF") })).toBeNull();
    for (const read of [readPdfLibRequest, readQpdfRequest]) {
        expect(read({ id: 1, bytes })).toEqual({ id: 1, bytes });
        for (const value of [null, {}, { id: 0, bytes }, { id: 1, bytes: [] }, { id: 1, bytes: new Uint8Array() }]) expect(read(value)).toBeNull();
    }
    for (const read of [readPdfLibResponse, readQpdfResponse]) {
        expect(read({ id: 1, status: "success", bytes }, 1)?.status).toBe("success");
        expect(read({ id: 1, status: "error", category: "processing" }, 1)).toEqual({ id: 1, status: "error", category: "processing" });
        for (const value of [null, {}, { id: 2, status: "success", bytes }, { id: 1, status: "error", category: "raw secret" }]) expect(read(value, 1)).toBeNull();
    }
});
