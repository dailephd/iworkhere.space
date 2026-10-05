import { afterEach, expect, it, vi } from "vitest";
import { verifyPdfLibOutput } from "./pdfLibVerification.client";
const runtime = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), cancel: vi.fn() }));
vi.mock("./pdfRuntime.client", () => ({ openPdfDocument: runtime.open }));
const expected = [{ width: 320, height: 240, rotation: 90 }];
afterEach(() => { vi.clearAllMocks(); });
it("independently verifies count/geometry/rotation and always closes handles", async () => {
    for (const inspection of [
        { pageCount: 1, page: expected },
        { pageCount: 2, page: [...expected, ...expected] },
        { pageCount: 1, page: [{ ...expected[0], width: 321 }] },
        { pageCount: 1, page: [{ ...expected[0], height: 241 }] },
        { pageCount: 1, page: [{ ...expected[0], rotation: 0 }] },
    ]) {
        runtime.open.mockReturnValueOnce({ promise: Promise.resolve({ inspection, close: runtime.close }), cancel: runtime.cancel });
        const work = verifyPdfLibOutput(new Uint8Array([1]), expected, new AbortController().signal);
        if (inspection.page === expected) await expect(work).resolves.toBeUndefined();
        else await expect(work).rejects.toThrow("verification failed");
    }
    expect(runtime.close).toHaveBeenCalledTimes(5);
    expect(runtime.open.mock.calls.every(call => call[1] === "generated-output")).toBe(true);
});
it("cancels pending independent verification and removes its abort listener", async () => {
    let reject!: (error: Error) => void;
    runtime.cancel.mockImplementationOnce(() => reject(new DOMException("Cancelled", "AbortError")));
    runtime.open.mockReturnValueOnce({ promise: new Promise((_, fail) => { reject = fail; }), cancel: runtime.cancel });
    const controller = new AbortController(); const remove = vi.spyOn(controller.signal, "removeEventListener");
    const work = verifyPdfLibOutput(new Uint8Array([1]), expected, controller.signal);
    controller.abort(); await expect(work).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.cancel).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
    await expect(verifyPdfLibOutput(new Uint8Array([1]), expected, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.open).toHaveBeenCalledOnce();
});
