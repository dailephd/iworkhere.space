import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adapter from "./adapters.client";
import { WorkflowAdapterError } from "./adapters.client";
import { inspectWorkflowSource, runWorkflow } from "./runner.client";
import type { WorkflowProgress, WorkflowRequest, WorkflowRunResult } from "./type";

vi.mock("./adapters.client", async importOriginal => {
    const actual = await importOriginal<typeof import("./adapters.client")>();
    return {
        ...actual,
        readSourceFormat: vi.fn(),
        inspectSource: vi.fn(),
        convertTo: vi.fn(),
        resizeTo: vi.fn(),
        compressTo: vi.fn(),
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

type PrepareRequest = Extract<WorkflowRequest, { slug: "prepare-image-for-upload" }>;
type SourceFormat = "jpeg" | "png" | "webp";

const MIME: Record<SourceFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const dimensionOf = new Map<Blob, { width: number; height: number }>();

/** Builds a File of an exact byte size whose decoded dimensions the mocked measurer reports. */
function makeFile(sizeBytes: number, format: SourceFormat, width: number, height: number, name = "photo.jpg"): File {
    const file = new File([new Uint8Array(sizeBytes)], name, { type: MIME[format] });
    dimensionOf.set(file, { width, height });
    return file;
}

function request(source: File, overrides: Partial<PrepareRequest> = {}): PrepareRequest {
    return { slug: "prepare-image-for-upload", source, targetFormat: "jpeg", maxWidth: 800, maxHeight: 600, maxBytes: 100_000, ...overrides };
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

function wireDefaultAdapter(sourceFormat: SourceFormat) {
    vi.mocked(adapter.readSourceFormat).mockResolvedValue(sourceFormat);
    vi.mocked(adapter.inspectSource).mockImplementation(async (file, format) => {
        const dimension = dimensionOf.get(file) ?? { width: 0, height: 0 };
        return { format, ...dimension, sizeBytes: file.size };
    });
    vi.mocked(adapter.measureBlob).mockImplementation(async blob => {
        const dimension = dimensionOf.get(blob) ?? { width: 0, height: 0 };
        return { detectedMimeType: blob.type || null, ...dimension, byteLength: blob.size };
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    dimensionOf.clear();
});

describe("runWorkflow: request validation (no processing on invalid input)", () => {
    const source = () => makeFile(1000, "jpeg", 100, 100);
    const invalidCase: Array<[string, Partial<PrepareRequest>]> = [
        ["zero width", { maxWidth: 0 }],
        ["negative height", { maxHeight: -5 }],
        ["fractional width", { maxWidth: 800.5 }],
        ["NaN height", { maxHeight: Number.NaN }],
        ["Infinity width", { maxWidth: Number.POSITIVE_INFINITY }],
        ["unsafe integer bytes", { maxBytes: 2 ** 53 }],
        ["zero bytes", { maxBytes: 0 }],
        ["fractional bytes", { maxBytes: 99.5 }],
        ["unknown target format", { targetFormat: "gif" as unknown as PrepareRequest["targetFormat"] }],
        ["missing source", { source: undefined as unknown as File }],
        ["non-file source", { source: {} as unknown as File }],
    ];

    it.each(invalidCase)("rejects %s as INVALID_INPUT at validate before reading the file", async (_label, overrides) => {
        wireDefaultAdapter("jpeg");
        const { result, progress } = run(request(source(), overrides));
        const failure = expectFailure(await result);
        expect(failure.code).toBe("INVALID_INPUT");
        expect(failure.stage).toBe("validate");
        expect(adapter.readSourceFormat).not.toHaveBeenCalled();
        expect(adapter.inspectSource).not.toHaveBeenCalled();
        expect(progress.map(item => `${item.stage}:${item.state}`)).toEqual(["validate:running", "validate:failed"]);
    });

    it("maps empty, oversize, unsupported and over-limit sources to their frozen codes and stages", async () => {
        const cases: Array<[() => void, string, string]> = [
            [() => vi.mocked(adapter.readSourceFormat).mockRejectedValue(new WorkflowAdapterError("INVALID_INPUT", "empty")), "INVALID_INPUT", "validate"],
            [() => vi.mocked(adapter.readSourceFormat).mockRejectedValue(new WorkflowAdapterError("SOURCE_LIMIT", "too big")), "SOURCE_LIMIT", "validate"],
            [() => vi.mocked(adapter.readSourceFormat).mockRejectedValue(new WorkflowAdapterError("UNSUPPORTED_FORMAT", "not an image")), "UNSUPPORTED_FORMAT", "validate"],
            [() => { vi.mocked(adapter.readSourceFormat).mockResolvedValue("jpeg"); vi.mocked(adapter.inspectSource).mockRejectedValue(new WorkflowAdapterError("RESOURCE_LIMIT", "30 MP")); }, "RESOURCE_LIMIT", "inspect"],
            [() => { vi.mocked(adapter.readSourceFormat).mockResolvedValue("jpeg"); vi.mocked(adapter.inspectSource).mockRejectedValue(new WorkflowAdapterError("PROCESSING_FAILED", "cannot decode")); }, "PROCESSING_FAILED", "inspect"],
        ];
        for (const [arrange, code, stage] of cases) {
            vi.resetAllMocks();
            arrange();
            const failure = expectFailure(await run(request(source())).result);
            expect([failure.code, failure.stage]).toEqual([code, stage]);
            expect(adapter.convertTo).not.toHaveBeenCalled();
        }
    });
});

describe("runWorkflow: successful paths", () => {
    it("preserves an already compliant source without encoding and skips three stages with reasons", async () => {
        wireDefaultAdapter("jpeg");
        const source = makeFile(50_000, "jpeg", 640, 480, "holiday.jpeg");
        const { result, progress } = run(request(source));
        const outcome = await result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(outcome.outputs).toHaveLength(1);
        expect(outcome.outputs[0].blob).toBe(source);
        expect(outcome.outputs[0]).toMatchObject({ name: "holiday-prepared.jpg", mimeType: "image/jpeg", sizeBytes: 50_000, width: 640, height: 480 });
        expect(outcome.checks.every(check => check.passed)).toBe(true);
        for (const encode of [adapter.convertTo, adapter.resizeTo, adapter.compressTo]) expect(encode).not.toHaveBeenCalled();
        const skipped = progress.filter(item => item.state === "skipped");
        expect(skipped.map(item => item.stage)).toEqual(["convert", "resize", "compress"]);
        for (const item of skipped) expect(item.description).toMatch(/^Skipped: /);
    });

    it("reports ordered progress with a monotonic completed count and a fixed total of seven", async () => {
        wireDefaultAdapter("jpeg");
        const { result, progress } = run(request(makeFile(1000, "jpeg", 10, 10)));
        await result;
        const order = ["validate", "inspect", "convert", "resize", "compress", "verify", "complete"];
        const seen = progress.map(item => item.stage).filter((stage, index, all) => all.indexOf(stage) === index);
        expect(seen).toEqual(order);
        expect(progress.every(item => item.total === 7)).toBe(true);
        const completed = progress.map(item => item.completed);
        expect([...completed].sort((a, b) => a - b)).toEqual(completed);
        expect(progress.at(-1)).toMatchObject({ stage: "complete", state: "passed", completed: 7 });
        expect(progress.at(0)).toMatchObject({ stage: "validate", state: "running", completed: 0 });
    });

    it("converts PNG to JPEG through the existing converter in the selected format only", async () => {
        wireDefaultAdapter("png");
        const source = makeFile(80_000, "png", 400, 300, "logo.png");
        const converted = makeFile(20_000, "jpeg", 400, 300, "logo.png");
        vi.mocked(adapter.convertTo).mockResolvedValue(converted);
        const outcome = await run(request(source, { targetFormat: "jpeg" })).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(adapter.convertTo).toHaveBeenCalledOnce();
        expect(adapter.convertTo).toHaveBeenCalledWith(source, "jpeg");
        expect(adapter.resizeTo).not.toHaveBeenCalled();
        expect(outcome.outputs[0]).toMatchObject({ name: "logo-prepared.jpg", mimeType: "image/jpeg", sizeBytes: 20_000 });
    });

    it.each([
        [1600, 1200, 800, 600, { width: 800, height: 600 }],
        [4000, 1000, 800, 600, { width: 800, height: 200 }],
        [1000, 333, 500, 500, { width: 500, height: 166 }],
        [600, 1800, 800, 600, { width: 200, height: 600 }],
    ])("resizes %ix%i to fit %ix%i preserving aspect ratio: %o", async (width, height, maxWidth, maxHeight, expected) => {
        wireDefaultAdapter("jpeg");
        const source = makeFile(300_000, "jpeg", width, height);
        const resized = makeFile(40_000, "jpeg", expected.width, expected.height);
        vi.mocked(adapter.resizeTo).mockResolvedValue(resized);
        const outcome = await run(request(source, { maxWidth, maxHeight })).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(adapter.resizeTo).toHaveBeenCalledOnce();
        expect(adapter.resizeTo).toHaveBeenCalledWith(source, "jpeg", expected);
        expect(expected.width).toBeLessThanOrEqual(maxWidth);
        expect(expected.height).toBeLessThanOrEqual(maxHeight);
    });

    it("never upscales an image smaller than both bounds", async () => {
        wireDefaultAdapter("webp");
        const source = makeFile(30_000, "webp", 120, 80, "tiny.webp");
        const outcome = await run(request(source, { targetFormat: "webp", maxWidth: 4000, maxHeight: 4000 })).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(adapter.resizeTo).not.toHaveBeenCalled();
        expect(outcome.outputs[0]).toMatchObject({ width: 120, height: 80 });
    });
});

describe("runWorkflow: bounded byte-limit search", () => {
    it("tries higher quality before lower and stops at the first output within the cap", async () => {
        wireDefaultAdapter("jpeg");
        const source = makeFile(500_000, "jpeg", 800, 600);
        const size: Record<number, number> = { 70: 150_000, 45: 90_000, 20: 40_000 };
        vi.mocked(adapter.compressTo).mockImplementation(async (_file, _format, quality) => makeFile(size[quality], "jpeg", 800, 600));
        const outcome = await run(request(source)).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(vi.mocked(adapter.compressTo).mock.calls.map(call => call[2])).toEqual([70, 45]);
        expect(outcome.outputs[0].sizeBytes).toBe(90_000);
        expect(outcome.checks.find(check => check.name === "Output size in bytes")).toMatchObject({ passed: true, observed: 90_000 });
    });

    it("prefers larger dimensions: smaller dimensions are tried only after every quality at the legal size", async () => {
        wireDefaultAdapter("jpeg");
        const source = makeFile(900_000, "jpeg", 800, 600);
        vi.mocked(adapter.compressTo).mockImplementation(async (file) => makeFile(file.size - 1, "jpeg", 800, 600));
        vi.mocked(adapter.resizeTo).mockImplementation(async (_file, _format, dimension) => makeFile(60_000, "jpeg", dimension.width, dimension.height));
        const outcome = await run(request(source, { maxBytes: 70_000 })).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(vi.mocked(adapter.compressTo).mock.calls.map(call => call[2])).toEqual([70, 45, 20]);
        expect(adapter.resizeTo).toHaveBeenCalledWith(expect.anything(), "jpeg", { width: 600, height: 450 });
        expect(outcome.outputs[0]).toMatchObject({ width: 600, height: 450, sizeBytes: 60_000 });
    });

    it("never exceeds twelve encodes in total and returns UNMET_REQUIREMENT with measured failing checks and no output", async () => {
        wireDefaultAdapter("png");
        const source = makeFile(900_000, "png", 2000, 1500, "big.png");
        const huge = (width: number, height: number) => makeFile(400_000, "jpeg", width, height);
        vi.mocked(adapter.convertTo).mockImplementation(async () => huge(2000, 1500));
        vi.mocked(adapter.resizeTo).mockImplementation(async (_file, _format, dimension) => huge(dimension.width, dimension.height));
        vi.mocked(adapter.compressTo).mockImplementation(async file => makeFile(Math.max(1, file.size - 1000), "jpeg", dimensionOf.get(file)!.width, dimensionOf.get(file)!.height));
        const { result, progress } = run(request(source, { maxBytes: 100 }));
        const failure = expectFailure(await result);
        const encodes = vi.mocked(adapter.convertTo).mock.calls.length + vi.mocked(adapter.resizeTo).mock.calls.length + vi.mocked(adapter.compressTo).mock.calls.length;
        expect(encodes).toBeLessThanOrEqual(12);
        expect(encodes).toBe(12);
        expect(failure.code).toBe("UNMET_REQUIREMENT");
        expect(failure.stage).toBe("compress");
        expect(failure.message).toContain("100 bytes");
        expect(failure.unmetChecks?.map(check => check.name)).toContain("Output size in bytes");
        expect(failure.unmetChecks?.every(check => !check.passed)).toBe(true);
        expect(progress.at(-1)).toMatchObject({ stage: "compress", state: "failed" });
        expect(progress.some(item => item.stage === "verify")).toBe(false);
    });

    it("keeps PNG as PNG, never uses a quality control and only tries smaller legal dimensions", async () => {
        wireDefaultAdapter("png");
        const source = makeFile(700_000, "png", 1600, 1200, "shot.png");
        vi.mocked(adapter.resizeTo).mockImplementation(async (_file, format, dimension) => {
            expect(format).toBe("png");
            return makeFile(Math.round(dimension.width * dimension.height / 10), "png", dimension.width, dimension.height);
        });
        const outcome = await run(request(source, { targetFormat: "png", maxBytes: 40_000 })).result;
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        expect(adapter.compressTo).not.toHaveBeenCalled();
        expect(adapter.convertTo).not.toHaveBeenCalled();
        expect(outcome.outputs[0].mimeType).toBe("image/png");
        expect(outcome.outputs[0].name).toBe("shot-prepared.png");
        expect(outcome.outputs[0].sizeBytes).toBeLessThanOrEqual(40_000);
    });

    it("fails an impossible PNG byte cap within the encode budget instead of switching format", async () => {
        wireDefaultAdapter("png");
        const source = makeFile(700_000, "png", 1600, 1200, "shot.png");
        vi.mocked(adapter.resizeTo).mockImplementation(async (_file, _format, dimension) => makeFile(500_000, "png", dimension.width, dimension.height));
        const failure = expectFailure(await run(request(source, { targetFormat: "png", maxBytes: 10 })).result);
        expect(failure.code).toBe("UNMET_REQUIREMENT");
        expect(adapter.compressTo).not.toHaveBeenCalled();
        expect(vi.mocked(adapter.resizeTo).mock.calls.length).toBeLessThanOrEqual(12);
        for (const call of vi.mocked(adapter.resizeTo).mock.calls) expect(call[1]).toBe("png");
    });
});

describe("runWorkflow: independent verification", () => {
    it("fails with VERIFICATION_FAILED and no output when the measured format is not the selected one", async () => {
        wireDefaultAdapter("jpeg");
        vi.mocked(adapter.measureBlob).mockResolvedValue({ detectedMimeType: "image/png", width: 100, height: 100, byteLength: 1000 });
        const { result, progress } = run(request(makeFile(1000, "jpeg", 100, 100)));
        const failure = expectFailure(await result);
        expect(failure.code).toBe("VERIFICATION_FAILED");
        expect(failure.stage).toBe("verify");
        expect(failure.unmetChecks?.map(check => check.name)).toEqual(["Output format"]);
        expect(progress.at(-1)).toMatchObject({ stage: "verify", state: "failed" });
    });

    it("fails when the measured dimensions exceed the bounds even if the plan said they fit", async () => {
        wireDefaultAdapter("jpeg");
        vi.mocked(adapter.measureBlob).mockResolvedValue({ detectedMimeType: "image/jpeg", width: 801, height: 600, byteLength: 1000 });
        const failure = expectFailure(await run(request(makeFile(1000, "jpeg", 100, 100))).result);
        expect(failure.code).toBe("VERIFICATION_FAILED");
        expect(failure.unmetChecks?.map(check => check.name)).toEqual(["Output width in pixels"]);
    });

    it("fails when the bytes read back differ from the reported blob size or the output is empty", async () => {
        wireDefaultAdapter("jpeg");
        vi.mocked(adapter.measureBlob).mockResolvedValue({ detectedMimeType: "image/jpeg", width: 100, height: 100, byteLength: 999 });
        const mismatch = expectFailure(await run(request(makeFile(1000, "jpeg", 100, 100))).result);
        expect(mismatch.unmetChecks?.map(check => check.name)).toEqual(["Reported size matches output bytes"]);
        vi.mocked(adapter.measureBlob).mockResolvedValue({ detectedMimeType: "image/jpeg", width: 0, height: 0, byteLength: 0 });
        const empty = expectFailure(await run(request(makeFile(1000, "jpeg", 100, 100))).result);
        expect(empty.unmetChecks?.map(check => check.name)).toContain("Output is not empty");
    });
});

describe("runWorkflow: cancellation and typed processing failures", () => {
    it("returns CANCELLED at validate when already aborted, with no adapter call", async () => {
        wireDefaultAdapter("jpeg");
        const controller = new AbortController();
        controller.abort();
        const { result, progress } = run(request(makeFile(1000, "jpeg", 10, 10)), controller.signal);
        const failure = expectFailure(await result);
        expect([failure.code, failure.stage]).toEqual(["CANCELLED", "validate"]);
        expect(adapter.readSourceFormat).not.toHaveBeenCalled();
        expect(progress.at(-1)).toMatchObject({ stage: "validate", state: "cancelled" });
    });

    it("stops at the next checkpoint when aborted during conversion and offers no output", async () => {
        wireDefaultAdapter("png");
        const controller = new AbortController();
        vi.mocked(adapter.convertTo).mockImplementation(async () => {
            controller.abort();
            return makeFile(10_000, "jpeg", 100, 100);
        });
        const { result, progress } = run(request(makeFile(50_000, "png", 100, 100, "a.png")), controller.signal);
        const failure = expectFailure(await result);
        expect([failure.code, failure.stage]).toEqual(["CANCELLED", "convert"]);
        expect(progress.at(-1)).toMatchObject({ stage: "convert", state: "cancelled" });
        expect(adapter.measureBlob).not.toHaveBeenCalled();
        expect(adapter.resizeTo).not.toHaveBeenCalled();
    });

    it("maps encoder errors to PROCESSING_FAILED at the stage that failed", async () => {
        wireDefaultAdapter("png");
        vi.mocked(adapter.convertTo).mockRejectedValue(new WorkflowAdapterError("PROCESSING_FAILED", "The browser could not produce a valid JPEG result."));
        const failure = expectFailure(await run(request(makeFile(50_000, "png", 100, 100))).result);
        expect([failure.code, failure.stage]).toEqual(["PROCESSING_FAILED", "convert"]);
        expect(failure.message).toContain("valid JPEG");
    });

    it("replaces unexpected errors with a generic message that never echoes error text or file bytes", async () => {
        wireDefaultAdapter("jpeg");
        const secret = "SECRET-FILE-BYTES-0xDEADBEEF";
        vi.mocked(adapter.measureBlob).mockRejectedValue(new Error(secret));
        const failure = expectFailure(await run(request(makeFile(1000, "jpeg", 10, 10, `${secret}.jpg`))).result);
        expect(failure.code).toBe("PROCESSING_FAILED");
        expect(JSON.stringify(failure)).not.toContain(secret);
    });
});

describe("inspectWorkflowSource", () => {
    it("returns facts for a valid file and a typed failure otherwise, never throwing", async () => {
        const file = makeFile(1234, "png", 20, 10);
        vi.mocked(adapter.readSourceFormat).mockResolvedValue("png");
        vi.mocked(adapter.inspectSource).mockResolvedValue({ format: "png", width: 20, height: 10, sizeBytes: 1234 });
        expect(await inspectWorkflowSource(file)).toEqual({ ok: true, source: { format: "png", width: 20, height: 10, sizeBytes: 1234 } });
        vi.mocked(adapter.readSourceFormat).mockRejectedValue(new WorkflowAdapterError("UNSUPPORTED_FORMAT", "nope"));
        expect(await inspectWorkflowSource(file)).toEqual({ ok: false, code: "UNSUPPORTED_FORMAT", message: "nope" });
        vi.mocked(adapter.readSourceFormat).mockRejectedValue(new Error("boom"));
        expect(await inspectWorkflowSource(file)).toEqual({ ok: false, code: "PROCESSING_FAILED", message: "The browser could not read this image." });
    });
});
