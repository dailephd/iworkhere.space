import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readPdfLibRequest, readPdfLibResponse, type PdfLibRequest, type PdfLibResponse, type PdfPacketSource } from "./pdfLib.workerType";
import { PdfLibProcessingError, startAssemblePdfOperation, startMergePdfOperation, startSplitPdfOperation } from "./pdfLib.client";
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
            const input = worker.request.operation === "merge" ? worker.request.input : worker.request.operation === "images-to-pdf" ? worker.request.image.map(value => value.bytes) : worker.request.operation === "assemble" ? worker.request.sources.map(value => value.bytes) : [worker.request.bytes];
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

/* ---------- assemble operation: ordered, mixed PDF and image pages ---------- */

interface AssembledPage { width: number; height: number; rotation: number; text: string }

async function readAssembledPages(output: Uint8Array): Promise<AssembledPage[]> {
    expect(new TextDecoder().decode(output.subarray(0, 5))).toBe("%PDF-");
    const task = getDocument({ data: new Uint8Array(output), verbosity: 0, stopAtErrors: true, useSystemFonts: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/" });
    const document = await task.promise;
    try {
        const result: AssembledPage[] = [];
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index);
            const viewport = page.getViewport({ scale: 1, rotation: 0 });
            const content = await page.getTextContent();
            result.push({ width: viewport.width, height: viewport.height, rotation: page.rotate, text: content.items.map(value => "str" in value ? value.str : "").join(" ").trim() });
            page.cleanup();
        }
        return result;
    } finally { await task.destroy(); }
}

const pdfFixture = async (name: string) => new Uint8Array(await readFile(`test/fixtures/pdf/${name}.pdf`));
const imageFixture = async (name: string) => new Uint8Array(await readFile(`test/fixtures/images/${name}`));
function pngSize(data: Uint8Array) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
}
function jpegSize(data: Uint8Array) {
    let index = 2;
    while (index + 8 < data.length) {
        if (data[index] !== 0xff) { index += 1; continue; }
        const marker = data[index + 1];
        if (marker >= 0xc0 && marker <= 0xc3) return { height: (data[index + 5] << 8) | data[index + 6], width: (data[index + 7] << 8) | data[index + 8] };
        index += 2 + ((data[index + 2] << 8) | data[index + 3]);
    }
    throw new Error("JPEG fixture has no frame header");
}
function pdfLike(size: number): Uint8Array {
    const data = new Uint8Array(size);
    data.set(new TextEncoder().encode("%PDF-1.7\n"));
    return data;
}

describe("assemble request reader", () => {
    const pdf = pdfLike(32);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const valid = () => ({
        id: 1,
        operation: "assemble",
        sources: [{ id: "s0", kind: "pdf", bytes: pdf }, { id: "s1", kind: "png", bytes: png, width: 4, height: 3 }],
        pageOrder: [{ sourceId: "s1", pageNumber: 1 }, { sourceId: "s0", pageNumber: 2 }, { sourceId: "s0", pageNumber: 2 }],
    });

    it("accepts a repeated reference, an unreferenced source, 64-character ids and 100 pages", () => {
        expect(readPdfLibRequest(valid())).toEqual(valid());
        const longId = "a".repeat(64);
        const long = { ...valid(), sources: [{ id: longId, kind: "pdf", bytes: pdf }], pageOrder: Array.from({ length: 100 }, () => ({ sourceId: longId, pageNumber: 100 })) };
        expect(readPdfLibRequest(long)).not.toBeNull();
        expect(readPdfLibRequest({ ...valid(), sources: [{ id: "A_b-9", kind: "jpeg", bytes: jpeg, width: 1, height: 1 }], pageOrder: [{ sourceId: "A_b-9", pageNumber: 1 }] })).not.toBeNull();
    });

    it.each([
        ["no sources", { sources: [] }],
        ["no pages", { pageOrder: [] }],
        ["101 pages", { pageOrder: Array.from({ length: 101 }, () => ({ sourceId: "s0", pageNumber: 1 })) }],
        ["31 sources", { sources: Array.from({ length: 31 }, (_, index) => ({ id: `x${index}`, kind: "jpeg", bytes: jpeg, width: 1, height: 1 })) }],
        ["a duplicate source id", { sources: [{ id: "s0", kind: "pdf", bytes: pdf }, { id: "s0", kind: "pdf", bytes: pdf }] }],
        ["an empty id", { sources: [{ id: "", kind: "pdf", bytes: pdf }], pageOrder: [{ sourceId: "", pageNumber: 1 }] }],
        ["an id with a space", { sources: [{ id: "my file", kind: "pdf", bytes: pdf }], pageOrder: [{ sourceId: "my file", pageNumber: 1 }] }],
        ["an id longer than 64 characters", { sources: [{ id: "a".repeat(65), kind: "pdf", bytes: pdf }], pageOrder: [{ sourceId: "a".repeat(65), pageNumber: 1 }] }],
        ["a numeric id", { sources: [{ id: 7, kind: "pdf", bytes: pdf }], pageOrder: [{ sourceId: 7, pageNumber: 1 }] }],
        ["an unknown kind", { sources: [{ id: "s0", kind: "docx", bytes: pdf }] }],
        ["bytes that are an ordinary array", { sources: [{ id: "s0", kind: "pdf", bytes: Array.from(pdf) }] }],
        ["empty PDF bytes", { sources: [{ id: "s0", kind: "pdf", bytes: new Uint8Array() }] }],
        ["a PDF without a PDF header", { sources: [{ id: "s0", kind: "pdf", bytes: new TextEncoder().encode("not a pdf at all") }] }],
        ["a PDF over 10 MiB", { sources: [{ id: "s0", kind: "pdf", bytes: pdfLike(MAX_SINGLE_PDF_BYTES + 1) }] }],
        ["an image whose bytes are another format", { sources: [{ id: "s1", kind: "png", bytes: jpeg, width: 4, height: 3 }], pageOrder: [{ sourceId: "s1", pageNumber: 1 }] }],
        ["an image with zero width", { sources: [{ id: "s1", kind: "png", bytes: png, width: 0, height: 3 }], pageOrder: [{ sourceId: "s1", pageNumber: 1 }] }],
        ["an image over 30 megapixels", { sources: [{ id: "s1", kind: "png", bytes: png, width: 6000, height: 5001 }], pageOrder: [{ sourceId: "s1", pageNumber: 1 }] }],
        ["a reference to an unknown source", { pageOrder: [{ sourceId: "missing", pageNumber: 1 }] }],
        ["page 0", { pageOrder: [{ sourceId: "s0", pageNumber: 0 }] }],
        ["a negative page", { pageOrder: [{ sourceId: "s0", pageNumber: -1 }] }],
        ["a fractional page", { pageOrder: [{ sourceId: "s0", pageNumber: 1.5 }] }],
        ["page 101", { pageOrder: [{ sourceId: "s0", pageNumber: 101 }] }],
        ["page 2 of an image", { pageOrder: [{ sourceId: "s1", pageNumber: 2 }] }],
        ["a non-object reference", { pageOrder: [null] }],
        ["11 PDFs", { sources: Array.from({ length: 11 }, (_, index) => ({ id: `p${index}`, kind: "pdf", bytes: pdf })), pageOrder: [{ sourceId: "p0", pageNumber: 1 }] }],
        ["21 images", { sources: Array.from({ length: 21 }, (_, index) => ({ id: `i${index}`, kind: "jpeg", bytes: jpeg, width: 1, height: 1 })), pageOrder: [{ sourceId: "i0", pageNumber: 1 }] }],
        ["sources over 25 MiB in total", { sources: [0, 1, 2].map(index => ({ id: `p${index}`, kind: "pdf", bytes: pdfLike(9 * 1024 * 1024) })), pageOrder: [{ sourceId: "p0", pageNumber: 1 }] }],
    ])("rejects %s", (_label, overrides) => {
        expect(readPdfLibRequest({ ...valid(), ...overrides })).toBeNull();
    });

    it("rejects a missing id and an unknown operation, and never reads filenames from the message", () => {
        expect(readPdfLibRequest({ ...valid(), id: 0 })).toBeNull();
        expect(readPdfLibRequest({ ...valid(), operation: "assemble-all" })).toBeNull();
        const read = readPdfLibRequest({ ...valid(), sources: [{ id: "s0", kind: "pdf", bytes: pdf, name: "private.pdf" }], pageOrder: [{ sourceId: "s0", pageNumber: 1, label: "x" }] });
        expect(JSON.stringify(read, (_key, value) => value instanceof Uint8Array ? value.length : value)).not.toContain("private");
    });

    it("accepts only a bounded non-empty byte response for the assemble operation", () => {
        expect(readPdfLibResponse({ id: 4, status: "success", bytes: pdf }, 4, "assemble")).toEqual({ id: 4, status: "success", bytes: pdf });
        for (const reply of [{ id: 4, status: "success", bytes: new Uint8Array() }, { id: 4, status: "success", bytes: new Uint8Array(MAX_AGGREGATE_PDF_BYTES + 1) }, { id: 4, status: "success", bytes: [1] }, { id: 5, status: "success", bytes: pdf }, { id: 4, status: "success" }]) {
            expect(readPdfLibResponse(reply, 4, "assemble")).toBeNull();
        }
        expect(readPdfLibResponse({ id: 4, status: "error", category: "processing" }, 4, "assemble")).toEqual({ id: 4, status: "error", category: "processing" });
    });
});

describe("assemble client lifecycle", () => {
    const pdf = pdfLike(32);
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const source = (): PdfPacketSource[] => [{ id: "s0", kind: "pdf", bytes: pdf }, { id: "s1", kind: "jpeg", bytes: image, width: 2, height: 2 }];
    const order = [{ sourceId: "s1", pageNumber: 1 }, { sourceId: "s0", pageNumber: 1 }];
    function begin(timeout = 30000) {
        vi.stubGlobal("Worker", WorkerProbe);
        return startAssemblePdfOperation(source(), order, timeout);
    }

    it("copies and transfers every source, keeps the caller's arrays attached and returns the single output", async () => {
        const inputs = source();
        vi.stubGlobal("Worker", WorkerProbe);
        const operation = startAssemblePdfOperation(inputs, order);
        const worker = WorkerProbe.current;
        if (worker.request.operation !== "assemble") throw new Error("expected an assemble request");
        expect(worker.request.pageOrder).toEqual(order);
        expect(worker.request.sources.map(value => value.id)).toEqual(["s0", "s1"]);
        expect(worker.request.sources.every((value, index) => value.bytes !== inputs[index].bytes && value.bytes.length === inputs[index].bytes.length)).toBe(true);
        expect(worker.transfer).toEqual(worker.request.sources.map(value => value.bytes.buffer));
        expect(inputs.every(value => value.bytes.byteLength > 0)).toBe(true);
        worker.onmessage?.({ data: { id: worker.request.id, status: "success", bytes: pdf } } as MessageEvent);
        await expect(operation.promise).resolves.toEqual(pdf);
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(worker.onmessage).toBeNull();
    });

    it("rejects a malformed request synchronously, before any worker exists", () => {
        vi.stubGlobal("Worker", WorkerProbe);
        WorkerProbe.current = undefined as unknown as WorkerProbe;
        expect(() => startAssemblePdfOperation([], order)).toThrow(PdfLibProcessingError);
        expect(() => startAssemblePdfOperation(source(), [{ sourceId: "unknown", pageNumber: 1 }])).toThrow(PdfLibProcessingError);
        expect(WorkerProbe.current).toBeUndefined();
    });

    it.each(["cancel", "timeout", "protocol", "missing-id", "worker", "error", "message"])("terminates on %s", async failure => {
        vi.useFakeTimers();
        const operation = begin(20), worker = WorkerProbe.current;
        const rejected = expect(operation.promise).rejects.toThrow();
        if (failure === "cancel") operation.cancel();
        else if (failure === "timeout") await vi.advanceTimersByTimeAsync(20);
        else if (failure === "worker") worker.onerror?.({ preventDefault() {} } as ErrorEvent);
        else if (failure === "message") worker.onmessageerror?.();
        else if (failure === "missing-id") worker.onmessage?.({ data: { status: "success", bytes: pdf } } as MessageEvent);
        else worker.onmessage?.({ data: { id: worker.request.id, status: failure === "error" ? "error" : "success", category: "processing", bytes: [] } } as MessageEvent);
        await rejected;
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it("ignores a stale response identity and a late response after cancellation", async () => {
        const operation = begin(), worker = WorkerProbe.current;
        worker.onmessage?.({ data: { id: worker.request.id + 1000, status: "success", bytes: pdf } } as MessageEvent);
        expect(worker.terminate).not.toHaveBeenCalled();
        const rejected = expect(operation.promise).rejects.toMatchObject({ name: "AbortError" });
        const late = worker.onmessage;
        operation.cancel();
        await rejected;
        late?.({ data: { id: worker.request.id, status: "success", bytes: pdf } } as MessageEvent);
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
});

describe("real pdf-lib worker: assemble", () => {
    async function post(request: PdfLibRequest): Promise<{ reply: PdfLibResponse; transfer: Transferable[] }> {
        vi.resetModules();
        let reply!: PdfLibResponse;
        let transfer: Transferable[] = [];
        const scope = { onmessage: null as ((event: MessageEvent) => Promise<void>) | null, postMessage(value: PdfLibResponse, output: Transferable[] = []) { reply = value; transfer = output; } };
        vi.stubGlobal("self", scope);
        await import("./pdfLib.worker");
        await scope.onmessage!({ data: request } as MessageEvent);
        return { reply, transfer };
    }

    it("copies pages in the requested order, repeats a page as a fresh page, embeds images and keeps rotation", async () => {
        const ordering = await pdfFixture("ordering"), mixed = await pdfFixture("mixed-dimensions"), rotated = await pdfFixture("rotated");
        const png = await imageFixture("resizer-source.png"), jpeg = await imageFixture("resizer-source.jpg");
        const beforeHash = [ordering, mixed, rotated, png, jpeg].map(value => Array.from(value).reduce((sum, byte, index) => (sum + byte * (index % 251 + 1)) % 1_000_000_007, 0));
        const orderingPages = await readAssembledPages(ordering), mixedPages = await readAssembledPages(mixed), rotatedPages = await readAssembledPages(rotated);
        expect(new Set(orderingPages.map(page => page.text)).size).toBe(orderingPages.length);

        const sources: PdfPacketSource[] = [
            { id: "s0", kind: "pdf", bytes: mixed },
            { id: "s1", kind: "pdf", bytes: ordering },
            { id: "s2", kind: "png", bytes: png, ...pngSize(png) },
            { id: "s3", kind: "pdf", bytes: rotated },
            { id: "s4", kind: "jpeg", bytes: jpeg, ...jpegSize(jpeg) },
        ];
        const pageOrder = [
            { sourceId: "s0", pageNumber: 2 }, { sourceId: "s1", pageNumber: 3 }, { sourceId: "s2", pageNumber: 1 },
            { sourceId: "s1", pageNumber: 1 }, { sourceId: "s1", pageNumber: 3 }, { sourceId: "s3", pageNumber: 1 }, { sourceId: "s4", pageNumber: 1 },
        ];
        const { reply, transfer } = await post({ id: 7, operation: "assemble", sources, pageOrder });
        if (reply.status !== "success" || !("bytes" in reply)) throw new Error("expected an assembled PDF");
        expect(reply.id).toBe(7);
        expect(transfer).toEqual([reply.bytes.buffer]);

        const output = await readAssembledPages(reply.bytes);
        expect(output).toHaveLength(7);
        expect(output[0]).toEqual(mixedPages[1]);
        expect(output[1]).toEqual(orderingPages[2]);
        expect(output[2]).toMatchObject({ ...pngSize(png), rotation: 0, text: "" });
        expect(output[3]).toEqual(orderingPages[0]);
        expect(output[4]).toEqual(orderingPages[2]);
        expect(output[5]).toEqual(rotatedPages[0]);
        expect(output[5].rotation).toBe(90);
        expect(output[6]).toMatchObject({ ...jpegSize(jpeg), rotation: 0 });
        expect(output[1].text).not.toBe(output[3].text);
        const afterHash = [ordering, mixed, rotated, png, jpeg].map(value => Array.from(value).reduce((sum, byte, index) => (sum + byte * (index % 251 + 1)) % 1_000_000_007, 0));
        expect(afterHash).toEqual(beforeHash);
    });

    it("assembles a single image into a one-page PDF at its pixel size", async () => {
        const png = await imageFixture("resizer-source.png");
        const { reply } = await post({ id: 2, operation: "assemble", sources: [{ id: "only", kind: "png", bytes: png, ...pngSize(png) }], pageOrder: [{ sourceId: "only", pageNumber: 1 }] });
        if (reply.status !== "success" || !("bytes" in reply)) throw new Error("expected an assembled PDF");
        expect(await readAssembledPages(reply.bytes)).toEqual([expect.objectContaining({ ...pngSize(png), rotation: 0 })]);
    });

    it("rejects a page beyond the real page count even though the message shape is valid", async () => {
        const ordering = await pdfFixture("ordering");
        const { reply } = await post({ id: 3, operation: "assemble", sources: [{ id: "s0", kind: "pdf", bytes: ordering }], pageOrder: [{ sourceId: "s0", pageNumber: 5 }] });
        expect(reply).toEqual({ id: 3, status: "error", category: "processing" });
    });

    it.each(["encrypted", "page-limit", "truncated"])("fails closed for the %s fixture", async name => {
        const bad = await pdfFixture(name);
        const { reply } = await post({ id: 4, operation: "assemble", sources: [{ id: "s0", kind: "pdf", bytes: bad }], pageOrder: [{ sourceId: "s0", pageNumber: 1 }] });
        expect(reply.status).toBe("error");
    });

    it("answers a protocol error, with the request id, for a malformed assemble message", async () => {
        const ordering = await pdfFixture("ordering");
        const { reply } = await post({ id: 9, operation: "assemble", sources: [{ id: "s0", kind: "pdf", bytes: ordering }], pageOrder: [{ sourceId: "other", pageNumber: 1 }] });
        expect(reply).toEqual({ id: 9, status: "error", category: "protocol" });
    });

    it("rejects an image whose declared size differs from the embedded image", async () => {
        const png = await imageFixture("resizer-source.png");
        const size = pngSize(png);
        const { reply } = await post({ id: 5, operation: "assemble", sources: [{ id: "s0", kind: "png", bytes: png, width: size.width + 1, height: size.height }], pageOrder: [{ sourceId: "s0", pageNumber: 1 }] });
        expect(reply).toEqual({ id: 5, status: "error", category: "processing" });
    });

    it("keeps the existing foundation, merge, split and images-to-pdf operations working beside assemble", async () => {
        const ordering = await pdfFixture("ordering"), mixed = await pdfFixture("mixed-dimensions");
        const png = await imageFixture("resizer-source.png");
        expect((await post({ id: 1, bytes: ordering })).reply.status).toBe("success");
        expect((await post({ id: 2, operation: "merge", input: [ordering, mixed] })).reply.status).toBe("success");
        expect((await post({ id: 3, operation: "split", bytes: ordering, group: [[2, 1]] })).reply.status).toBe("success");
        expect((await post({ id: 4, operation: "images-to-pdf", image: [{ bytes: png, format: "png", ...pngSize(png) }] })).reply.status).toBe("success");
    });
});
