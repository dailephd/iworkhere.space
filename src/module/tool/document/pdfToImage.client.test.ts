import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertPdfToImages } from "./pdfToImage.client";
import { PdfFileError } from "./pdfFile";
import type { PdfToImageOption } from "./pdfToImage";
const runtime = vi.hoisted(() => ({ open: vi.fn(), measure: vi.fn(), render: vi.fn(), close: vi.fn(), cancel: vi.fn() }));
vi.mock("./pdfRuntime.client", () => ({ openPdfDocument: runtime.open, measurePdfPage: runtime.measure, renderPdfPage: runtime.render }));
const bytes = new TextEncoder().encode("%PDF-1.7\n");
const option: PdfToImageOption = { format: "png", dpi: 150, quality: .85 };
let canvas: HTMLCanvasElement[], create: ReturnType<typeof vi.fn>, decode: ReturnType<typeof vi.fn>, bitmapClose: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks(); canvas = []; bitmapClose = vi.fn();
    runtime.open.mockImplementation(() => ({ promise: Promise.resolve({ inspection: { pageCount: 100 }, close: runtime.close }), cancel: runtime.cancel }));
    runtime.measure.mockImplementation(async (_handle, page, scale) => ({ width: Math.ceil((page === 2 ? 240 : 320) * scale), height: Math.ceil((page === 2 ? 180 : 240) * scale) }));
    runtime.render.mockImplementation(async (_handle, page, target, scale) => { target.width = Math.ceil((page === 2 ? 240 : 320) * scale); target.height = Math.ceil((page === 2 ? 180 : 240) * scale); });
    create = vi.fn(() => {
        const target = { width: 0, height: 0, toBlob: vi.fn((callback: BlobCallback, mime: string) => callback(new Blob(["encoded"], { type: mime }))) } as unknown as HTMLCanvasElement;
        canvas.push(target); return target;
    });
    decode = vi.fn(async () => ({ width: canvas.at(-1)!.width, height: canvas.at(-1)!.height, close: bitmapClose }));
    vi.stubGlobal("document", { createElement: create }); vi.stubGlobal("createImageBitmap", decode);
});
afterEach(() => vi.unstubAllGlobals());
it.each([72, 150, 300] as const)("opens once, preflights all pages, renders/encodes/verifies sequential PNG at %s DPI", async dpi => {
    const output = await convertPdfToImages(bytes, [3, 1, 2], { ...option, dpi }, new AbortController().signal);
    expect(output.map(value => value.pageNumber)).toEqual([3, 1, 2]); expect(runtime.open).toHaveBeenCalledOnce(); expect(runtime.close).toHaveBeenCalledOnce();
    expect(runtime.measure.mock.invocationCallOrder.at(-1)!).toBeLessThan(create.mock.invocationCallOrder[0]);
    expect(output[2]).toMatchObject({ width: Math.ceil(240 * (dpi / 72)), height: Math.ceil(180 * (dpi / 72)), format: "png" });
    for (const target of canvas) { expect(target.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png"); expect(target.width).toBe(0); expect(target.height).toBe(0); }
    expect(runtime.render.mock.calls.every(call => call[5] === undefined)).toBe(true); expect(bitmapClose).toHaveBeenCalledTimes(3);
    expect(decode.mock.invocationCallOrder[0]).toBeLessThan(runtime.render.mock.invocationCallOrder[1]);
});
it.each([.5, .85, 1])("encodes JPEG quality %s against native white and verifies MIME/dimensions", async quality => {
    const output = await convertPdfToImages(bytes, [1], { format: "jpeg", dpi: 72, quality }, new AbortController().signal);
    expect(runtime.render.mock.calls[0][5]).toBe("#ffffff"); expect(canvas[0].toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", quality); expect(output[0].blob.type).toBe("image/jpeg");
});
it("supports twenty sequential outputs and rejects twenty-one before opening PDF", async () => {
    expect(await convertPdfToImages(bytes, Array.from({ length: 20 }, (_, index) => index + 1), option, new AbortController().signal)).toHaveLength(20);
    runtime.open.mockClear(); await expect(convertPdfToImages(bytes, Array.from({ length: 21 }, (_, index) => index + 1), option, new AbortController().signal)).rejects.toMatchObject({ category: "option" }); expect(runtime.open).not.toHaveBeenCalled();
});
it("rejects any oversized selected page before creating any canvas or result", async () => {
    runtime.measure.mockResolvedValueOnce({ width: 320, height: 240 }).mockRejectedValueOnce(new PdfFileError("render-limit"));
    await expect(convertPdfToImages(bytes, [1, 2], option, new AbortController().signal)).rejects.toMatchObject({ category: "render-limit" }); expect(create).not.toHaveBeenCalled(); expect(runtime.render).not.toHaveBeenCalled(); expect(runtime.close).toHaveBeenCalledOnce();
});
it.each(["null", "throw", "mime", "decode", "dimension"])("discards complete operation and closes resources on %s output failure", async kind => {
    if (kind === "decode") decode.mockRejectedValueOnce(new Error("private"));
    else if (kind === "dimension") decode.mockResolvedValueOnce({ width: 1, height: 1, close: bitmapClose });
    else create.mockImplementationOnce(() => { const target = { width: 0, height: 0, toBlob(callback: BlobCallback) { if (kind === "throw") throw new Error("private"); callback(kind === "null" ? null : new Blob(["wrong"], { type: "image/webp" })); } } as HTMLCanvasElement; canvas.push(target); return target; });
    await expect(convertPdfToImages(bytes, [1, 2], option, new AbortController().signal)).rejects.toMatchObject({ category: kind === "null" || kind === "throw" ? "encoding" : "verification" }); expect(runtime.close).toHaveBeenCalledOnce(); expect(canvas[0].width).toBe(0); if (kind === "dimension") expect(bitmapClose).toHaveBeenCalledOnce();
});
it.each(["encrypted", "malformed"] as const)("preserves bounded %s rejection", async category => {
    runtime.open.mockImplementationOnce(() => ({ promise: Promise.reject(new PdfFileError(category)), cancel: runtime.cancel }));
    await expect(convertPdfToImages(bytes, [1], option, new AbortController().signal)).rejects.toMatchObject({ category }); expect(create).not.toHaveBeenCalled();
});
it("cancels PDF loading through the existing operation owner", async () => {
    let reject!: (value: unknown) => void; runtime.cancel.mockImplementationOnce(() => reject(new DOMException("Cancelled", "AbortError")));
    runtime.open.mockReturnValueOnce({ promise: new Promise((_, fail) => { reject = fail; }), cancel: runtime.cancel });
    const abort = new AbortController(), work = convertPdfToImages(bytes, [1], option, abort.signal); abort.abort();
    await expect(work).rejects.toMatchObject({ name: "AbortError" }); expect(runtime.cancel).toHaveBeenCalledOnce(); expect(create).not.toHaveBeenCalled();
});
it("ignores stale encoding, releases canvas/document, and creates no verified output", async () => {
    let done!: BlobCallback; create.mockImplementationOnce(() => { const target = { width: 0, height: 0, toBlob(callback: BlobCallback) { done = callback; } } as HTMLCanvasElement; canvas.push(target); return target; });
    const abort = new AbortController(), work = convertPdfToImages(bytes, [1], option, abort.signal);
    for (let index = 0; index < 10 && !done; index++) await Promise.resolve();
    abort.abort(); done(new Blob(["encoded"], { type: "image/png" }));
    await expect(work).rejects.toMatchObject({ name: "AbortError" }); expect(decode).not.toHaveBeenCalled(); expect(canvas[0].width).toBe(0); expect(runtime.close).toHaveBeenCalledOnce();
});
