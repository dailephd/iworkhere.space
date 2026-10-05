import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { readPdfLibRequest, readPdfLibResponse, type PdfLibRequest, type PdfLibResponse } from "./pdfLib.workerType";
import { startMergePdfOperation, startSplitPdfOperation } from "./pdfLib.client";
import { mergePdfAdditionError, mergePdfFilename, mergePdfPageError } from "./mergePdf";
import { splitPdfFilename } from "./splitPdf";
import { parsePageSelection } from "./pageSelection";
import { MAX_AGGREGATE_PDF_BYTES, MAX_SINGLE_PDF_BYTES } from "./pdfFile";

const bytes = new TextEncoder().encode("%PDF-1.7\nfixture");
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("defends all merge/split message bounds without ordinary array byte payloads", () => {
    const merge = { id: 1, operation: "merge", input: [bytes, bytes] };
    const split = { id: 1, operation: "split", bytes, group: [[3, 1], [1]] };
    expect(readPdfLibRequest(merge)).toEqual(merge); expect(readPdfLibRequest(split)).toEqual(split);
    for (const input of [[], [bytes], Array(11).fill(bytes), [bytes, []], [bytes, new Uint8Array()], Array(3).fill(new Uint8Array(MAX_SINGLE_PDF_BYTES))]) expect(readPdfLibRequest({ ...merge, input })).toBeNull();
    for (const group of [[], [[]], [[0]], [[101]], [[1, 1]], [[1.5]], Array(21).fill([1])]) expect(readPdfLibRequest({ ...split, group })).toBeNull();
    expect(readPdfLibRequest({ ...split, group: Array(20).fill([1]) })).not.toBeNull();
    expect(readPdfLibRequest({ id: 1, operation: "unknown", bytes })).toBeNull();
    expect(readPdfLibResponse({ id: 1, status: "success", output: [bytes, bytes] }, 1, "split", 2)).not.toBeNull();
    for (const output of [[bytes], [bytes, []], [bytes, new Uint8Array(MAX_AGGREGATE_PDF_BYTES + 1)]]) expect(readPdfLibResponse({ id: 1, status: "success", output }, 1, "split", 2)).toBeNull();
});
it("enforces collection limits and deterministic sequence-preserving safe filenames", () => {
    expect(mergePdfAdditionError(Array(9).fill({ size: 1 }), [{ size: 1 }])).toBeNull();
    expect(mergePdfAdditionError(Array(10).fill({ size: 1 }), [{ size: 1 }])).toContain("10 PDFs");
    expect(mergePdfAdditionError([{ size: MAX_AGGREGATE_PDF_BYTES }], [{ size: 1 }])).toContain("25 MiB");
    expect(mergePdfPageError([50, 50])).toBeNull(); expect(mergePdfPageError([50, 51])).toContain("100 pages");
    expect(mergePdfFilename("../one.pdf")).toBe("one-merged.pdf");
    expect(splitPdfFilename("../source.pdf", 1, [1, 2, 3, 5])).toBe("source-split-01-pages-1-3_5.pdf");
    expect(splitPdfFilename("a:?.pdf", 2, [3, 1])).toBe("a---split-02-pages-3_1.pdf");
    const selection = parsePageSelection("3,1,3,2", { pageCount: 3, maxOutputCount: 100 });
    expect(selection).toEqual({ ok: true, page: [3, 1, 2] });
    const long = Array.from({ length: 100 }, (_, index) => 100 - index);
    const name = splitPdfFilename("x".repeat(120) + ".pdf", 20, long);
    expect(name.length).toBeLessThan(255); expect(name).toContain("seq-");
    const code = name.split("seq-")[1].slice(0, -4);
    expect(code.match(/../g)?.map(value => parseInt(value, 36))).toEqual(long);
});

class WorkerProbe {
    static current: WorkerProbe;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminate = vi.fn();
    request!: PdfLibRequest;
    transfer!: Transferable[];
    constructor() { WorkerProbe.current = this; }
    postMessage(request: PdfLibRequest, transfer: Transferable[]) { this.request = request; this.transfer = transfer; }
}
describe.each(["merge", "split"] as const)("%s client lifecycle", kind => {
    function begin(timeout = 30000) {
        vi.stubGlobal("Worker", WorkerProbe);
        return kind === "merge" ? startMergePdfOperation([bytes, bytes], timeout) : startSplitPdfOperation(bytes, [[3, 1], [1]], timeout);
    }
    it("copies/transfers UI bytes, accepts ordered output, repeats independently", async () => {
        for (let index = 0; index < 2; index++) {
            const operation = begin(), worker = WorkerProbe.current;
            const input = worker.request.operation === "merge" ? worker.request.input : [worker.request.bytes];
            expect(input.every(value => value !== bytes)).toBe(true); expect(worker.transfer).toEqual(input.map(value => value.buffer));
            worker.onmessage?.({ data: { id: worker.request.id, status: "success", ...(kind === "merge" ? { bytes } : { output: [bytes, bytes] }) } } as MessageEvent);
            await expect(operation.promise).resolves.toEqual(kind === "merge" ? bytes : [bytes, bytes]);
            expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.onmessage).toBeNull();
        }
        expect(bytes.length).toBeGreaterThan(0);
    });
    it.each(["cancel", "timeout", "protocol", "missing-id", "worker", "error", "message"])("terminates on %s", async failure => {
        vi.useFakeTimers(); const operation = begin(20), worker = WorkerProbe.current;
        const rejected = expect(operation.promise).rejects.toThrow();
        if (failure === "cancel") operation.cancel();
        else if (failure === "timeout") await vi.advanceTimersByTimeAsync(20);
        else if (failure === "worker") worker.onerror?.({ preventDefault() {} } as ErrorEvent);
        else if (failure === "message") worker.onmessageerror?.();
        else if (failure === "missing-id") worker.onmessage?.({ data: { status: "success", bytes } } as MessageEvent);
        else worker.onmessage?.({ data: { id: worker.request.id, status: failure === "error" ? "error" : "success", category: "processing", bytes: [] } } as MessageEvent);
        await rejected; expect(worker.terminate).toHaveBeenCalledOnce();
    });
});

it("real existing worker processes fixtures, rejects invalid source/page bounds and transfers outputs", async () => {
    const fixture = async (name: string) => new Uint8Array(await readFile(`test/fixtures/pdf/${name}.pdf`));
    async function run(request: PdfLibRequest): Promise<PdfLibResponse> {
        vi.resetModules();
        let reply!: PdfLibResponse; let transfer: Transferable[] = [];
        const scope = { onmessage: null as ((event: MessageEvent) => Promise<void>) | null, postMessage(value: PdfLibResponse, output: Transferable[] = []) { reply = value; transfer = output; } };
        vi.stubGlobal("self", scope); await import("./pdfLib.worker");
        await scope.onmessage!({ data: request } as MessageEvent);
        if (reply.status === "success") {
            const output = "output" in reply ? reply.output : [reply.bytes];
            expect(transfer).toEqual(output.map(value => value.buffer));
            for (const bytes of output) expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
        }
        return reply;
    }
    const ordering = await fixture("ordering"), mixed = await fixture("mixed-dimensions");
    expect((await run({ id: 1, operation: "merge", input: [ordering, mixed] })).status).toBe("success");
    expect((await run({ id: 2, operation: "split", bytes: ordering, group: [[3, 1], [1, 2]] })).status).toBe("success");
    for (const name of ["encrypted", "invalid-body", "page-limit"]) expect((await run({ id: 3, operation: "merge", input: [ordering, await fixture(name)] })).status).toBe("error");
    expect((await run({ id: 4, operation: "split", bytes: ordering, group: [[100]] })).status).toBe("error");
    const boundary = await PDFDocument.create();
    for (let index = 0; index < 51; index++) boundary.addPage([320, 240]);
    const many = await boundary.save();
    expect((await run({ id: 5, operation: "merge", input: [many, many] })).status).toBe("error");
});
