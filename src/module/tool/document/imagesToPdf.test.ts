import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { readPdfLibRequest, type PdfLibRequest, type PdfLibResponse } from "./pdfLib.workerType";
import { startImagesToPdfOperation } from "./pdfLib.client";
import { imagesToPdfAdditionError, type ImagesToPdfSource } from "./imagesToPdf";
import { MAX_AGGREGATE_IMAGE_BYTES } from "./pdfFile";
import { inspectImagePdf } from "../../../../test/imagesToPdfVerification";
const jpeg: ImagesToPdfSource = { bytes: new Uint8Array([255, 216, 1]), format: "jpeg", width: 80, height: 60 };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("validates image protocol signatures, geometry, count and byte bounds", () => {
    const request = (image: unknown[]) => ({ id: 1, operation: "images-to-pdf", image });
    expect(readPdfLibRequest(request([jpeg]))).not.toBeNull();
    expect(readPdfLibRequest(request(Array(20).fill(jpeg)))).not.toBeNull();
    for (const image of [[], Array(21).fill(jpeg), [{ ...jpeg, bytes: [] }], [{ ...jpeg, bytes: new Uint8Array() }], [{ ...jpeg, format: "png" }], [{ ...jpeg, format: "webp" }], [{ ...jpeg, width: 0 }], [{ ...jpeg, width: 6000, height: 6000 }]]) expect(readPdfLibRequest(request(image))).toBeNull();
    const large = new Uint8Array(MAX_AGGREGATE_IMAGE_BYTES); large.set([255, 216]);
    expect(readPdfLibRequest(request([{ ...jpeg, bytes: large }]))).not.toBeNull();
    expect(readPdfLibRequest(request([{ ...jpeg, bytes: large }, jpeg]))).toBeNull();
    expect(imagesToPdfAdditionError([], Array(20).fill({ size: 1 }))).toBeNull();
    expect(imagesToPdfAdditionError([{ size: 1 }], Array(20).fill({ size: 1 }))).toContain("20 images");
    expect(imagesToPdfAdditionError([], [{ size: MAX_AGGREGATE_IMAGE_BYTES }])).toBeNull();
    expect(imagesToPdfAdditionError([{ size: MAX_AGGREGATE_IMAGE_BYTES }], [{ size: 1 }])).toContain("25 MiB");
});
class Probe {
    static current: Probe;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminate = vi.fn(); request!: PdfLibRequest; transfer!: Transferable[];
    constructor() { Probe.current = this; }
    postMessage(request: PdfLibRequest, transfer: Transferable[]) { this.request = request; this.transfer = transfer; }
}
it("copies/transfers image bytes and repeats with independent terminated workers", async () => {
    vi.stubGlobal("Worker", Probe);
    for (let index = 0; index < 2; index++) {
        const operation = startImagesToPdfOperation([jpeg]), worker = Probe.current;
        if (worker.request.operation !== "images-to-pdf") throw new Error("Wrong operation");
        expect(worker.request.image[0].bytes).not.toBe(jpeg.bytes); expect(worker.transfer).toEqual([worker.request.image[0].bytes.buffer]);
        worker.onmessage!({ data: { id: worker.request.id, status: "success", bytes: jpeg.bytes } } as MessageEvent);
        await expect(operation.promise).resolves.toEqual(jpeg.bytes); expect(worker.terminate).toHaveBeenCalledOnce();
    }
    expect(jpeg.bytes.length).toBe(3);
});
it.each(["cancel", "timeout", "worker", "protocol", "error", "message"])("terminates image operation on %s", async kind => {
    vi.stubGlobal("Worker", Probe); vi.useFakeTimers();
    const operation = startImagesToPdfOperation([jpeg], 20), worker = Probe.current;
    const rejected = expect(operation.promise).rejects.toThrow();
    if (kind === "cancel") operation.cancel();
    else if (kind === "timeout") await vi.advanceTimersByTimeAsync(20);
    else if (kind === "worker") worker.onerror!({ preventDefault() {} } as ErrorEvent);
    else if (kind === "message") worker.onmessageerror!();
    else worker.onmessage!({ data: { id: worker.request.id, status: kind === "error" ? "error" : "success", category: "processing", bytes: [] } } as MessageEvent);
    await rejected; expect(worker.terminate).toHaveBeenCalledOnce();
});
it("real worker outputs independently rendered ordered JPEG/PNG pages, including alpha and 20-image boundary", async () => {
    const fixture = async (name: string, format: "jpeg" | "png", width = 80, height = 60): Promise<ImagesToPdfSource> => ({ bytes: new Uint8Array(await readFile(`test/fixtures/images/${name}`)), format, width, height });
    const first = await fixture("resizer-source.jpg", "jpeg"), second = await fixture("resizer-source.png", "png"), third = await fixture("compressor-source.jpg", "jpeg", 240, 180);
    async function run(image: ImagesToPdfSource[]): Promise<PdfLibResponse> {
        vi.resetModules(); let reply!: PdfLibResponse;
        const scope = { onmessage: null as ((event: MessageEvent) => Promise<void>) | null, postMessage(value: PdfLibResponse, transfer: Transferable[] = []) { reply = value; if (value.status === "success" && "bytes" in value) expect(transfer).toEqual([value.bytes.buffer]); } };
        vi.stubGlobal("self", scope); await import("./pdfLib.worker"); await scope.onmessage!({ data: { id: 1, operation: "images-to-pdf", image } } as MessageEvent); return reply;
    }
    const single = await run([first]); if (single.status !== "success" || !("bytes" in single)) throw new Error("Worker failed");
    const reference = (await inspectImagePdf(single.bytes))[0];
    const mixed = await run([first, second, third]); if (mixed.status !== "success" || !("bytes" in mixed)) throw new Error("Worker failed");
    const page = await inspectImagePdf(mixed.bytes);
    expect(page.map(({ width, height, rotation }) => ({ width, height, rotation }))).toEqual([{ width: 80, height: 60, rotation: 0 }, { width: 80, height: 60, rotation: 0 }, { width: 240, height: 180, rotation: 0 }]);
    expect(page[0]).toEqual(reference); expect(page[0].pixel[0]).toEqual([255, 255, 255, 255]);
    expect(page[1].pixel).toEqual([[18, 171, 52, 255], [91, 75, 216, 255], [8, 145, 178, 255]]);
    expect(page[2].pixel).not.toEqual(page[0].pixel);
    const boundary = await run(Array(20).fill(second)); if (boundary.status !== "success" || !("bytes" in boundary)) throw new Error("Worker failed");
    expect(await inspectImagePdf(boundary.bytes)).toHaveLength(20);
    expect((await run([{ ...first, width: 81 }])).status).toBe("error");
    expect((await run([jpeg])).status).toBe("error");
});
