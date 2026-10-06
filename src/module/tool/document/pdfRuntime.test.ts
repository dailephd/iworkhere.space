import { afterEach, expect, it, vi } from "vitest";
const engine = vi.hoisted(() => ({ GlobalWorkerOptions: { workerSrc: "" }, getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => engine);
import { openPdfDocument, measurePdfPage, renderPdfPage, type PdfDocumentHandle } from "./pdfRuntime.client";
import { MAX_SINGLE_PDF_BYTES, MAX_AGGREGATE_PDF_BYTES } from "./pdfFile";
const bytes = new TextEncoder().encode("%PDF-1.7\n");
it("allows bounded generated output without weakening source limits", async () => {
    const output = new Uint8Array(MAX_SINGLE_PDF_BYTES + 1); output.set(bytes);
    expect(() => openPdfDocument(output)).toThrow();
    task(); const handle = await openPdfDocument(output, "generated-output").promise; await handle.close();
    expect(() => openPdfDocument(new Uint8Array(MAX_AGGREGATE_PDF_BYTES + 1), "generated-output")).toThrow();
});
function task(option: { permissions?: Set<number>; count?: number; width?: number; failure?: string } = {}) {
    const cleanup = vi.fn();
    const document = { numPages: option.count ?? 1, getPermissions: async () => option.permissions ?? null,
        getPage: async () => ({ rotate: 0, getViewport: () => ({ width: option.width ?? 320, height: 240 }), cleanup }) };
    const destroy = vi.fn(async () => {});
    engine.getDocument.mockReturnValue({ promise: option.failure ? Promise.reject({ name: option.failure, message: "private" }) : Promise.resolve(document), destroy });
    return { destroy, cleanup };
}
afterEach(() => { vi.clearAllMocks(); });
it("owns an input copy, same-origin configuration and idempotent handle cleanup", async () => {
    const owned = task(); const handle = await openPdfDocument(bytes).promise;
    expect(handle.inspection).toEqual({ pageCount: 1, page: [{ width: 320, height: 240, rotation: 0 }] });
    const option = engine.getDocument.mock.calls[0][0]; expect(option.data).not.toBe(bytes);
    expect(option).toMatchObject({ enableXfa: false, verbosity: 0, stopAtErrors: true, useWasm: false });
    expect(engine.GlobalWorkerOptions.workerSrc).toBe("/vendor/pdfjs/6.4.299/pdf.worker.mjs");
    await handle.close(); await handle.close(); expect(owned.destroy).toHaveBeenCalledOnce(); expect(owned.cleanup).toHaveBeenCalledOnce();
});
it.each([[{ permissions: new Set([1]) }, "encrypted"], [{ count: 101 }, "page-limit"], [{ width: 0 }, "geometry"], [{ failure: "PasswordException" }, "encrypted"], [{ failure: "InvalidPDFException" }, "malformed"], [{ failure: "UnexpectedError" }, "runtime"]] as const)("cleans up bounded inspection failure %s", async (option, category) => {
    const owned = task(option); await expect(openPdfDocument(bytes).promise).rejects.toMatchObject({ category }); expect(owned.destroy).toHaveBeenCalledOnce();
});
it("cancels before lazy acquisition starts a parser task", async () => {
    task(); const operation = openPdfDocument(bytes); operation.cancel(); operation.cancel();
    await expect(operation.promise).rejects.toMatchObject({ name: "AbortError" });
    expect(engine.getDocument).not.toHaveBeenCalled();
});
it("cancels native rendering, cleans its page and never reports cancellation as a runtime error", async () => {
    let rejectRender: (error: unknown) => void = () => {};
    const cancel = vi.fn(() => rejectRender({ name: "RenderingCancelledException" }));
    const cleanup = vi.fn();
    const handle = { inspection: { pageCount: 1, page: [] }, document: { getPage: async () => ({ getViewport: () => ({ width: 320, height: 240 }), render: () => ({ promise: new Promise((_, reject) => { rejectRender = reject; }), cancel }), cleanup }) } } as unknown as PdfDocumentHandle;
    const controller = new AbortController();
    const rendering = renderPdfPage(handle, 1, {} as HTMLCanvasElement, 1, controller.signal);
    await Promise.resolve(); controller.abort();
    await expect(rendering).rejects.toMatchObject({ name: "AbortError" }); expect(cancel).toHaveBeenCalledOnce(); expect(cleanup).toHaveBeenCalledOnce();
});
it("bounds page acquisition failures before rendering", async () => {
    const handle = { inspection: { pageCount: 1 }, document: { getPage: async () => { throw new Error("private parser diagnostic"); } } } as unknown as PdfDocumentHandle;
    await expect(renderPdfPage(handle, 1, {} as HTMLCanvasElement)).rejects.toMatchObject({ category: "runtime" });
    await expect(renderPdfPage(handle, 1, {} as HTMLCanvasElement)).rejects.not.toThrow("private parser diagnostic");
});
it.each([[4096, 3906, true], [4097, 1, false], [4000, 4000, true], [4000, 4001, false], [239.1, 179.1, true]])("preflights viewport %s x %s without allocating a canvas", async (width, height, valid) => {
    const cleanup = vi.fn(), viewport = vi.fn(() => ({ width, height })), render = vi.fn();
    const handle = { inspection: { pageCount: 1 }, document: { getPage: async () => ({ getViewport: viewport, render, cleanup }) } } as unknown as PdfDocumentHandle;
    if (valid) await expect(measurePdfPage(handle, 1, 150 / 72)).resolves.toEqual({ width: Math.ceil(width), height: Math.ceil(height) });
    else await expect(measurePdfPage(handle, 1)).rejects.toMatchObject({ category: "render-limit" });
    expect(viewport).toHaveBeenCalledWith({ scale: valid ? 150 / 72 : 1 }); expect(render).not.toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledOnce();
});
it("honors native rotated viewport, background options and pre-allocation rejection", async () => {
    const viewport = vi.fn(({ scale }) => ({ width: 240 * scale, height: 320 * scale })), cleanup = vi.fn(), render = vi.fn((option: unknown) => {
        expect(option).toHaveProperty("viewport");
        return { promise: Promise.resolve(), cancel: vi.fn() };
    });
    const handle = { inspection: { pageCount: 1 }, document: { getPage: async () => ({ rotate: 90, getViewport: viewport, render, cleanup }) } } as unknown as PdfDocumentHandle;
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    await renderPdfPage(handle, 1, canvas, 150 / 72, undefined, "#ffffff");
    expect(canvas).toMatchObject({ width: 501, height: 667 }); expect(render.mock.calls[0][0]).toMatchObject({ background: "#ffffff" });
    await renderPdfPage(handle, 1, canvas); expect(render.mock.calls[1][0]).not.toHaveProperty("background");
    canvas.width = 0; canvas.height = 0; await expect(renderPdfPage(handle, 1, canvas, 20)).rejects.toMatchObject({ category: "render-limit" }); expect(canvas.width).toBe(0);
});
