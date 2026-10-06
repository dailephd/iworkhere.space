import { afterEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ factory: vi.fn(), run: vi.fn(), write: vi.fn(), read: vi.fn(), unlink: vi.fn() }));
vi.mock("http://localhost/vendor/qpdf/12.4.2/qpdf.js", () => ({ default: runtime.factory }));
interface WorkerScope { location: { origin: string }; onmessage?: (event: MessageEvent) => Promise<void>; postMessage: ReturnType<typeof vi.fn> }
afterEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
async function begin(status = 0, encrypted = false) {
    const scope: WorkerScope = { location: { origin: "http://localhost" }, postMessage: vi.fn() }; vi.stubGlobal("self", scope);
    runtime.factory.mockResolvedValue({ FS: { writeFile: runtime.write, readFile: runtime.read, unlink: runtime.unlink }, callMain: runtime.run });
    runtime.run.mockReturnValueOnce(encrypted ? 0 : 2).mockReturnValueOnce(status); runtime.read.mockReturnValue(new Uint8Array([1, 2]));
    await import("./qpdf.worker"); return scope;
}
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture");
it("uses only frozen structural flags, copies output, cleans MEMFS before transfer, and handles only one request", async () => {
    const scope = await begin(); await scope.onmessage!({ data: { id: 1, operation: "compress", bytes } } as MessageEvent);
    expect(runtime.run.mock.calls[1][0]).toEqual(["--object-streams=generate", "--recompress-flate", "--compression-level=9", "--deterministic-id", "/input.pdf", "/output.pdf"]);
    expect(runtime.unlink.mock.calls).toEqual([["/input.pdf"], ["/output.pdf"]]); expect(runtime.unlink.mock.invocationCallOrder[1]).toBeLessThan(scope.postMessage.mock.invocationCallOrder[0]);
    expect(scope.postMessage.mock.calls[0][0]).toMatchObject({ id: 1, status: "success" }); expect(scope.postMessage.mock.calls[0][0].bytes).not.toBe(runtime.read.mock.results[0].value);
    await scope.onmessage!({ data: { id: 2, operation: "compress", bytes } } as MessageEvent); expect(runtime.factory).toHaveBeenCalledOnce();
});
it.each([2, 3])("discards output on exit %i, with bounded failure and MEMFS cleanup", async status => {
    const scope = await begin(status); await scope.onmessage!({ data: { id: 1, operation: "compress", bytes } } as MessageEvent);
    expect(runtime.read).not.toHaveBeenCalled(); expect(scope.postMessage).toHaveBeenCalledWith({ id: 1, status: "error", category: "processing" }); expect(runtime.unlink).toHaveBeenCalledTimes(2);
});
it("rejects encryption before structural command", async () => {
    const scope = await begin(0, true); await scope.onmessage!({ data: { id: 1, operation: "compress", bytes } } as MessageEvent); expect(runtime.run).toHaveBeenCalledOnce(); expect(scope.postMessage).toHaveBeenCalledWith({ id: 1, status: "error", category: "encrypted" }); expect(runtime.unlink).toHaveBeenCalledTimes(2);
});
it("maps initialization failure without diagnostics", async () => {
    const scope = await begin(); runtime.factory.mockRejectedValueOnce(new Error("private pointer")); await scope.onmessage!({ data: { id: 1, operation: "compress", bytes } } as MessageEvent); expect(scope.postMessage).toHaveBeenCalledWith({ id: 1, status: "error", category: "initialization" });
});
