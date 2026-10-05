import { afterEach, expect, it, vi } from "vitest";
import { compressPdf, compressPdfErrorMessage, CompressPdfVerificationError } from "./compressPdf.client";
import { QpdfProcessingError } from "./qpdf.client";
const work = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), verify: vi.fn() }));
vi.mock("./qpdf.client", async importOriginal => ({ ...await importOriginal<typeof import("./qpdf.client")>(), startCompressPdfOperation: work.start }));
vi.mock("./compressPdfVerification.client", () => ({ verifyCompressedPdf: work.verify }));
afterEach(() => vi.resetAllMocks());
const source = new Uint8Array(100);
it.each([100, 101])("discards %i-byte non-improving candidates without verification", async length => {
    work.start.mockReturnValue({ promise: Promise.resolve(new Uint8Array(length)), cancel: work.cancel });
    await expect(compressPdf(source, new AbortController().signal)).resolves.toEqual({ status: "no-reduction" });
    expect(work.verify).not.toHaveBeenCalled();
});
it("verifies smaller candidate before returning exact savings", async () => {
    const bytes = new Uint8Array(60), controller = new AbortController();
    work.start.mockReturnValue({ promise: Promise.resolve(bytes), cancel: work.cancel });
    await expect(compressPdf(source, controller.signal)).resolves.toEqual({ status: "smaller", bytes, savedBytes: 40, percentage: 40 });
    expect(work.verify).toHaveBeenCalledWith(source, bytes, controller.signal);
});
it("distinguishes verification failure from no reduction without leaking diagnostics", async () => {
    work.start.mockReturnValue({ promise: Promise.resolve(new Uint8Array(60)), cancel: work.cancel }); work.verify.mockRejectedValue(new Error("private path pointer text"));
    await expect(compressPdf(source, new AbortController().signal)).rejects.toBeInstanceOf(CompressPdfVerificationError);
    expect(compressPdfErrorMessage(new CompressPdfVerificationError())).toContain("independent page verification");
    expect(compressPdfErrorMessage(new Error("private path"))).not.toContain("private");
});
it("cancels QPDF, ignores late candidate and removes listeners", async () => {
    let done!: (value: Uint8Array) => void; const controller = new AbortController(), remove = vi.spyOn(controller.signal, "removeEventListener");
    work.start.mockReturnValue({ promise: new Promise(resolve => { done = resolve; }), cancel: work.cancel });
    const result = compressPdf(source, controller.signal); controller.abort(); done(new Uint8Array(60));
    await expect(result).rejects.toMatchObject({ name: "AbortError" }); expect(work.cancel).toHaveBeenCalledOnce(); expect(work.verify).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledOnce();
    await expect(compressPdf(source, controller.signal)).rejects.toMatchObject({ name: "AbortError" }); expect(work.start).toHaveBeenCalledOnce();
});
it.each(["initialization", "processing", "timeout", "protocol", "encrypted"] as const)("preserves bounded %s failure", async category => {
    work.start.mockReturnValue({ promise: Promise.reject(new QpdfProcessingError(category)), cancel: work.cancel });
    await expect(compressPdf(source, new AbortController().signal)).rejects.toMatchObject({ category }); expect(work.verify).not.toHaveBeenCalled();
    expect(compressPdfErrorMessage(new QpdfProcessingError(category))).not.toContain("Qpdf");
});
