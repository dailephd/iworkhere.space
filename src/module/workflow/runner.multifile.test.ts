import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapter from "./adapters.client";
import { WorkflowAdapterError } from "./adapters.client";
import { runWorkflow } from "./runner.client";
import { MAX_SINGLE_PDF_BYTES } from "@/module/tool/document/pdfFile";
import type { WorkflowProgress, WorkflowRequest, WorkflowRunResult } from "./type";

vi.mock("./adapters.client", async importOriginal => {
    const actual = await importOriginal<typeof import("./adapters.client")>();
    return {
        ...actual,
        measureBlob: vi.fn(),
        inspectHeicPhoto: vi.fn(),
        convertHeicPhoto: vi.fn(),
        inspectPdfSource: vi.fn(),
        inspectPacketImage: vi.fn(),
        assembleImagePdf: vi.fn(),
        assemblePacketPdf: vi.fn(),
        inspectGeneratedPdf: vi.fn(),
        compressPacketPdf: vi.fn(),
        renderPdfPages: vi.fn(),
    };
});

type HeicRequest = Extract<WorkflowRequest, { slug: "heic-photos-to-pdf" }>;
type PacketRequest = Extract<WorkflowRequest, { slug: "assemble-pdf-packet" }>;
type SlidesRequest = Extract<WorkflowRequest, { slug: "pdf-pages-for-slides" }>;

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];

function fakePdf(length = 64): Uint8Array {
    const bytes = new Uint8Array(length);
    bytes.set(PDF_HEADER);
    return bytes;
}

function geometry(count: number, width = 100, height = 200, rotation = 0) {
    return { pageCount: count, page: Array.from({ length: count }, () => ({ width, height, rotation })) };
}

function withSize(file: File, size: number): File {
    Object.defineProperty(file, "size", { value: size });
    return file;
}

function run(req: WorkflowRequest, signal: AbortSignal = new AbortController().signal) {
    const progress: WorkflowProgress[] = [];
    const result = runWorkflow(req, { signal, onProgress: item => progress.push(item) });
    return { result, progress };
}

function expectFailure(result: WorkflowRunResult) {
    if (result.ok) throw new Error("Expected a failure result");
    expect(result.outputs).toEqual([]);
    return result.failure;
}

function expectSuccess(result: WorkflowRunResult) {
    if (!result.ok) throw new Error(`Expected success but got ${result.failure.code}: ${result.failure.message}`);
    return result;
}

function passedStages(progress: WorkflowProgress[]) {
    return progress.filter(item => item.state === "passed").map(item => item.stage);
}

beforeEach(() => {
    vi.resetAllMocks();
});

/* ---------- HEIC photos to PDF ---------- */

describe("runWorkflow: heic-photos-to-pdf", () => {
    const photo = (label: number) => new File([new Uint8Array(100)], `photo-${label}.heic`);
    const heicRequest = (order: number[], overrides: Partial<HeicRequest> = {}): HeicRequest => ({
        slug: "heic-photos-to-pdf",
        sourcesInPageOrder: order.map(photo),
        intermediateFormat: "jpeg",
        quality: 90,
        ...overrides,
    });

    function wire(order: number[]) {
        vi.mocked(adapter.inspectHeicPhoto).mockResolvedValue({ width: 40, height: 30 });
        vi.mocked(adapter.convertHeicPhoto).mockImplementation(async (file, _ordinal, target) => {
            const label = Number(file.name.replace("photo-", "").replace(".heic", ""));
            return { bytes: new Uint8Array([label]), format: target, width: 10 * label, height: 5 * label };
        });
        vi.mocked(adapter.assembleImagePdf).mockResolvedValue(fakePdf());
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue({
            pageCount: order.length,
            page: order.map(label => ({ width: 10 * label, height: 5 * label, rotation: 0 })),
        });
    }

    it("converts every photo in the user's order, assembles one PDF and verifies it with named checks", async () => {
        wire([3, 1, 2]);
        const { result, progress } = run(heicRequest([3, 1, 2]));
        const done = expectSuccess(await result);

        expect(done.outputs).toHaveLength(1);
        expect(done.outputs[0]).toMatchObject({ name: "heic-photos.pdf", mimeType: "application/pdf", sizeBytes: 64 });
        const assembled = vi.mocked(adapter.assembleImagePdf).mock.calls[0][0];
        expect(assembled.map(source => source.bytes[0])).toEqual([3, 1, 2]);
        expect(assembled.map(source => source.width)).toEqual([30, 10, 20]);
        expect(vi.mocked(adapter.convertHeicPhoto).mock.calls.map(call => call[1])).toEqual([1, 2, 3]);
        expect(done.checks.map(check => [check.name, check.passed])).toEqual([
            ["Output is a PDF", true],
            ["Output size in bytes", true],
            ["Page count", true],
            ["Pages with the expected size and rotation", true],
        ]);
        expect(passedStages(progress)).toEqual(["validate", "inspect", "convert", "assemble", "verify", "complete"]);
        expect(progress.at(-1)).toMatchObject({ stage: "complete", state: "passed", completed: 6, total: 6 });
    });

    it("passes the JPEG quality to the converter and ignores it for PNG", async () => {
        wire([1]);
        await run(heicRequest([1], { quality: 35 })).result;
        expect(vi.mocked(adapter.convertHeicPhoto).mock.calls[0].slice(2)).toEqual(["jpeg", 35, expect.any(AbortSignal)]);
        vi.resetAllMocks();
        wire([1]);
        expectSuccess(await run(heicRequest([1], { intermediateFormat: "png", quality: 33 })).result);
        expect(vi.mocked(adapter.convertHeicPhoto).mock.calls[0][2]).toBe("png");
    });

    it.each([
        ["no photos", heicRequest([]), "INVALID_INPUT"],
        ["twenty-one photos", heicRequest(Array.from({ length: 21 }, (_, index) => index + 1)), "SOURCE_LIMIT"],
        ["JPEG quality not on the 5% grid", heicRequest([1], { quality: 33 }), "INVALID_INPUT"],
        ["JPEG quality below 10", heicRequest([1], { quality: 5 }), "INVALID_INPUT"],
        ["unknown intermediate format", heicRequest([1], { intermediateFormat: "webp" as unknown as "jpeg" }), "INVALID_INPUT"],
        ["a non-file entry", { ...heicRequest([1]), sourcesInPageOrder: [{} as unknown as File] }, "INVALID_INPUT"],
    ] as const)("rejects %s at validate before any processing", async (_label, req, code) => {
        const { result, progress } = run(req);
        const failure = expectFailure(await result);
        expect(failure).toMatchObject({ code, stage: "validate" });
        expect(adapter.inspectHeicPhoto).not.toHaveBeenCalled();
        expect(adapter.convertHeicPhoto).not.toHaveBeenCalled();
        expect(progress.at(-1)).toMatchObject({ stage: "validate", state: "failed" });
    });

    it("names the empty and the oversize photo by its ordinal", async () => {
        const empty = expectFailure(await run({ ...heicRequest([1, 2]), sourcesInPageOrder: [photo(1), new File([], "e.heic")] }).result);
        expect(empty).toMatchObject({ code: "INVALID_INPUT", sourceId: "photo-2" });
        const oversize = expectFailure(await run({ ...heicRequest([1, 2]), sourcesInPageOrder: [photo(1), withSize(photo(2), 26_214_401)] }).result);
        expect(oversize).toMatchObject({ code: "SOURCE_LIMIT", sourceId: "photo-2" });
        expect(oversize.message).toContain("Photo 2");
    });

    it("rejects an aggregate over 25 MiB even when every photo is within its own limit", async () => {
        const big = (label: number) => withSize(photo(label), 14_000_000);
        const failure = expectFailure(await run({ ...heicRequest([1, 2]), sourcesInPageOrder: [big(1), big(2)] }).result);
        expect(failure).toMatchObject({ code: "SOURCE_LIMIT", stage: "validate" });
        expect(failure.message).toContain("25 MiB");
        expect(adapter.inspectHeicPhoto).not.toHaveBeenCalled();
    });

    it("stops at the first unreadable later photo with its ordinal, no PDF work and no output", async () => {
        wire([1, 2, 3]);
        vi.mocked(adapter.convertHeicPhoto).mockImplementation(async (_file, ordinal, target) => {
            if (ordinal === 2) throw new WorkflowAdapterError("UNSUPPORTED_FORMAT", "Photo 2: not valid HEIC", "photo-2");
            return { bytes: new Uint8Array([ordinal]), format: target, width: 10, height: 10 };
        });
        const { result, progress } = run(heicRequest([1, 2, 3]));
        const failure = expectFailure(await result);
        expect(failure).toEqual({ code: "UNSUPPORTED_FORMAT", stage: "convert", message: "Photo 2: not valid HEIC", sourceId: "photo-2" });
        expect(adapter.convertHeicPhoto).toHaveBeenCalledTimes(2);
        expect(adapter.assembleImagePdf).not.toHaveBeenCalled();
        expect(progress.at(-1)).toMatchObject({ stage: "convert", state: "failed" });
    });

    it("fails at inspect for a photo the decoder rejects", async () => {
        wire([1, 2]);
        vi.mocked(adapter.inspectHeicPhoto).mockRejectedValueOnce(new WorkflowAdapterError("RESOURCE_LIMIT", "Photo 1: too large", "photo-1"));
        const failure = expectFailure(await run(heicRequest([1, 2])).result);
        expect(failure).toMatchObject({ code: "RESOURCE_LIMIT", stage: "inspect", sourceId: "photo-1" });
        expect(adapter.convertHeicPhoto).not.toHaveBeenCalled();
    });

    it("fails when the converted images together exceed 25 MiB", async () => {
        wire([1, 2]);
        vi.mocked(adapter.convertHeicPhoto).mockImplementation(async (_file, _ordinal, target) => ({ bytes: new Uint8Array(14_000_000), format: target, width: 10, height: 10 }));
        const failure = expectFailure(await run(heicRequest([1, 2])).result);
        expect(failure).toMatchObject({ code: "RESOURCE_LIMIT", stage: "convert", sourceId: "photo-2" });
        expect(adapter.assembleImagePdf).not.toHaveBeenCalled();
    });

    it("maps a PDF engine failure to the assemble stage with no output", async () => {
        wire([1]);
        vi.mocked(adapter.assembleImagePdf).mockRejectedValue(new WorkflowAdapterError("PROCESSING_FAILED", "engine stopped"));
        const failure = expectFailure(await run(heicRequest([1])).result);
        expect(failure).toMatchObject({ code: "PROCESSING_FAILED", stage: "assemble", message: "engine stopped" });
    });

    it("returns VERIFICATION_FAILED with the unmet checks when the PDF has the wrong page count", async () => {
        wire([1, 2, 3]);
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue(geometry(2, 10, 5));
        const failure = expectFailure(await run(heicRequest([1, 2, 3])).result);
        expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "verify" });
        expect(failure.unmetChecks?.map(check => check.name)).toContain("Page count");
    });

    it("returns VERIFICATION_FAILED when a page has the wrong size", async () => {
        wire([1, 2]);
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue({ pageCount: 2, page: [{ width: 10, height: 5, rotation: 0 }, { width: 99, height: 5, rotation: 0 }] });
        const failure = expectFailure(await run(heicRequest([1, 2])).result);
        expect(failure.unmetChecks).toEqual([expect.objectContaining({ name: "Pages with the expected size and rotation", expected: 2, observed: 1, passed: false })]);
    });

    it("reports CANCELLED with no output when the run is aborted during conversion", async () => {
        wire([1, 2]);
        const controller = new AbortController();
        vi.mocked(adapter.convertHeicPhoto).mockImplementation(async (_file, _ordinal, target) => {
            controller.abort();
            return { bytes: new Uint8Array([1]), format: target, width: 10, height: 10 };
        });
        const { result, progress } = run(heicRequest([1, 2]), controller.signal);
        const failure = expectFailure(await result);
        expect(failure).toMatchObject({ code: "CANCELLED", stage: "convert" });
        expect(adapter.assembleImagePdf).not.toHaveBeenCalled();
        expect(progress.at(-1)).toMatchObject({ state: "cancelled" });
    });

    it("treats an abort error from a processor as cancellation", async () => {
        wire([1]);
        vi.mocked(adapter.assembleImagePdf).mockRejectedValue(new DOMException("Operation cancelled", "AbortError"));
        const failure = expectFailure(await run(heicRequest([1])).result);
        expect(failure).toMatchObject({ code: "CANCELLED", stage: "assemble" });
    });

    it("never leaks internal error text for unexpected exceptions", async () => {
        wire([1]);
        vi.mocked(adapter.inspectHeicPhoto).mockRejectedValue(new Error("secret internal path C:/x/y"));
        const failure = expectFailure(await run(heicRequest([1])).result);
        expect(failure.code).toBe("PROCESSING_FAILED");
        expect(failure.message).not.toContain("secret");
    });
});

/* ---------- Assemble PDF packet ---------- */

describe("runWorkflow: assemble-pdf-packet", () => {
    const pdfFile = (name: string) => new File([new Uint8Array(200)], name, { type: "application/pdf" });
    const imageFile = (name: string) => new File([new Uint8Array(100)], name, { type: "image/png" });

    function packet(overrides: Partial<PacketRequest> = {}): PacketRequest {
        return {
            slug: "assemble-pdf-packet",
            sources: [
                { id: "cover letter", kind: "pdf", file: pdfFile("a.pdf") },
                { id: "scan", kind: "png", file: imageFile("b.png") },
                { id: "contract", kind: "pdf", file: pdfFile("c.pdf") },
            ],
            pageOrder: [
                { sourceId: "contract", pageNumber: 2 },
                { sourceId: "scan", pageNumber: 1 },
                { sourceId: "cover letter", pageNumber: 1 },
                { sourceId: "contract", pageNumber: 2 },
            ],
            tryLosslessCompression: false,
            ...overrides,
        };
    }

    function wire() {
        vi.mocked(adapter.inspectPdfSource).mockImplementation(async (file) => ({ bytes: new Uint8Array([file.name === "a.pdf" ? 1 : 3]), inspection: file.name === "a.pdf" ? geometry(2, 100, 200) : geometry(3, 300, 400, 90) }));
        vi.mocked(adapter.inspectPacketImage).mockResolvedValue({ bytes: new Uint8Array([2]), format: "png", width: 50, height: 60 });
        vi.mocked(adapter.assemblePacketPdf).mockResolvedValue(fakePdf(500));
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue({
            pageCount: 4,
            page: [
                { width: 300, height: 400, rotation: 90 },
                { width: 50, height: 60, rotation: 0 },
                { width: 100, height: 200, rotation: 0 },
                { width: 300, height: 400, rotation: 90 },
            ],
        });
    }

    it("maps public ids to worker ids in first-use order and keeps the page order, repeats included", async () => {
        wire();
        const { result, progress } = run(packet());
        const done = expectSuccess(await result);

        const [workerSource, workerOrder] = vi.mocked(adapter.assemblePacketPdf).mock.calls[0];
        expect(workerSource.map(source => [source.id, source.kind, source.bytes[0]])).toEqual([["s0", "pdf", 3], ["s1", "png", 2], ["s2", "pdf", 1]]);
        expect(workerOrder).toEqual([
            { sourceId: "s0", pageNumber: 2 },
            { sourceId: "s1", pageNumber: 1 },
            { sourceId: "s2", pageNumber: 1 },
            { sourceId: "s0", pageNumber: 2 },
        ]);
        expect(JSON.stringify(workerSource.map(source => source.id))).not.toContain("cover");
        expect(done.outputs[0]).toMatchObject({ name: "assembled-packet.pdf", mimeType: "application/pdf", sizeBytes: 500 });
        expect(passedStages(progress)).toEqual(["validate", "inspect", "select-pages", "assemble", "verify", "complete"]);
        expect(progress.find(item => item.stage === "compress")).toMatchObject({ state: "skipped" });
        expect(done.checks.find(check => check.name === "Lossless compression")).toMatchObject({ expected: "not requested", observed: "skipped" });
        expect(done.checks.find(check => check.name === "Pages with the expected size and rotation")).toMatchObject({ expected: 4, observed: 4, passed: true });
    });

    it("only sends referenced sources to the worker", async () => {
        wire();
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue(geometry(1, 100, 200));
        expectSuccess(await run(packet({ pageOrder: [{ sourceId: "cover letter", pageNumber: 1 }] })).result);
        expect(vi.mocked(adapter.assemblePacketPdf).mock.calls[0][0]).toHaveLength(1);
    });

    describe("compression", () => {
        it("uses the verified smaller result and reports the real saving", async () => {
            wire();
            vi.mocked(adapter.compressPacketPdf).mockResolvedValue({ status: "smaller", bytes: fakePdf(300), savedBytes: 200, percentage: 40 });
            const { result, progress } = run(packet({ tryLosslessCompression: true }));
            const done = expectSuccess(await result);
            expect(done.outputs[0].sizeBytes).toBe(300);
            expect(progress.find(item => item.stage === "compress" && item.state === "passed")?.description).toContain("Saved 200 bytes");
            expect(done.checks.find(check => check.name === "Lossless compression")).toMatchObject({ expected: "requested", observed: "saved 200 bytes" });
        });

        it("keeps the verified uncompressed packet and says so when nothing got smaller", async () => {
            wire();
            vi.mocked(adapter.compressPacketPdf).mockResolvedValue({ status: "no-reduction" });
            const { result, progress } = run(packet({ tryLosslessCompression: true }));
            const done = expectSuccess(await result);
            expect(done.outputs[0].sizeBytes).toBe(500);
            expect(progress.find(item => item.stage === "compress" && item.state === "passed")?.description).toContain("did not make the PDF smaller");
            expect(done.checks.find(check => check.name === "Lossless compression")?.observed).toBe("no reduction");
        });

        it("skips with an explicit reason, and never calls the compressor, above its 10 MiB boundary", async () => {
            wire();
            vi.mocked(adapter.assemblePacketPdf).mockResolvedValue(fakePdf(MAX_SINGLE_PDF_BYTES + 1));
            const { result, progress } = run(packet({ tryLosslessCompression: true }));
            const done = expectSuccess(await result);
            expect(adapter.compressPacketPdf).not.toHaveBeenCalled();
            const skipped = progress.find(item => item.stage === "compress");
            expect(skipped).toMatchObject({ state: "skipped" });
            expect(skipped?.description).toContain("10 MiB");
            expect(done.checks.find(check => check.name === "Lossless compression")?.observed).toContain("skipped");
        });

        it("attempts compression at exactly 10 MiB", async () => {
            wire();
            vi.mocked(adapter.assemblePacketPdf).mockResolvedValue(fakePdf(MAX_SINGLE_PDF_BYTES));
            vi.mocked(adapter.compressPacketPdf).mockResolvedValue({ status: "no-reduction" });
            expectSuccess(await run(packet({ tryLosslessCompression: true })).result);
            expect(adapter.compressPacketPdf).toHaveBeenCalledOnce();
        });

        it("returns a failure, not no-reduction, when the compressor's own verification fails", async () => {
            wire();
            vi.mocked(adapter.compressPacketPdf).mockRejectedValue(new WorkflowAdapterError("VERIFICATION_FAILED", "page check failed"));
            const failure = expectFailure(await run(packet({ tryLosslessCompression: true })).result);
            expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "compress" });
        });

        it("verifies the final bytes again after compression", async () => {
            wire();
            vi.mocked(adapter.compressPacketPdf).mockResolvedValue({ status: "smaller", bytes: fakePdf(300), savedBytes: 200, percentage: 40 });
            vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue(geometry(3));
            const failure = expectFailure(await run(packet({ tryLosslessCompression: true })).result);
            expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "verify" });
            expect(vi.mocked(adapter.inspectGeneratedPdf).mock.calls[0][0]).toHaveLength(300);
        });
    });

    describe("validation (nothing is processed)", () => {
        const base = packet();
        it.each([
            ["no sources", { sources: [] }, "INVALID_INPUT"],
            ["no pages", { pageOrder: [] }, "INVALID_INPUT"],
            ["a duplicate source id", { sources: [base.sources[0], { ...base.sources[1], id: base.sources[0].id }] }, "INVALID_INPUT"],
            ["an empty source id", { sources: [{ ...base.sources[0], id: "" }] }, "INVALID_INPUT"],
            ["an unknown kind", { sources: [{ ...base.sources[0], kind: "docx" as unknown as "pdf" }] }, "INVALID_INPUT"],
            ["a page of an unknown source", { pageOrder: [{ sourceId: "missing", pageNumber: 1 }] }, "INVALID_INPUT"],
            ["page 0", { pageOrder: [{ sourceId: "scan", pageNumber: 0 }] }, "INVALID_INPUT"],
            ["a negative page", { pageOrder: [{ sourceId: "scan", pageNumber: -1 }] }, "INVALID_INPUT"],
            ["a fractional page", { pageOrder: [{ sourceId: "scan", pageNumber: 1.5 }] }, "INVALID_INPUT"],
            ["a non-boolean compression flag", { tryLosslessCompression: "yes" as unknown as boolean }, "INVALID_INPUT"],
            ["101 requested pages", { pageOrder: Array.from({ length: 101 }, () => ({ sourceId: "scan", pageNumber: 1 })) }, "PAGE_LIMIT"],
            ["11 PDFs", { sources: Array.from({ length: 11 }, (_, index) => ({ id: `p${index}`, kind: "pdf" as const, file: pdfFile(`p${index}.pdf`) })), pageOrder: [{ sourceId: "p0", pageNumber: 1 }] }, "SOURCE_LIMIT"],
            ["21 images", { sources: Array.from({ length: 21 }, (_, index) => ({ id: `i${index}`, kind: "png" as const, file: imageFile(`i${index}.png`) })), pageOrder: [{ sourceId: "i0", pageNumber: 1 }] }, "SOURCE_LIMIT"],
            ["a PDF over 10 MiB", { sources: [{ id: "big", kind: "pdf" as const, file: withSize(pdfFile("big.pdf"), MAX_SINGLE_PDF_BYTES + 1) }], pageOrder: [{ sourceId: "big", pageNumber: 1 }] }, "SOURCE_LIMIT"],
            ["an empty file", { sources: [{ id: "none", kind: "pdf" as const, file: new File([], "n.pdf") }], pageOrder: [{ sourceId: "none", pageNumber: 1 }] }, "INVALID_INPUT"],
            ["sources over 25 MiB together", { sources: [0, 1, 2].map(index => ({ id: `s${index}`, kind: "pdf" as const, file: withSize(pdfFile(`s${index}.pdf`), 9_000_000) })), pageOrder: [{ sourceId: "s0", pageNumber: 1 }] }, "SOURCE_LIMIT"],
        ] as Array<[string, Partial<PacketRequest>, string]>)("rejects %s at validate", async (_label, overrides, code) => {
            const { result, progress } = run(packet(overrides));
            const failure = expectFailure(await result);
            expect(failure).toMatchObject({ code, stage: "validate" });
            expect(adapter.inspectPdfSource).not.toHaveBeenCalled();
            expect(adapter.assemblePacketPdf).not.toHaveBeenCalled();
            expect(progress.at(-1)).toMatchObject({ stage: "validate", state: "failed" });
        });

        it("carries the source id on id-specific failures", async () => {
            const duplicate = expectFailure(await run(packet({ sources: [base.sources[0], { ...base.sources[1], id: base.sources[0].id }] })).result);
            expect(duplicate.sourceId).toBe("cover letter");
            const missing = expectFailure(await run(packet({ pageOrder: [{ sourceId: "missing", pageNumber: 1 }] })).result);
            expect(missing.sourceId).toBe("missing");
        });
    });

    describe("page references checked against the real sources", () => {
        it("rejects a page beyond a PDF's real page count with the source id", async () => {
            wire();
            const failure = expectFailure(await run(packet({ pageOrder: [{ sourceId: "cover letter", pageNumber: 3 }] })).result);
            expect(failure).toMatchObject({ code: "INVALID_INPUT", stage: "select-pages", sourceId: "cover letter" });
            expect(failure.message).toContain("2 pages");
            expect(adapter.assemblePacketPdf).not.toHaveBeenCalled();
        });

        it("rejects page 2 of an image", async () => {
            wire();
            const failure = expectFailure(await run(packet({ pageOrder: [{ sourceId: "scan", pageNumber: 2 }] })).result);
            expect(failure).toMatchObject({ code: "INVALID_INPUT", stage: "select-pages", sourceId: "scan" });
        });

        it("accepts the last page of a PDF", async () => {
            wire();
            vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue({ pageCount: 1, page: [{ width: 300, height: 400, rotation: 90 }] });
            expectSuccess(await run(packet({ pageOrder: [{ sourceId: "contract", pageNumber: 3 }] })).result);
        });
    });

    it("fails at inspect for a corrupt, encrypted or mismatched source and keeps its id", async () => {
        wire();
        vi.mocked(adapter.inspectPdfSource).mockRejectedValueOnce(new WorkflowAdapterError("UNSUPPORTED_FORMAT", "Source: encrypted", "cover letter"));
        const failure = expectFailure(await run(packet()).result);
        expect(failure).toMatchObject({ code: "UNSUPPORTED_FORMAT", stage: "inspect", sourceId: "cover letter" });
        expect(adapter.assemblePacketPdf).not.toHaveBeenCalled();
    });

    it("maps a worker failure to the assemble stage with no partial packet", async () => {
        wire();
        vi.mocked(adapter.assemblePacketPdf).mockRejectedValue(new WorkflowAdapterError("PROCESSING_FAILED", "engine stopped"));
        const { result, progress } = run(packet());
        expect(expectFailure(await result)).toMatchObject({ code: "PROCESSING_FAILED", stage: "assemble" });
        expect(adapter.inspectGeneratedPdf).not.toHaveBeenCalled();
        expect(progress.at(-1)).toMatchObject({ stage: "assemble", state: "failed" });
    });

    it("fails verification when the packet geometry or rotation differs from the sources", async () => {
        wire();
        vi.mocked(adapter.inspectGeneratedPdf).mockResolvedValue({
            pageCount: 4,
            page: [
                { width: 300, height: 400, rotation: 0 },
                { width: 50, height: 60, rotation: 0 },
                { width: 100, height: 200, rotation: 0 },
                { width: 300, height: 400, rotation: 90 },
            ],
        });
        const failure = expectFailure(await run(packet()).result);
        expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "verify" });
        expect(failure.unmetChecks).toEqual([expect.objectContaining({ observed: 3, expected: 4 })]);
    });

    it("reports CANCELLED with no output when aborted while assembling", async () => {
        wire();
        const controller = new AbortController();
        vi.mocked(adapter.assemblePacketPdf).mockImplementation(async () => {
            controller.abort();
            return fakePdf(500);
        });
        const failure = expectFailure(await run(packet(), controller.signal).result);
        expect(failure).toMatchObject({ code: "CANCELLED", stage: "assemble" });
        expect(adapter.inspectGeneratedPdf).not.toHaveBeenCalled();
    });
});

/* ---------- PDF pages for slides ---------- */

describe("runWorkflow: pdf-pages-for-slides", () => {
    const slides = (overrides: Partial<SlidesRequest> = {}): SlidesRequest => ({
        slug: "pdf-pages-for-slides",
        source: new File([new Uint8Array(100)], "Quarterly Report.pdf", { type: "application/pdf" }),
        pageNumbersInOutputOrder: [3, 1],
        format: "png",
        dpi: 72,
        jpegQuality: 0.85,
        ...overrides,
    });

    function wire(options: { format?: "png" | "jpeg"; width?: number; height?: number; blobSize?: number } = {}) {
        const { format = "png", width = 612, height = 792, blobSize = 5000 } = options;
        vi.mocked(adapter.inspectPdfSource).mockResolvedValue({ bytes: fakePdf(), inspection: geometry(5, 612, 792) });
        vi.mocked(adapter.renderPdfPages).mockImplementation(async (_bytes, page) => page.map(pageNumber => ({
            pageNumber, format, width, height, blob: new Blob([new Uint8Array(blobSize)], { type: `image/${format}` }),
        })));
        vi.mocked(adapter.measureBlob).mockImplementation(async blob => ({ detectedMimeType: blob.type || null, width, height, byteLength: blob.size }));
    }

    it("renders pages in the requested order and returns one named artifact per page with its source page", async () => {
        wire();
        const { result, progress } = run(slides());
        const done = expectSuccess(await result);

        expect(vi.mocked(adapter.renderPdfPages).mock.calls[0][1]).toEqual([3, 1]);
        expect(vi.mocked(adapter.renderPdfPages).mock.calls[0][2]).toEqual({ format: "png", dpi: 72, quality: 0.85 });
        expect(done.outputs.map(output => [output.name, output.sourcePageNumber, output.width, output.height, output.mimeType, output.sizeBytes])).toEqual([
            ["Quarterly Report-page-003.png", 3, 612, 792, "image/png", 5000],
            ["Quarterly Report-page-001.png", 1, 612, 792, "image/png", 5000],
        ]);
        expect(passedStages(progress)).toEqual(["validate", "inspect", "select-pages", "render", "verify", "complete"]);
        expect(done.checks.every(check => check.passed)).toBe(true);
    });

    it("passes the JPEG quality fraction and the chosen DPI to the existing renderer", async () => {
        wire({ format: "jpeg", width: 1275, height: 1650 });
        const done = expectSuccess(await run(slides({ format: "jpeg", dpi: 150, jpegQuality: 0.6 })).result);
        expect(vi.mocked(adapter.renderPdfPages).mock.calls[0][2]).toEqual({ format: "jpeg", dpi: 150, quality: 0.6 });
        expect(done.outputs[0]).toMatchObject({ mimeType: "image/jpeg", name: "Quarterly Report-page-003.jpg" });
    });

    it("expects swapped dimensions for a page rotated by 90 degrees", async () => {
        wire({ width: 792, height: 612 });
        vi.mocked(adapter.inspectPdfSource).mockResolvedValue({ bytes: fakePdf(), inspection: geometry(5, 612, 792, 90) });
        expectSuccess(await run(slides()).result);
    });

    it("fails verification when a rendered size does not match the selected DPI", async () => {
        wire({ width: 612, height: 792 });
        const failure = expectFailure(await run(slides({ dpi: 150 })).result);
        expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "verify" });
        expect(failure.unmetChecks?.[0].expected).toContain("1275 x 1650");
    });

    it("fails verification when an output has the wrong format", async () => {
        wire();
        vi.mocked(adapter.measureBlob).mockResolvedValue({ detectedMimeType: "image/jpeg", width: 612, height: 792, byteLength: 5000 });
        const failure = expectFailure(await run(slides()).result);
        expect(failure).toMatchObject({ code: "VERIFICATION_FAILED", stage: "verify" });
    });

    it("returns UNMET_REQUIREMENT with every failing page and no images when a byte cap is missed", async () => {
        wire({ blobSize: 5000 });
        const failure = expectFailure(await run(slides({ maxBytesPerImage: 4999 })).result);
        expect(failure).toMatchObject({ code: "UNMET_REQUIREMENT", stage: "verify" });
        expect(failure.unmetChecks).toEqual([
            expect.objectContaining({ name: "Slide 1: size in bytes", expected: "at most 4999", observed: 5000, passed: false }),
            expect.objectContaining({ name: "Slide 2: size in bytes", passed: false }),
        ]);
        expect(adapter.renderPdfPages).toHaveBeenCalledTimes(1);
    });

    it("accepts a cap that equals the observed size", async () => {
        wire({ blobSize: 5000 });
        const done = expectSuccess(await run(slides({ maxBytesPerImage: 5000 })).result);
        expect(done.checks.filter(check => check.name.endsWith("size in bytes"))).toHaveLength(2);
    });

    describe("validation (nothing is processed)", () => {
        it.each([
            ["no pages", { pageNumbersInOutputOrder: [] }, "INVALID_INPUT"],
            ["a repeated page", { pageNumbersInOutputOrder: [2, 2] }, "INVALID_INPUT"],
            ["page 0", { pageNumbersInOutputOrder: [0] }, "INVALID_INPUT"],
            ["a fractional page", { pageNumbersInOutputOrder: [1.5] }, "INVALID_INPUT"],
            ["21 pages", { pageNumbersInOutputOrder: Array.from({ length: 21 }, (_, index) => index + 1) }, "PAGE_LIMIT"],
            ["an unknown format", { format: "gif" as unknown as "png" }, "INVALID_INPUT"],
            ["a DPI that is not offered", { dpi: 100 as unknown as 72 }, "INVALID_INPUT"],
            ["JPEG quality below 0.50", { format: "jpeg" as const, jpegQuality: 0.49 }, "INVALID_INPUT"],
            ["JPEG quality above 1", { format: "jpeg" as const, jpegQuality: 1.01 }, "INVALID_INPUT"],
            ["JPEG quality that is not finite", { format: "jpeg" as const, jpegQuality: Number.NaN }, "INVALID_INPUT"],
            ["a zero byte cap", { maxBytesPerImage: 0 }, "INVALID_INPUT"],
            ["a fractional byte cap", { maxBytesPerImage: 10.5 }, "INVALID_INPUT"],
            ["a missing source", { source: undefined as unknown as File }, "INVALID_INPUT"],
        ] as Array<[string, Partial<SlidesRequest>, string]>)("rejects %s at validate", async (_label, overrides, code) => {
            const { result, progress } = run(slides(overrides));
            expect(expectFailure(await result)).toMatchObject({ code, stage: "validate" });
            expect(adapter.inspectPdfSource).not.toHaveBeenCalled();
            expect(adapter.renderPdfPages).not.toHaveBeenCalled();
            expect(progress.at(-1)).toMatchObject({ stage: "validate", state: "failed" });
        });

        it("ignores the JPEG quality when the format is PNG", async () => {
            wire();
            expectSuccess(await run(slides({ jpegQuality: 7 })).result);
            expect(vi.mocked(adapter.renderPdfPages).mock.calls[0][2].quality).toBe(0.85);
        });

        it("accepts the boundary values 0.50 and 1.00 and exactly 20 pages", async () => {
            wire({ format: "jpeg" });
            const pages = Array.from({ length: 20 }, (_, index) => index + 1);
            vi.mocked(adapter.inspectPdfSource).mockResolvedValue({ bytes: fakePdf(), inspection: geometry(20, 612, 792) });
            expectSuccess(await run(slides({ format: "jpeg", jpegQuality: 0.5, pageNumbersInOutputOrder: pages })).result);
            expectSuccess(await run(slides({ format: "jpeg", jpegQuality: 1, pageNumbersInOutputOrder: [1] })).result);
        });
    });

    it("rejects a page beyond the real page count at select-pages", async () => {
        wire();
        const failure = expectFailure(await run(slides({ pageNumbersInOutputOrder: [5, 6] })).result);
        expect(failure).toMatchObject({ code: "INVALID_INPUT", stage: "select-pages" });
        expect(failure.message).toContain("page 6");
        expect(adapter.renderPdfPages).not.toHaveBeenCalled();
    });

    it("passes through a typed failure for an unsupported source", async () => {
        vi.mocked(adapter.inspectPdfSource).mockRejectedValue(new WorkflowAdapterError("PAGE_LIMIT", "This PDF exceeds the 100-page limit."));
        expect(expectFailure(await run(slides()).result)).toMatchObject({ code: "PAGE_LIMIT", stage: "inspect" });
    });

    it("passes through a render-limit failure at the render stage with no images", async () => {
        wire();
        vi.mocked(adapter.renderPdfPages).mockRejectedValue(new WorkflowAdapterError("RESOURCE_LIMIT", "exceeds the 4096-pixel side"));
        expect(expectFailure(await run(slides({ dpi: 300 })).result)).toMatchObject({ code: "RESOURCE_LIMIT", stage: "render" });
    });

    it("reports CANCELLED with no images when aborted while rendering", async () => {
        wire();
        const controller = new AbortController();
        vi.mocked(adapter.renderPdfPages).mockImplementation(async () => {
            controller.abort();
            throw new DOMException("Operation cancelled", "AbortError");
        });
        const { result, progress } = run(slides(), controller.signal);
        expect(expectFailure(await result)).toMatchObject({ code: "CANCELLED", stage: "render" });
        expect(progress.at(-1)).toMatchObject({ state: "cancelled" });
    });

    it("does not return success when cancellation races the last verification", async () => {
        wire();
        const controller = new AbortController();
        vi.mocked(adapter.measureBlob).mockImplementation(async blob => {
            controller.abort();
            return { detectedMimeType: blob.type, width: 612, height: 792, byteLength: blob.size };
        });
        expect(expectFailure(await run(slides(), controller.signal).result)).toMatchObject({ code: "CANCELLED" });
    });
});
