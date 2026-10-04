import { afterEach, expect, it, vi } from "vitest";
const engine = vi.hoisted(() => ({ GlobalWorkerOptions: { workerSrc: "" }, getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => engine);
import { openPdfDocument, renderPdfPage, type PdfDocumentHandle } from "./pdfRuntime.client";
const bytes = new TextEncoder().encode("%PDF-1.7\n");
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
