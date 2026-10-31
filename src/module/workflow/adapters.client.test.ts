import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    assembleImagePdf,
    assemblePacketPdf,
    compressPacketPdf,
    compressTo,
    convertHeicPhoto,
    convertTo,
    inspectGeneratedPdf,
    inspectHeicPhoto,
    inspectPacketImage,
    inspectPdfSource,
    inspectSource,
    measureBlob,
    readSourceFormat,
    renderPdfPages,
    resizeTo,
    toAdapterError,
    WorkflowAdapterError,
} from "./adapters.client";
import { startHeicOperation } from "@/module/tool/image/heicConverter.client";
import { HeicProcessingError, type HeicWorkerError } from "@/module/tool/image/heicConverter.workerType";
import { PdfFileError, type PdfFileFailure } from "@/module/tool/document/pdfFile";
import { inspectPdfFile } from "@/module/tool/document/pdfFile.client";
import { openPdfDocument } from "@/module/tool/document/pdfRuntime.client";
import { PdfLibProcessingError, startAssemblePdfOperation, startImagesToPdfOperation } from "@/module/tool/document/pdfLib.client";
import { PdfToImageError } from "@/module/tool/document/pdfToImage";
import { convertPdfToImages } from "@/module/tool/document/pdfToImage.client";
import { CompressPdfVerificationError, compressPdf } from "@/module/tool/document/compressPdf.client";

vi.mock("@/module/tool/image/heicConverter.client", () => ({ startHeicOperation: vi.fn() }));
vi.mock("@/module/tool/document/pdfFile.client", () => ({ inspectPdfFile: vi.fn() }));
vi.mock("@/module/tool/document/pdfRuntime.client", () => ({ openPdfDocument: vi.fn() }));
vi.mock("@/module/tool/document/pdfToImage.client", () => ({ convertPdfToImages: vi.fn() }));
vi.mock("@/module/tool/document/pdfLib.client", async importOriginal => ({
    ...(await importOriginal<typeof import("@/module/tool/document/pdfLib.client")>()),
    startAssemblePdfOperation: vi.fn(),
    startImagesToPdfOperation: vi.fn(),
}));
vi.mock("@/module/tool/document/compressPdf.client", async importOriginal => ({
    ...(await importOriginal<typeof import("@/module/tool/document/compressPdf.client")>()),
    compressPdf: vi.fn(),
}));

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

const bytesFile = (magic: number[], name: string, extra = 16) => new File([new Uint8Array([...magic, ...new Array(extra).fill(1)])], name);

async function expectAdapterError(promise: Promise<unknown>, code: string, text?: string) {
    const error = await promise.then(() => null, (failure: unknown) => failure);
    expect(error).toBeInstanceOf(WorkflowAdapterError);
    expect((error as WorkflowAdapterError).code).toBe(code);
    if (text) expect((error as WorkflowAdapterError).message).toContain(text);
}

describe("workflow adapters: validate and inspect", () => {
    const close = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 640, height: 480, close }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("detects the encoding from magic bytes, never from the filename or declared type", async () => {
        expect(await readSourceFormat(bytesFile(JPEG_MAGIC, "actually-a.png"))).toBe("jpeg");
        expect(await readSourceFormat(bytesFile(PNG_MAGIC, "actually-a.jpg"))).toBe("png");
        expect(await readSourceFormat(bytesFile(WEBP_MAGIC, "no-extension"))).toBe("webp");
    });

    it("classifies empty files as INVALID_INPUT and oversize files as SOURCE_LIMIT", async () => {
        await expectAdapterError(readSourceFormat(new File([], "empty.png")), "INVALID_INPUT", "empty");
        const oversize = bytesFile(PNG_MAGIC, "big.png");
        Object.defineProperty(oversize, "size", { value: 26_214_400 + 1 });
        await expectAdapterError(readSourceFormat(oversize), "SOURCE_LIMIT", "25 MiB");
        const atLimit = bytesFile(PNG_MAGIC, "limit.png");
        Object.defineProperty(atLimit, "size", { value: 26_214_400 });
        expect(await readSourceFormat(atLimit)).toBe("png");
    });

    it("classifies non-image bytes as UNSUPPORTED_FORMAT", async () => {
        await expectAdapterError(readSourceFormat(new File(["GIF89a not supported"], "x.jpg", { type: "image/jpeg" })), "UNSUPPORTED_FORMAT", "not valid JPEG, PNG, or WebP");
    });

    it("reports real decoded dimensions and closes the bitmap", async () => {
        const fact = await inspectSource(bytesFile(PNG_MAGIC, "a.png"), "png");
        expect(fact).toEqual({ format: "png", width: 640, height: 480, sizeBytes: 8 + 16 });
        expect(close).toHaveBeenCalledOnce();
    });

    it("rejects decoded images over 30,000,000 pixels as RESOURCE_LIMIT and still closes the bitmap", async () => {
        vi.mocked(createImageBitmap).mockResolvedValueOnce({ width: 6000, height: 5001, close } as unknown as ImageBitmap);
        await expectAdapterError(inspectSource(bytesFile(PNG_MAGIC, "a.png"), "png"), "RESOURCE_LIMIT", "30,000,000 pixels");
        expect(close).toHaveBeenCalledOnce();
        vi.mocked(createImageBitmap).mockResolvedValueOnce({ width: 6000, height: 5000, close } as unknown as ImageBitmap);
        expect((await inspectSource(bytesFile(PNG_MAGIC, "b.png"), "png")).width).toBe(6000);
    });

    it("classifies undecodable data as PROCESSING_FAILED", async () => {
        vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("private decoder detail"));
        const promise = inspectSource(bytesFile(JPEG_MAGIC, "bad.jpg"), "jpeg");
        await expectAdapterError(promise, "PROCESSING_FAILED", "could not be decoded");
        await promise.catch((error: Error) => expect(error.message).not.toContain("private decoder detail"));
    });
});

describe("workflow adapters: bridges to the existing processors", () => {
    const close = vi.fn(), fillRect = vi.fn(), drawImage = vi.fn();
    const context = { fillStyle: "", fillRect, drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
    const toBlob = vi.fn();
    const canvas = { width: 0, height: 0, getContext: vi.fn(), toBlob };
    beforeEach(() => {
        vi.clearAllMocks();
        context.fillStyle = "";
        canvas.getContext.mockReturnValue(context);
        toBlob.mockImplementation((callback: (blob: Blob | null) => void, mime: string) => callback(new Blob(["encoded"], { type: mime })));
        vi.stubGlobal("document", { createElement: () => canvas });
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 240, height: 180, close }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("converts PNG to JPEG through the existing converter, flattening alpha on white before drawing", async () => {
        const output = await convertTo(bytesFile(PNG_MAGIC, "logo.png"), "jpeg");
        expect(output).toBeInstanceOf(File);
        expect(output.type).toBe("image/jpeg");
        expect(context.fillStyle).toBe("#ffffff");
        expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(drawImage.mock.invocationCallOrder[0]);
        expect(toBlob.mock.calls[0].slice(1)).toEqual(["image/jpeg", 0.9]);
    });

    it("resizes to the requested integer size in the selected format", async () => {
        const output = await resizeTo(bytesFile(JPEG_MAGIC, "a.jpg"), "jpeg", { width: 120, height: 90 });
        expect(output.type).toBe("image/jpeg");
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 120, 90);
    });

    it("re-encodes with an existing valid quality and PNG without any quality argument", async () => {
        await compressTo(bytesFile(JPEG_MAGIC, "a.jpg"), "jpeg", 45);
        expect(toBlob.mock.calls[0].slice(1)).toEqual(["image/jpeg", 0.45]);
        await compressTo(bytesFile(PNG_MAGIC, "a.png"), "png", 45);
        expect(toBlob.mock.calls[1]).toHaveLength(2);
    });

    it("rejects a quality the existing encoder does not accept as PROCESSING_FAILED", async () => {
        await expectAdapterError(compressTo(bytesFile(JPEG_MAGIC, "a.jpg"), "jpeg", 47), "PROCESSING_FAILED", "steps of 5");
    });

    it("maps an encoder that returns no blob to PROCESSING_FAILED without leaking details", async () => {
        toBlob.mockImplementationOnce((callback: (blob: Blob | null) => void) => callback(null));
        await expectAdapterError(convertTo(bytesFile(PNG_MAGIC, "a.png"), "webp"), "PROCESSING_FAILED", "could not produce a valid WebP result");
    });

    it("maps unexpected non-processor errors to a generic message", async () => {
        vi.mocked(createImageBitmap).mockRejectedValueOnce(new TypeError("SECRET"));
        const promise = resizeTo(bytesFile(JPEG_MAGIC, "a.jpg"), "jpeg", { width: 10, height: 10 });
        await expectAdapterError(promise, "PROCESSING_FAILED");
        await promise.catch((error: Error) => expect(error.message).not.toContain("SECRET"));
    });
});

describe("workflow adapters: measureBlob verifies from the blob's own bytes", () => {
    const close = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 33, height: 22, close }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("reports sniffed type, decoded size and byte length, ignoring a lying declared type", async () => {
        const blob = new Blob([new Uint8Array([...PNG_MAGIC, 1, 2, 3])], { type: "image/jpeg" });
        expect(await measureBlob(blob)).toEqual({ detectedMimeType: "image/png", width: 33, height: 22, byteLength: 11 });
        expect(close).toHaveBeenCalledOnce();
    });

    it("reports no detected type and zero size for bytes that are not a supported image", async () => {
        expect(await measureBlob(new Blob(["plain text"], { type: "image/png" }))).toEqual({ detectedMimeType: null, width: 0, height: 0, byteLength: 10 });
        expect(createImageBitmap).not.toHaveBeenCalled();
    });

    it("reports the sniffed type with zero dimensions when the image cannot be decoded", async () => {
        vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("corrupt"));
        expect(await measureBlob(new Blob([new Uint8Array(JPEG_MAGIC)], { type: "image/jpeg" }))).toEqual({ detectedMimeType: "image/jpeg", width: 0, height: 0, byteLength: 4 });
    });
});

/* ---------- multi-file workflow adapters ---------- */

function fakeOperation<T>(promise: Promise<T>) {
    return { promise, cancel: vi.fn() };
}

/** An operation that settles only when cancelled, like the real workers. */
function hangingOperation<T>() {
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((_resolve, fail) => { reject = fail; });
    return { promise, cancel: vi.fn(() => reject(new DOMException("Operation cancelled", "AbortError"))) };
}

describe("toAdapterError", () => {
    it.each<[HeicWorkerError, string]>([
        ["unsupported", "UNSUPPORTED_FORMAT"],
        ["decode-failed", "UNSUPPORTED_FORMAT"],
        ["source-dimension-limit", "RESOURCE_LIMIT"],
        ["canvas-unavailable", "PROCESSING_FAILED"],
        ["encode-failed", "PROCESSING_FAILED"],
        ["worker-start-failed", "PROCESSING_FAILED"],
        ["worker-runtime-failed", "PROCESSING_FAILED"],
        ["worker-response-invalid", "PROCESSING_FAILED"],
    ])("maps the HEIC failure %s to %s and names the photo", (category, code) => {
        const mapped = toAdapterError(new HeicProcessingError(category), "photo-2", "Photo 2") as WorkflowAdapterError;
        expect(mapped).toBeInstanceOf(WorkflowAdapterError);
        expect(mapped.code).toBe(code);
        expect(mapped.sourceId).toBe("photo-2");
        expect(mapped.message.startsWith("Photo 2: ")).toBe(true);
    });

    it.each<[PdfFileFailure, string]>([
        ["empty", "INVALID_INPUT"],
        ["source-limit", "SOURCE_LIMIT"],
        ["signature", "UNSUPPORTED_FORMAT"],
        ["encrypted", "UNSUPPORTED_FORMAT"],
        ["malformed", "UNSUPPORTED_FORMAT"],
        ["page-limit", "PAGE_LIMIT"],
        ["geometry", "UNSUPPORTED_FORMAT"],
        ["render-limit", "RESOURCE_LIMIT"],
        ["runtime", "PROCESSING_FAILED"],
    ])("maps the PDF file failure %s to %s", (category, code) => {
        expect((toAdapterError(new PdfFileError(category)) as WorkflowAdapterError).code).toBe(code);
    });

    it("maps PDF engine, render and generic failures without leaking their text", () => {
        expect((toAdapterError(new PdfLibProcessingError("encrypted")) as WorkflowAdapterError).code).toBe("UNSUPPORTED_FORMAT");
        expect((toAdapterError(new PdfLibProcessingError("timeout")) as WorkflowAdapterError).message).toContain("too long");
        expect((toAdapterError(new PdfLibProcessingError("protocol")) as WorkflowAdapterError).message).toContain("25 MiB");
        expect((toAdapterError(new PdfToImageError("option")) as WorkflowAdapterError).code).toBe("INVALID_INPUT");
        expect((toAdapterError(new PdfToImageError("encoding")) as WorkflowAdapterError).code).toBe("PROCESSING_FAILED");
        expect((toAdapterError(new PdfToImageError("verification")) as WorkflowAdapterError).code).toBe("VERIFICATION_FAILED");
        const generic = toAdapterError(new TypeError("SECRET C:/private/path"), "s1") as WorkflowAdapterError;
        expect(generic).toMatchObject({ code: "PROCESSING_FAILED", sourceId: "s1" });
        expect(generic.message).not.toContain("SECRET");
    });

    it("passes an abort error through untouched and keeps an existing source id", () => {
        const abort = new DOMException("Operation cancelled", "AbortError");
        expect(toAdapterError(abort, "s1", "Source")).toBe(abort);
        const named = new WorkflowAdapterError("INVALID_INPUT", "already named", "first");
        expect(toAdapterError(named, "second", "Label")).toBe(named);
        const plain = new WorkflowAdapterError("INVALID_INPUT", "plain");
        expect(toAdapterError(plain, "second", "Label")).toMatchObject({ sourceId: "second", message: "Label: plain" });
    });
});

describe("workflow adapters: HEIC photos", () => {
    const close = vi.fn();
    const JPEG_BLOB = () => new Blob([new Uint8Array([...JPEG_MAGIC, 1, 2, 3])], { type: "image/jpeg" });
    const heic = new File([new Uint8Array(20)], "photo.heic");
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 40, height: 30, close }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("inspects through the HEIC worker and returns the real source size", async () => {
        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.resolve({ id: 1, status: "inspected" as const, sourceWidth: 40, sourceHeight: 30, previewBlob: new Blob(["p"]) })));
        expect(await inspectHeicPhoto(heic, 1, new AbortController().signal)).toEqual({ width: 40, height: 30 });
        expect(vi.mocked(startHeicOperation).mock.calls[0][0]).toMatchObject({ operation: "inspect", file: heic });
    });

    it("converts, measures the encoded bytes and returns an images-to-PDF source; quality only for JPEG", async () => {
        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.resolve({ id: 2, status: "converted" as const, sourceWidth: 40, sourceHeight: 30, blob: JPEG_BLOB() })));
        const converted = await convertHeicPhoto(heic, 1, "jpeg", 80, new AbortController().signal);
        expect(converted).toMatchObject({ format: "jpeg", width: 40, height: 30 });
        expect(converted.bytes).toHaveLength(7);
        expect(vi.mocked(startHeicOperation).mock.calls[0][0]).toMatchObject({ operation: "convert", target: "jpeg", quality: 80 });

        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.resolve({ id: 3, status: "converted" as const, sourceWidth: 40, sourceHeight: 30, blob: new Blob([new Uint8Array([...PNG_MAGIC, 1])], { type: "image/png" }) })));
        await convertHeicPhoto(heic, 1, "png", 80, new AbortController().signal);
        expect("quality" in vi.mocked(startHeicOperation).mock.calls[1][0]).toBe(false);
    });

    it("rejects a conversion whose decoded size differs from the reported source size", async () => {
        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.resolve({ id: 2, status: "converted" as const, sourceWidth: 41, sourceHeight: 30, blob: JPEG_BLOB() })));
        await expectAdapterError(convertHeicPhoto(heic, 2, "jpeg", 80, new AbortController().signal), "VERIFICATION_FAILED", "Photo 2");
    });

    it("rejects a conversion whose bytes are not the requested format, whatever the blob claims", async () => {
        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.resolve({ id: 2, status: "converted" as const, sourceWidth: 40, sourceHeight: 30, blob: new Blob([new Uint8Array([...PNG_MAGIC, 1])], { type: "image/jpeg" }) })));
        await expectAdapterError(convertHeicPhoto(heic, 1, "jpeg", 80, new AbortController().signal), "VERIFICATION_FAILED");
    });

    it("names the photo when the decoder rejects it", async () => {
        vi.mocked(startHeicOperation).mockReturnValue(fakeOperation(Promise.reject(new HeicProcessingError("decode-failed"))));
        const error = await inspectHeicPhoto(heic, 3, new AbortController().signal).catch((failure: unknown) => failure);
        expect(error).toMatchObject({ code: "UNSUPPORTED_FORMAT", sourceId: "photo-3" });
    });

    it("cancels the worker operation when the run is aborted and surfaces an abort, not a processing failure", async () => {
        const operation = hangingOperation<never>();
        vi.mocked(startHeicOperation).mockReturnValue(operation);
        const controller = new AbortController();
        const pending = convertHeicPhoto(heic, 1, "jpeg", 80, controller.signal);
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(operation.cancel).toHaveBeenCalledOnce();
    });

    it("cancels immediately when the signal is already aborted", async () => {
        const operation = hangingOperation<never>();
        vi.mocked(startHeicOperation).mockReturnValue(operation);
        const controller = new AbortController();
        controller.abort();
        await expect(inspectHeicPhoto(heic, 1, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
        expect(operation.cancel).toHaveBeenCalled();
    });
});

describe("workflow adapters: packet sources", () => {
    const close = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 64, height: 48, close }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("returns the real bytes and decoded size of an image whose declared kind matches its encoding", async () => {
        const fact = await inspectPacketImage(bytesFile(PNG_MAGIC, "scan.png", 4), "png", new AbortController().signal, "scan");
        expect(fact).toMatchObject({ format: "png", width: 64, height: 48 });
        expect(fact.bytes).toHaveLength(12);
    });

    it("rejects an image declared as PNG whose bytes are JPEG, naming the source", async () => {
        const error = await inspectPacketImage(bytesFile(JPEG_MAGIC, "scan.png"), "png", new AbortController().signal, "scan").catch((failure: unknown) => failure);
        expect(error).toMatchObject({ code: "UNSUPPORTED_FORMAT", sourceId: "scan" });
        expect((error as Error).message).toContain("not PNG");
    });

    it("rejects WebP and unsupported bytes", async () => {
        await expectAdapterError(inspectPacketImage(bytesFile(WEBP_MAGIC, "a.webp"), "png", new AbortController().signal, "a"), "UNSUPPORTED_FORMAT", "WebP");
        await expectAdapterError(inspectPacketImage(new File(["GIF89a data"], "a.png"), "png", new AbortController().signal, "a"), "UNSUPPORTED_FORMAT");
    });

    it("rejects an image over the pixel limit as RESOURCE_LIMIT with the source id", async () => {
        vi.mocked(createImageBitmap).mockResolvedValueOnce({ width: 6000, height: 5001, close } as unknown as ImageBitmap);
        const error = await inspectPacketImage(bytesFile(PNG_MAGIC, "big.png"), "png", new AbortController().signal, "big").catch((failure: unknown) => failure);
        expect(error).toMatchObject({ code: "RESOURCE_LIMIT", sourceId: "big" });
    });

    it("maps PDF inspection failures to typed codes with the source id, and passes aborts through", async () => {
        vi.mocked(inspectPdfFile).mockRejectedValueOnce(new PdfFileError("encrypted"));
        const error = await inspectPdfSource(new File(["x"], "a.pdf"), new AbortController().signal, "contract").catch((failure: unknown) => failure);
        expect(error).toMatchObject({ code: "UNSUPPORTED_FORMAT", sourceId: "contract" });
        vi.mocked(inspectPdfFile).mockRejectedValueOnce(new DOMException("Operation cancelled", "AbortError"));
        await expect(inspectPdfSource(new File(["x"], "a.pdf"), new AbortController().signal)).rejects.toMatchObject({ name: "AbortError" });
    });
});

describe("workflow adapters: PDF engine, render and compression", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1]);
    beforeEach(() => vi.clearAllMocks());

    it("assembles through the additive worker operation and returns its bytes", async () => {
        vi.mocked(startAssemblePdfOperation).mockReturnValue(fakeOperation(Promise.resolve(pdf)));
        const source = [{ id: "s0", kind: "pdf" as const, bytes: pdf }];
        const order = [{ sourceId: "s0", pageNumber: 1 }];
        expect(await assemblePacketPdf(source, order, new AbortController().signal)).toBe(pdf);
        expect(startAssemblePdfOperation).toHaveBeenCalledWith(source, order);
    });

    it("assembles HEIC pages through the existing images-to-PDF operation", async () => {
        vi.mocked(startImagesToPdfOperation).mockReturnValue(fakeOperation(Promise.resolve(pdf)));
        const image = [{ bytes: new Uint8Array([1]), format: "jpeg" as const, width: 2, height: 2 }];
        expect(await assembleImagePdf(image, new AbortController().signal)).toBe(pdf);
        expect(startImagesToPdfOperation).toHaveBeenCalledWith(image);
    });

    it("cancels the worker on abort and maps engine failures", async () => {
        const operation = hangingOperation<Uint8Array>();
        vi.mocked(startAssemblePdfOperation).mockReturnValue(operation);
        const controller = new AbortController();
        const pending = assemblePacketPdf([{ id: "s0", kind: "pdf", bytes: pdf }], [{ sourceId: "s0", pageNumber: 1 }], controller.signal);
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(operation.cancel).toHaveBeenCalledOnce();

        vi.mocked(startAssemblePdfOperation).mockReturnValue(fakeOperation(Promise.reject(new PdfLibProcessingError("timeout"))));
        await expectAdapterError(assemblePacketPdf([{ id: "s0", kind: "pdf", bytes: pdf }], [{ sourceId: "s0", pageNumber: 1 }], new AbortController().signal), "PROCESSING_FAILED", "too long");
    });

    it("maps a synchronous protocol rejection of the request to a typed failure", async () => {
        vi.mocked(startAssemblePdfOperation).mockImplementation(() => { throw new PdfLibProcessingError("protocol"); });
        await expectAdapterError(assemblePacketPdf([], [], new AbortController().signal), "PROCESSING_FAILED");
    });

    it("reads a generated PDF back with the document reader and always closes it", async () => {
        const handleClose = vi.fn().mockResolvedValue(undefined);
        const inspection = { pageCount: 1, page: [{ width: 10, height: 20, rotation: 0 }] };
        vi.mocked(openPdfDocument).mockReturnValue(fakeOperation(Promise.resolve({ document: {} as never, inspection, close: handleClose })));
        expect(await inspectGeneratedPdf(pdf, new AbortController().signal)).toEqual(inspection);
        expect(openPdfDocument).toHaveBeenCalledWith(pdf, "generated-output");
        expect(handleClose).toHaveBeenCalledOnce();
    });

    it("maps a PDF reader rejection of the generated bytes", async () => {
        vi.mocked(openPdfDocument).mockImplementation(() => { throw new PdfFileError("malformed"); });
        await expectAdapterError(inspectGeneratedPdf(pdf, new AbortController().signal), "UNSUPPORTED_FORMAT");
    });

    it("renders through the existing page renderer and maps its failures", async () => {
        const output = [{ pageNumber: 2, format: "png" as const, width: 10, height: 20, blob: new Blob(["x"]) }];
        vi.mocked(convertPdfToImages).mockResolvedValueOnce(output);
        const signal = new AbortController().signal;
        expect(await renderPdfPages(pdf, [2], { format: "png", dpi: 72, quality: 0.85 }, signal)).toBe(output);
        expect(convertPdfToImages).toHaveBeenCalledWith(pdf, [2], { format: "png", dpi: 72, quality: 0.85 }, signal);
        vi.mocked(convertPdfToImages).mockRejectedValueOnce(new PdfFileError("render-limit"));
        await expectAdapterError(renderPdfPages(pdf, [2], { format: "png", dpi: 300, quality: 0.85 }, signal), "RESOURCE_LIMIT", "supported page or image bounds");
        vi.mocked(convertPdfToImages).mockRejectedValueOnce(new DOMException("Operation cancelled", "AbortError"));
        await expect(renderPdfPages(pdf, [2], { format: "png", dpi: 72, quality: 0.85 }, signal)).rejects.toMatchObject({ name: "AbortError" });
    });

    it("returns the compressor's outcomes unchanged and never disguises a verification failure as no-reduction", async () => {
        const smaller = { status: "smaller" as const, bytes: pdf, savedBytes: 5, percentage: 10 };
        vi.mocked(compressPdf).mockResolvedValueOnce(smaller);
        expect(await compressPacketPdf(pdf, new AbortController().signal)).toBe(smaller);
        vi.mocked(compressPdf).mockResolvedValueOnce({ status: "no-reduction" });
        expect(await compressPacketPdf(pdf, new AbortController().signal)).toEqual({ status: "no-reduction" });
        vi.mocked(compressPdf).mockRejectedValueOnce(new CompressPdfVerificationError());
        await expectAdapterError(compressPacketPdf(pdf, new AbortController().signal), "VERIFICATION_FAILED", "independent page verification");
        vi.mocked(compressPdf).mockRejectedValueOnce(new DOMException("Operation cancelled", "AbortError"));
        await expect(compressPacketPdf(pdf, new AbortController().signal)).rejects.toMatchObject({ name: "AbortError" });
        vi.mocked(compressPdf).mockRejectedValueOnce(new Error("qpdf internals"));
        await expectAdapterError(compressPacketPdf(pdf, new AbortController().signal), "PROCESSING_FAILED", "No download was created");
    });
});
