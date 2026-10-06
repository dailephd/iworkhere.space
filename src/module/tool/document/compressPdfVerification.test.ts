/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { verifyCompressedPdf } from "./compressPdfVerification.client";
const runtime = vi.hoisted(() => ({ open: vi.fn(), render: vi.fn() }));
vi.mock("./pdfRuntime.client", () => ({ openPdfDocument: runtime.open, renderPdfPage: runtime.render }));
const geometry = { width: 320, height: 240, rotation: 90 };
function handle(count = 4, text = "Text", page = geometry) {
    return { inspection: { pageCount: count, page: Array.from({ length: count }, () => page) }, close: vi.fn(), document: { getPage: vi.fn(async () => ({ getTextContent: async () => ({ items: [{ str: text, hasEOL: false }] }), cleanup: vi.fn() })) } };
}
function setup(before = handle(), after = handle()) {
    runtime.open.mockReturnValueOnce({ promise: Promise.resolve(before), cancel: vi.fn() }).mockReturnValueOnce({ promise: Promise.resolve(after), cancel: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }) } as unknown as CanvasRenderingContext2D);
    runtime.render.mockImplementation(async (_handle, _number, canvas: HTMLCanvasElement) => { canvas.width = 160; canvas.height = 120; });
    return { before, after };
}
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
it.each(["Text", ""])("accepts preserved text or textless content, rendering only first/last/middle", async text => {
    const { before, after } = setup(handle(4, text), handle(4, text));
    await verifyCompressedPdf(new Uint8Array([1]), new Uint8Array([2]), new AbortController().signal);
    expect(before.document.getPage).toHaveBeenCalledTimes(4); expect(after.document.getPage).toHaveBeenCalledTimes(4);
    expect(runtime.render.mock.calls.map(call => call[1])).toEqual([1, 1, 4, 4, 2, 2]);
    expect(runtime.render.mock.calls.every(call => call[2].width === 0 && call[2].height === 0)).toBe(true); expect(before.close).toHaveBeenCalledOnce(); expect(after.close).toHaveBeenCalledOnce();
});
it.each([handle(3), handle(4, "Changed"), handle(4, "Text", { ...geometry, width: 321 }), handle(4, "Text", { ...geometry, height: 241 }), handle(4, "Text", { ...geometry, rotation: 0 })])("rejects count, text or geometry changes and closes both documents", async after => {
    const { before } = setup(handle(), after); await expect(verifyCompressedPdf(new Uint8Array([1]), new Uint8Array([2]), new AbortController().signal)).rejects.toThrow("mismatch"); expect(before.close).toHaveBeenCalledOnce(); expect(after.close).toHaveBeenCalledOnce();
});
it("rejects changed visible pixels with no tolerance", async () => {
    const { before, after } = setup(); let read = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getImageData: () => ({ data: new Uint8ClampedArray([++read, 2, 3, 255]) }) } as unknown as CanvasRenderingContext2D);
    await expect(verifyCompressedPdf(new Uint8Array([1]), new Uint8Array([2]), new AbortController().signal)).rejects.toThrow("mismatch"); expect(before.close).toHaveBeenCalledOnce(); expect(after.close).toHaveBeenCalledOnce();
});
it("bounds huge geometry renders and uses no duplicate representative for one page", async () => {
    setup(handle(1, "", { ...geometry, width: 10000 }), handle(1, "", { ...geometry, width: 10000 }));
    await verifyCompressedPdf(new Uint8Array([1]), new Uint8Array([2]), new AbortController().signal); expect(runtime.render).toHaveBeenCalledTimes(2); expect(runtime.render.mock.calls[0][3]).toBe(512 / 10000);
});
it("cancels pending candidate parser and closes original", async () => {
    const before = handle(), controller = new AbortController(); let reject!: (error: Error) => void;
    const cancel = vi.fn(() => reject(new DOMException("Cancelled", "AbortError")));
    runtime.open.mockReturnValueOnce({ promise: Promise.resolve(before), cancel: vi.fn() }).mockReturnValueOnce({ promise: new Promise((_, fail) => { reject = fail; }), cancel });
    const work = verifyCompressedPdf(new Uint8Array([1]), new Uint8Array([2]), controller.signal); await Promise.resolve(); controller.abort(); await expect(work).rejects.toMatchObject({ name: "AbortError" }); expect(cancel).toHaveBeenCalledOnce(); expect(before.close).toHaveBeenCalledOnce();
});
