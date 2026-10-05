import { afterEach, expect, it, vi } from "vitest";
import { inspectImagesToPdfFile } from "./imagesToPdf.client";
import { MAX_SOURCE_BYTES } from "../image/imageFile";
const source = vi.hoisted(() => ({ format: vi.fn(), inspect: vi.fn() }));
vi.mock("../image/imageFile.client", async original => ({ ...await original(), readImageFileFormat: source.format, inspectImageFile: source.inspect }));
afterEach(() => vi.clearAllMocks());
const file = (size = 10) => ({ size, arrayBuffer: async () => new Uint8Array([255, 216]).buffer }) as File;
it.each(["jpeg", "png"])("accepts detected %s without filename/MIME authority", async format => {
    source.format.mockResolvedValueOnce(format); source.inspect.mockResolvedValueOnce({ width: 80, height: 60 });
    expect(await inspectImagesToPdfFile(file(), new AbortController().signal)).toEqual({ format, width: 80, height: 60, bytes: new Uint8Array([255, 216]) });
});
it.each([0, MAX_SOURCE_BYTES + 1])("rejects invalid source size %s before inspection", async size => {
    await expect(inspectImagesToPdfFile(file(size), new AbortController().signal)).rejects.toThrow(); expect(source.format).not.toHaveBeenCalled();
});
it("rejects WebP, unsupported bytes, decode errors and dimension limits locally", async () => {
    source.format.mockResolvedValueOnce("webp"); await expect(inspectImagesToPdfFile(file(), new AbortController().signal)).rejects.toThrow("WebP"); expect(source.inspect).not.toHaveBeenCalled();
    source.format.mockRejectedValueOnce(new Error("unsupported")); await expect(inspectImagesToPdfFile(file(), new AbortController().signal)).rejects.toThrow();
    source.format.mockResolvedValue("jpeg"); source.inspect.mockRejectedValueOnce(new Error("decode")); await expect(inspectImagesToPdfFile(file(), new AbortController().signal)).rejects.toThrow();
    source.inspect.mockResolvedValueOnce({ width: 6000, height: 6000 }); await expect(inspectImagesToPdfFile(file(), new AbortController().signal)).rejects.toThrow("30");
});
it("stops an aborted inspection pipeline before reading full bytes", async () => {
    const abort = new AbortController(); source.format.mockImplementationOnce(async () => { abort.abort(); return "jpeg"; });
    await expect(inspectImagesToPdfFile(file(), abort.signal)).rejects.toMatchObject({ name: "AbortError" }); expect(source.inspect).not.toHaveBeenCalled();
});
it("uses actual encoded content despite false filename and MIME declarations", async () => {
    const actual = await vi.importActual<typeof import("../image/imageFile.client")>("../image/imageFile.client");
    source.format.mockImplementation(actual.readImageFileFormat); source.inspect.mockResolvedValue({ width: 80, height: 60 });
    const misleading = new File([new Uint8Array([255, 216, 0])], "false.png", { type: "image/png" });
    expect((await inspectImagesToPdfFile(misleading, new AbortController().signal)).format).toBe("jpeg");
    await expect(inspectImagesToPdfFile(new File(["not image content"], "false.jpg", { type: "image/jpeg" }), new AbortController().signal)).rejects.toThrow("not valid");
});
