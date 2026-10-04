import { afterEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ openPdfDocument: vi.fn() }));
vi.mock("./pdfRuntime.client", () => runtime);
import { inspectPdfFile } from "./pdfFile.client";
afterEach(() => vi.clearAllMocks());
it("rejects source sizes before reading and false headers before a full read", async () => {
    const arrayBuffer = vi.fn();
    for (const size of [0, 10485761]) await expect(inspectPdfFile({ size, arrayBuffer } as unknown as File)).rejects.toThrow();
    expect(arrayBuffer).not.toHaveBeenCalled();
    const file = new File(["fake PDF"], "document.pdf", { type: "application/pdf" });
    const fullRead = vi.spyOn(file, "arrayBuffer");
    await expect(inspectPdfFile(file)).rejects.toMatchObject({ category: "signature" }); expect(fullRead).not.toHaveBeenCalled();
});
it("closes an inspected handle and honors pre-aborted reads", async () => {
    const close = vi.fn(async () => {}); const inspection = { pageCount: 1, page: [{ width: 320, height: 240, rotation: 0 }] };
    runtime.openPdfDocument.mockReturnValue({ promise: Promise.resolve({ inspection, close }), cancel: vi.fn() });
    const file = new File(["%PDF-1.7\n"], "wrong.txt", { type: "text/plain" });
    expect((await inspectPdfFile(file)).inspection).toEqual(inspection); expect(close).toHaveBeenCalledOnce();
    const controller = new AbortController(); controller.abort();
    await expect(inspectPdfFile(file, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
it("bounds file-read failures without exposing diagnostics", async () => {
    const file = new File(["%PDF-1.7\n"], "document.pdf");
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("private file diagnostic"));
    await expect(inspectPdfFile(file)).rejects.toMatchObject({ category: "runtime" });
    await expect(inspectPdfFile(file)).rejects.not.toThrow("private file diagnostic");
});
