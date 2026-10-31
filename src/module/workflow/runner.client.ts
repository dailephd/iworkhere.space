import {
    IMAGE_FILE_ENCODING,
    MAX_PIXEL_AREA,
    WorkflowAdapterError,
    assembleImagePdf,
    assemblePacketPdf,
    compressPacketPdf,
    compressTo,
    convertHeicPhoto,
    convertTo,
    imageFileBasename,
    inspectGeneratedPdf,
    inspectHeicPhoto,
    inspectPacketImage,
    inspectPdfSource,
    inspectSource,
    isAbortError,
    measureBlob,
    readSourceFormat,
    renderPdfPages,
    resizeTo,
    type BlobMeasurement,
    type ImageFileFormat,
    type PacketImageFact,
    type PdfSourceFact,
    type SourceFact,
} from "./adapters.client";
import { heicQuality } from "@/module/tool/image/heicConverter";
import { validateImageFileSize } from "@/module/tool/image/imageFile";
import type { ImagesToPdfSource } from "@/module/tool/document/imagesToPdf";
import {
    MAX_AGGREGATE_IMAGE_BYTES,
    MAX_AGGREGATE_PAGES,
    MAX_AGGREGATE_PDF_BYTES,
    MAX_IMAGES,
    MAX_INPUT_PDFS,
    MAX_OUTPUT_IMAGES_PER_OPERATION,
    MAX_SINGLE_PDF_BYTES,
    PdfFileError,
    formatPdfBytes,
    validatePdfSize,
} from "@/module/tool/document/pdfFile";
import type { PdfPacketPageRef, PdfPacketSource } from "@/module/tool/document/pdfLib.workerType";
import { pdfToImageFilename } from "@/module/tool/document/pdfToImage";
import { getWorkflow } from "./registry";
import type {
    WorkflowArtifact,
    WorkflowCheck,
    WorkflowFailure,
    WorkflowFailureCode,
    WorkflowProgress,
    WorkflowRequest,
    WorkflowRunOption,
    WorkflowRunResult,
    WorkflowSlug,
    WorkflowStageId,
    WorkflowStageState,
} from "./type";

type PrepareImageRequest = Extract<WorkflowRequest, { slug: "prepare-image-for-upload" }>;

const STAGE_LIST: readonly WorkflowStageId[] = ["validate", "inspect", "convert", "resize", "compress", "verify", "complete"];
const TARGET_FORMAT_LIST: readonly ImageFileFormat[] = ["jpeg", "png", "webp"];

/** At most this many encodes per run, counted centrally across convert, resize and compress. */
const MAX_ENCODE_ATTEMPT = 12;
/** Dimension steps tried after the legal size, largest first. */
const DIMENSION_SCALE_LADDER: readonly number[] = [1, 0.75, 0.5, 0.35, 0.25];
/** Qualities tried for JPEG and WebP at each dimension step, highest first. All are valid existing encoder values. */
const QUALITY_LADDER: readonly number[] = [70, 45, 20];

/** Raised at an abort checkpoint; mapped to the CANCELLED failure. */
class WorkflowCancelledSignal extends Error {}

interface EncodeBudget {
    canRun(): boolean;
    run<T>(operation: () => Promise<T>): Promise<T>;
    used(): number;
}

function createEncodeBudget(): EncodeBudget {
    let count = 0;
    return {
        canRun: () => count < MAX_ENCODE_ATTEMPT,
        used: () => count,
        async run(operation) {
            if (count >= MAX_ENCODE_ATTEMPT) throw new WorkflowAdapterError("PROCESSING_FAILED", "The encode attempt limit was reached.");
            count += 1;
            return operation();
        },
    };
}

type Reporter = (stage: WorkflowStageId, state: WorkflowStageState, description: string) => void;

function createReporter(option: WorkflowRunOption): Reporter {
    const finished = new Set<WorkflowStageId>();
    return (stage, state, description) => {
        if (state === "passed" || state === "skipped") finished.add(stage);
        const progress: WorkflowProgress = { stage, state, completed: finished.size, total: STAGE_LIST.length, description };
        option.onProgress?.(progress);
    };
}

function checkpoint(signal: AbortSignal): void {
    if (signal.aborted) throw new WorkflowCancelledSignal();
}

function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function formatCount(value: number): string {
    return value.toLocaleString("en-US");
}

function failureResult(slug: WorkflowSlug, failure: WorkflowFailure): WorkflowRunResult {
    return { ok: false, slug, failure, outputs: [] };
}

/** Returns a message for the first invalid requirement, or null. */
function validateRequirement(request: PrepareImageRequest): string | null {
    if (!(request.source instanceof File)) return "Choose one JPEG, PNG or WebP image to prepare.";
    if (!TARGET_FORMAT_LIST.includes(request.targetFormat)) return "Choose JPEG, PNG or WebP as the output format.";
    if (!isPositiveSafeInteger(request.maxWidth)) return "Maximum width must be a positive whole number of pixels.";
    if (!isPositiveSafeInteger(request.maxHeight)) return "Maximum height must be a positive whole number of pixels.";
    if (!isPositiveSafeInteger(request.maxBytes)) return "Maximum file size must be a positive whole number of bytes.";
    return null;
}

interface Dimension {
    width: number;
    height: number;
}

interface LegalSize extends Dimension {
    scaled: boolean;
}

/** Largest integer size within both bounds that keeps the aspect ratio. Never upscales. */
function fitWithin(source: Dimension, maxWidth: number, maxHeight: number): LegalSize {
    const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
    if (scale >= 1) return { width: source.width, height: source.height, scaled: false };
    return {
        width: Math.min(maxWidth, Math.max(1, Math.floor(source.width * scale))),
        height: Math.min(maxHeight, Math.max(1, Math.floor(source.height * scale))),
        scaled: true,
    };
}

function scaleDimension(size: Dimension, scale: number): Dimension {
    return { width: Math.max(1, Math.floor(size.width * scale)), height: Math.max(1, Math.floor(size.height * scale)) };
}

function buildCheck(request: PrepareImageRequest, measurement: BlobMeasurement, reportedSize: number): WorkflowCheck[] {
    const expectedMime = IMAGE_FILE_ENCODING[request.targetFormat].mime;
    const pixelCount = measurement.width * measurement.height;
    return [
        { name: "Output is not empty", expected: "more than 0 bytes", observed: measurement.byteLength, passed: measurement.byteLength > 0 },
        { name: "Output format", expected: expectedMime, observed: measurement.detectedMimeType ?? "not a supported image", passed: measurement.detectedMimeType === expectedMime },
        { name: "Output width in pixels", expected: `at most ${request.maxWidth}`, observed: measurement.width, passed: measurement.width > 0 && measurement.width <= request.maxWidth },
        { name: "Output height in pixels", expected: `at most ${request.maxHeight}`, observed: measurement.height, passed: measurement.height > 0 && measurement.height <= request.maxHeight },
        { name: "Output size in bytes", expected: `at most ${request.maxBytes}`, observed: measurement.byteLength, passed: measurement.byteLength > 0 && measurement.byteLength <= request.maxBytes },
        { name: "Decoded pixel count within image safety limit", expected: `at most ${MAX_PIXEL_AREA}`, observed: pixelCount, passed: pixelCount > 0 && pixelCount <= MAX_PIXEL_AREA },
        { name: "Reported size matches output bytes", expected: reportedSize, observed: measurement.byteLength, passed: measurement.byteLength === reportedSize },
    ];
}

interface SearchInput {
    fullResolution: File;
    start: File;
    target: ImageFileFormat;
    legal: Dimension;
    maxBytes: number;
    budget: EncodeBudget;
    signal: AbortSignal;
    report: Reporter;
}

interface SearchOutcome {
    file: File | null;
    smallest: File;
}

/**
 * Bounded deterministic search in the selected format only. Larger dimensions come first,
 * then higher quality. PNG has no quality control, so only smaller legal dimensions are tried.
 */
async function searchWithinByteLimit(input: SearchInput): Promise<SearchOutcome> {
    const { fullResolution, start, target, legal, maxBytes, budget, signal, report } = input;
    let smallest = start;
    const fits = (file: File): boolean => {
        if (file.size < smallest.size) smallest = file;
        return file.size <= maxBytes;
    };
    for (const scale of DIMENSION_SCALE_LADDER) {
        let base = start;
        if (scale !== 1) {
            if (!budget.canRun()) break;
            const dimension = scaleDimension(legal, scale);
            report("compress", "running", `Trying ${dimension.width} x ${dimension.height} pixels (${budget.used() + 1} of ${MAX_ENCODE_ATTEMPT} encodes)`);
            base = await budget.run(() => resizeTo(fullResolution, target, dimension));
            checkpoint(signal);
            if (fits(base)) return { file: base, smallest };
        }
        if (target === "png") continue;
        for (const quality of QUALITY_LADDER) {
            if (!budget.canRun()) return { file: null, smallest };
            report("compress", "running", `Re-encoding at quality ${quality} (${budget.used() + 1} of ${MAX_ENCODE_ATTEMPT} encodes)`);
            const candidate = await budget.run(() => compressTo(base, target, quality));
            checkpoint(signal);
            if (fits(candidate)) return { file: candidate, smallest };
        }
    }
    return { file: null, smallest };
}

function outputName(source: File, target: ImageFileFormat): string {
    return `${imageFileBasename(source.name)}-prepared.${IMAGE_FILE_ENCODING[target].extension}`;
}

async function runPrepareImage(request: PrepareImageRequest, option: WorkflowRunOption): Promise<WorkflowRunResult> {
    const { signal } = option;
    const report = createReporter(option);
    let stage: WorkflowStageId = "validate";
    const enter = (next: WorkflowStageId, description: string): void => {
        stage = next;
        checkpoint(signal);
        report(next, "running", description);
    };
    const skip = (next: WorkflowStageId, reason: string): void => {
        stage = next;
        checkpoint(signal);
        report(next, "skipped", reason);
    };

    try {
        enter("validate", "Checking the source file and your requirements");
        const requirementError = validateRequirement(request);
        if (requirementError) throw new WorkflowAdapterError("INVALID_INPUT", requirementError);
        const sourceFormat = await readSourceFormat(request.source);
        checkpoint(signal);
        report("validate", "passed", `Source is ${IMAGE_FILE_ENCODING[sourceFormat].label}, ${formatCount(request.source.size)} bytes`);

        enter("inspect", "Reading the real image dimensions");
        const source: SourceFact = await inspectSource(request.source, sourceFormat);
        checkpoint(signal);
        report("inspect", "passed", `Source is ${source.width} x ${source.height} pixels`);

        const target = request.targetFormat;
        const targetLabel = IMAGE_FILE_ENCODING[target].label;
        const legal = fitWithin(source, request.maxWidth, request.maxHeight);
        const budget = createEncodeBudget();

        let fullResolution: File = request.source;
        if (sourceFormat !== target) {
            enter("convert", `Converting ${IMAGE_FILE_ENCODING[sourceFormat].label} to ${targetLabel}`);
            fullResolution = await budget.run(() => convertTo(request.source, target));
            checkpoint(signal);
            report("convert", "passed", `Converted to ${targetLabel}`);
        } else {
            skip("convert", `Skipped: the source is already ${targetLabel}`);
        }

        let current: File = fullResolution;
        if (legal.scaled) {
            enter("resize", `Resizing to fit ${request.maxWidth} x ${request.maxHeight} pixels`);
            current = await budget.run(() => resizeTo(fullResolution, target, { width: legal.width, height: legal.height }));
            checkpoint(signal);
            report("resize", "passed", `Resized to ${legal.width} x ${legal.height} pixels`);
        } else {
            skip("resize", "Skipped: the image already fits within the width and height limits");
        }

        let final: File | null = null;
        if (current.size <= request.maxBytes) {
            final = current;
            skip("compress", `Skipped: already within ${formatCount(request.maxBytes)} bytes`);
        } else {
            enter("compress", `Searching for a ${targetLabel} within ${formatCount(request.maxBytes)} bytes`);
            const outcome = await searchWithinByteLimit({
                fullResolution, start: current, target, legal, maxBytes: request.maxBytes, budget, signal, report,
            });
            if (!outcome.file) {
                const measurement = await measureBlob(outcome.smallest);
                const unmetChecks = buildCheck(request, measurement, outcome.smallest.size).filter(check => !check.passed);
                report("compress", "failed", "No output met every requirement");
                return failureResult(request.slug, {
                    code: "UNMET_REQUIREMENT",
                    stage: "compress",
                    message: `No ${targetLabel} output within ${formatCount(request.maxBytes)} bytes was found after ${budget.used()} encodes. The smallest attempt was ${formatCount(measurement.byteLength)} bytes at ${measurement.width} x ${measurement.height} pixels. Raise the byte limit, allow larger dimensions or choose another output format.`,
                    unmetChecks,
                });
            }
            final = outcome.file;
            report("compress", "passed", `Found a ${targetLabel} of ${formatCount(final.size)} bytes after ${budget.used()} encodes`);
        }

        enter("verify", "Checking the final image independently");
        const measurement = await measureBlob(final);
        checkpoint(signal);
        const checks = buildCheck(request, measurement, final.size);
        const unmetChecks = checks.filter(check => !check.passed);
        if (unmetChecks.length > 0) {
            report("verify", "failed", "The final image failed verification");
            return failureResult(request.slug, {
                code: "VERIFICATION_FAILED",
                stage: "verify",
                message: "The prepared image did not pass verification, so it is not offered for download.",
                unmetChecks,
            });
        }
        report("verify", "passed", "Every check passed");

        stage = "complete";
        checkpoint(signal);
        const artifact: WorkflowArtifact = {
            name: outputName(request.source, target),
            mimeType: IMAGE_FILE_ENCODING[target].mime,
            blob: final,
            sizeBytes: final.size,
            width: measurement.width,
            height: measurement.height,
        };
        report("complete", "passed", "Your image is ready to download");
        return { ok: true, slug: request.slug, outputs: [artifact], checks };
    } catch (error) {
        const code: WorkflowFailureCode = error instanceof WorkflowCancelledSignal ? "CANCELLED"
            : error instanceof WorkflowAdapterError ? error.code : "PROCESSING_FAILED";
        const message = error instanceof WorkflowCancelledSignal ? "The run was cancelled. No file was produced."
            : error instanceof WorkflowAdapterError ? error.message
                : "The browser could not process this image. Reset the form and try again.";
        report(stage, code === "CANCELLED" ? "cancelled" : "failed", message);
        return failureResult(request.slug, { code, stage, message });
    }
}

/* ---------- Shared run context for the multi-file workflows ---------- */

const PDF_MIME = "application/pdf";
const HEIC_PDF_NAME = "heic-photos.pdf";
const PACKET_PDF_NAME = "assembled-packet.pdf";
const CANCELLED_MESSAGE = "The run was cancelled. No file was produced.";
const GENERIC_FAILURE_MESSAGE = "The browser could not process these files. Reset the form and try again.";
const PAGE_SIZE_TOLERANCE = 0.01;
const DEFAULT_JPEG_FRACTION = 0.85;
const DPI_LIST: readonly number[] = [72, 150, 300];

interface RunContext {
    signal: AbortSignal;
    checkpoint(): void;
    enter(stage: WorkflowStageId, description: string): void;
    update(description: string): void;
    pass(stage: WorkflowStageId, description: string): void;
    skip(stage: WorkflowStageId, reason: string): void;
    stop(failure: WorkflowFailure): WorkflowRunResult;
    fail(error: unknown): WorkflowRunResult;
}

/** One reporter per run. Stage order and count come from the registry, so the stepper and the runner cannot disagree. */
function createRunContext(slug: WorkflowSlug, option: WorkflowRunOption): RunContext {
    const { signal } = option;
    const stageList = getWorkflow(slug)?.stageList ?? [];
    const finished = new Set<WorkflowStageId>();
    let current: WorkflowStageId = "validate";
    const emit = (stage: WorkflowStageId, state: WorkflowStageState, description: string): void => {
        if (state === "passed" || state === "skipped") finished.add(stage);
        option.onProgress?.({ stage, state, completed: finished.size, total: stageList.length, description });
    };
    return {
        signal,
        checkpoint: () => checkpoint(signal),
        enter(stage, description) {
            current = stage;
            checkpoint(signal);
            emit(stage, "running", description);
        },
        update(description) {
            checkpoint(signal);
            emit(current, "running", description);
        },
        pass(stage, description) {
            checkpoint(signal);
            emit(stage, "passed", description);
        },
        skip(stage, reason) {
            current = stage;
            checkpoint(signal);
            emit(stage, "skipped", reason);
        },
        stop(failure) {
            emit(failure.stage, "failed", failure.message);
            return failureResult(slug, failure);
        },
        fail(error) {
            if (error instanceof WorkflowCancelledSignal || signal.aborted || isAbortError(error)) {
                emit(current, "cancelled", CANCELLED_MESSAGE);
                return failureResult(slug, { code: "CANCELLED", stage: current, message: CANCELLED_MESSAGE });
            }
            const typed = error instanceof WorkflowAdapterError ? error : null;
            const message = typed ? typed.message : GENERIC_FAILURE_MESSAGE;
            emit(current, "failed", message);
            return failureResult(slug, {
                code: typed ? typed.code : "PROCESSING_FAILED",
                stage: current,
                message,
                ...(typed?.sourceId ? { sourceId: typed.sourceId } : {}),
            });
        },
    };
}

interface PageExpectation {
    width: number;
    height: number;
    rotation: number;
}

function pdfArtifact(name: string, bytes: Uint8Array): WorkflowArtifact {
    const blob = new Blob([new Uint8Array(bytes)], { type: PDF_MIME });
    return { name, mimeType: PDF_MIME, blob, sizeBytes: blob.size };
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Verify step shared by both PDF outputs. Re-reads the generated bytes; nothing here trusts what the writer reported. */
async function verifyPdfOutput(pdf: Uint8Array, expected: readonly PageExpectation[], signal: AbortSignal): Promise<WorkflowCheck[]> {
    const inspection = await inspectGeneratedPdf(pdf, signal);
    const header = String.fromCharCode(...pdf.subarray(0, 5));
    const matched = expected.filter((page, index) => {
        const observed = inspection.page[index];
        return observed !== undefined
            && Math.abs(observed.width - page.width) <= PAGE_SIZE_TOLERANCE
            && Math.abs(observed.height - page.height) <= PAGE_SIZE_TOLERANCE
            && observed.rotation === page.rotation;
    }).length;
    return [
        { name: "Output is a PDF", expected: "%PDF- header", observed: header === "%PDF-" ? "%PDF- header" : "no PDF header", passed: header === "%PDF-" },
        { name: "Output size in bytes", expected: `1 to ${MAX_AGGREGATE_PDF_BYTES}`, observed: pdf.length, passed: pdf.length > 0 && pdf.length <= MAX_AGGREGATE_PDF_BYTES },
        { name: "Page count", expected: expected.length, observed: inspection.pageCount, passed: inspection.pageCount === expected.length },
        { name: "Pages with the expected size and rotation", expected: expected.length, observed: matched, passed: matched === expected.length },
    ];
}

/* ---------- HEIC photos to PDF ---------- */

type HeicToPdfRequest = Extract<WorkflowRequest, { slug: "heic-photos-to-pdf" }>;

function validateHeicRequest(request: HeicToPdfRequest): number {
    const photo = request.sourcesInPageOrder;
    if (!Array.isArray(photo) || photo.length < 1) throw new WorkflowAdapterError("INVALID_INPUT", "Choose at least one HEIC or HEIF photo.");
    if (photo.length > MAX_IMAGES) throw new WorkflowAdapterError("SOURCE_LIMIT", `Choose at most ${MAX_IMAGES} photos. You selected ${photo.length}.`);
    if (request.intermediateFormat !== "jpeg" && request.intermediateFormat !== "png") throw new WorkflowAdapterError("INVALID_INPUT", "Choose JPEG or PNG for the page images.");
    try {
        heicQuality(request.intermediateFormat, request.quality);
    } catch {
        throw new WorkflowAdapterError("INVALID_INPUT", "Choose a JPEG quality from 10 to 100 in steps of 5.");
    }
    let total = 0;
    photo.forEach((file, index) => {
        const ordinal = index + 1;
        if (!(file instanceof File)) throw new WorkflowAdapterError("INVALID_INPUT", `Photo ${ordinal} is not a file.`, `photo-${ordinal}`);
        const sizeError = validateImageFileSize(file.size);
        if (sizeError) throw new WorkflowAdapterError(file.size > 0 ? "SOURCE_LIMIT" : "INVALID_INPUT", `Photo ${ordinal}: ${sizeError}`, `photo-${ordinal}`);
        total += file.size;
    });
    if (total > MAX_AGGREGATE_IMAGE_BYTES) {
        throw new WorkflowAdapterError("SOURCE_LIMIT", `The photos total ${formatPdfBytes(total)}. The maximum for all photos together is 25 MiB. Remove some photos.`);
    }
    return total;
}

async function runHeicToPdf(request: HeicToPdfRequest, option: WorkflowRunOption): Promise<WorkflowRunResult> {
    const run = createRunContext(request.slug, option);
    try {
        run.enter("validate", "Checking the photos and settings");
        const totalBytes = validateHeicRequest(request);
        const photo = request.sourcesInPageOrder;
        const count = photo.length;
        run.pass("validate", `${plural(count, "photo")} in page order, ${formatCount(totalBytes)} bytes`);

        run.enter("inspect", "Reading the photos");
        for (const [index, file] of photo.entries()) {
            run.update(`Reading photo ${index + 1} of ${count}`);
            await inspectHeicPhoto(file, index + 1, run.signal);
            run.checkpoint();
        }
        run.pass("inspect", count === 1 ? "The photo is a readable HEIC image" : `All ${count} photos are readable HEIC images`);

        const target = request.intermediateFormat;
        const targetLabel = IMAGE_FILE_ENCODING[target].label;
        run.enter("convert", `Converting the photos to ${targetLabel} in memory`);
        const image: ImagesToPdfSource[] = [];
        let convertedBytes = 0;
        for (const [index, file] of photo.entries()) {
            run.update(`Converting photo ${index + 1} of ${count} to ${targetLabel}`);
            const converted = await convertHeicPhoto(file, index + 1, target, request.quality, run.signal);
            run.checkpoint();
            convertedBytes += converted.bytes.length;
            if (convertedBytes > MAX_AGGREGATE_IMAGE_BYTES) {
                throw new WorkflowAdapterError("RESOURCE_LIMIT", `Photo ${index + 1}: the converted images together exceed 25 MiB. Choose JPEG, a lower quality or fewer photos.`, `photo-${index + 1}`);
            }
            image.push(converted);
        }
        run.pass("convert", `Converted ${plural(count, "photo")} to ${targetLabel} (${formatCount(convertedBytes)} bytes)`);

        run.enter("assemble", "Placing one photo on each PDF page");
        const pdf = await assembleImagePdf(image, run.signal);
        run.pass("assemble", `Built a PDF of ${formatCount(pdf.length)} bytes`);

        run.enter("verify", "Checking the PDF independently");
        const expected = image.map(source => ({ width: source.width, height: source.height, rotation: 0 }));
        const checks = await verifyPdfOutput(pdf, expected, run.signal);
        run.checkpoint();
        const unmetChecks = checks.filter(check => !check.passed);
        if (unmetChecks.length > 0) {
            return run.stop({ code: "VERIFICATION_FAILED", stage: "verify", message: "The PDF did not pass verification, so it is not offered for download.", unmetChecks });
        }
        run.pass("verify", "Every check passed");
        run.checkpoint();
        run.pass("complete", "Your PDF is ready to download");
        return { ok: true, slug: request.slug, outputs: [pdfArtifact(HEIC_PDF_NAME, pdf)], checks };
    } catch (error) {
        return run.fail(error);
    }
}

/* ---------- Assemble PDF packet ---------- */

type PacketRequest = Extract<WorkflowRequest, { slug: "assemble-pdf-packet" }>;
type PacketSourceFact = ({ kind: "pdf" } & PdfSourceFact) | ({ kind: "jpeg" | "png" } & PacketImageFact);

const PACKET_KIND_LIST: readonly string[] = ["pdf", "jpeg", "png"];

function validatePacketRequest(request: PacketRequest): void {
    const { sources, pageOrder } = request;
    if (!Array.isArray(sources) || sources.length < 1) throw new WorkflowAdapterError("INVALID_INPUT", "Add at least one PDF or image.");
    if (!Array.isArray(pageOrder) || pageOrder.length < 1) throw new WorkflowAdapterError("INVALID_INPUT", "Add at least one page to the packet.");
    if (typeof request.tryLosslessCompression !== "boolean") throw new WorkflowAdapterError("INVALID_INPUT", "Choose whether to try lossless compression.");
    const seen = new Set<string>();
    let pdfCount = 0;
    let imageCount = 0;
    let total = 0;
    for (const source of sources) {
        if (!source || typeof source.id !== "string" || source.id === "") throw new WorkflowAdapterError("INVALID_INPUT", "Every source needs an id.");
        const sourceId = source.id;
        if (seen.has(sourceId)) throw new WorkflowAdapterError("INVALID_INPUT", `Source "${sourceId}" appears more than once. Every source needs its own id.`, sourceId);
        seen.add(sourceId);
        if (!PACKET_KIND_LIST.includes(source.kind)) throw new WorkflowAdapterError("INVALID_INPUT", `Source "${sourceId}" must be a PDF, JPEG or PNG file.`, sourceId);
        if (!(source.file instanceof File)) throw new WorkflowAdapterError("INVALID_INPUT", `Source "${sourceId}" is not a file.`, sourceId);
        if (source.kind === "pdf") {
            pdfCount += 1;
            const failure = validatePdfSize(source.file.size);
            if (failure) throw new WorkflowAdapterError(failure === "empty" ? "INVALID_INPUT" : "SOURCE_LIMIT", `Source "${sourceId}": ${new PdfFileError(failure).message}`, sourceId);
        } else {
            imageCount += 1;
            const sizeError = validateImageFileSize(source.file.size);
            if (sizeError) throw new WorkflowAdapterError(source.file.size > 0 ? "SOURCE_LIMIT" : "INVALID_INPUT", `Source "${sourceId}": ${sizeError}`, sourceId);
        }
        total += source.file.size;
    }
    if (pdfCount > MAX_INPUT_PDFS) throw new WorkflowAdapterError("SOURCE_LIMIT", `A packet can use at most ${MAX_INPUT_PDFS} PDFs. You added ${pdfCount}.`);
    if (imageCount > MAX_IMAGES) throw new WorkflowAdapterError("SOURCE_LIMIT", `A packet can use at most ${MAX_IMAGES} images. You added ${imageCount}.`);
    if (total > MAX_AGGREGATE_PDF_BYTES) throw new WorkflowAdapterError("SOURCE_LIMIT", `The sources total ${formatPdfBytes(total)}. The maximum for all sources together is 25 MiB.`);
    if (pageOrder.length > MAX_AGGREGATE_PAGES) throw new WorkflowAdapterError("PAGE_LIMIT", `A packet can have at most ${MAX_AGGREGATE_PAGES} pages. You listed ${pageOrder.length}.`);
    for (const reference of pageOrder) {
        if (!reference || !seen.has(reference.sourceId)) throw new WorkflowAdapterError("INVALID_INPUT", "A page refers to a source that was not added.", typeof reference?.sourceId === "string" ? reference.sourceId : undefined);
        if (!Number.isSafeInteger(reference.pageNumber) || reference.pageNumber < 1) throw new WorkflowAdapterError("INVALID_INPUT", `Source "${reference.sourceId}": page numbers are whole numbers starting at 1.`, reference.sourceId);
    }
}

async function runPacket(request: PacketRequest, option: WorkflowRunOption): Promise<WorkflowRunResult> {
    const run = createRunContext(request.slug, option);
    try {
        run.enter("validate", "Checking the sources and page list");
        validatePacketRequest(request);
        const { sources, pageOrder } = request;
        run.pass("validate", `${plural(sources.length, "source")} and ${plural(pageOrder.length, "page")} in packet order`);

        run.enter("inspect", "Reading every source");
        const fact = new Map<string, PacketSourceFact>();
        for (const [index, source] of sources.entries()) {
            run.update(`Reading source ${index + 1} of ${sources.length}`);
            if (source.kind === "pdf") {
                fact.set(source.id, { kind: "pdf", ...(await inspectPdfSource(source.file, run.signal, source.id)) });
            } else {
                fact.set(source.id, { kind: source.kind, ...(await inspectPacketImage(source.file, source.kind, run.signal, source.id)) });
            }
            run.checkpoint();
        }
        run.pass("inspect", sources.length === 1 ? "The source is readable" : `All ${sources.length} sources are readable`);

        run.enter("select-pages", "Checking each page reference and preparing images");
        const workerId = new Map<string, string>();
        const workerSource: PdfPacketSource[] = [];
        const workerOrder: PdfPacketPageRef[] = [];
        const expected: PageExpectation[] = [];
        for (const reference of pageOrder) {
            const source = fact.get(reference.sourceId);
            if (!source) throw new WorkflowAdapterError("INVALID_INPUT", "A page refers to a source that was not added.", reference.sourceId);
            if (source.kind === "pdf") {
                const pageCount = source.inspection.pageCount;
                if (reference.pageNumber > pageCount) {
                    throw new WorkflowAdapterError("INVALID_INPUT", `Source "${reference.sourceId}" has ${plural(pageCount, "page")}, so page ${reference.pageNumber} does not exist.`, reference.sourceId);
                }
                const geometry = source.inspection.page[reference.pageNumber - 1];
                expected.push({ width: geometry.width, height: geometry.height, rotation: geometry.rotation });
            } else {
                if (reference.pageNumber !== 1) {
                    throw new WorkflowAdapterError("INVALID_INPUT", `Source "${reference.sourceId}" is an image with one page, so only page 1 exists.`, reference.sourceId);
                }
                expected.push({ width: source.width, height: source.height, rotation: 0 });
            }
            if (!workerId.has(reference.sourceId)) {
                const id = `s${workerId.size}`;
                workerId.set(reference.sourceId, id);
                workerSource.push(source.kind === "pdf"
                    ? { id, kind: "pdf", bytes: source.bytes }
                    : { id, kind: source.kind, bytes: source.bytes, width: source.width, height: source.height });
            }
            workerOrder.push({ sourceId: workerId.get(reference.sourceId) as string, pageNumber: reference.pageNumber });
        }
        run.pass("select-pages", `${plural(workerOrder.length, "page")} selected from ${plural(workerSource.length, "source")}`);

        run.enter("assemble", "Copying pages in your order");
        const assembled = await assemblePacketPdf(workerSource, workerOrder, run.signal);
        run.pass("assemble", `Built a PDF of ${formatCount(assembled.length)} bytes`);

        let final = assembled;
        let compressionObserved: string;
        let compressionExpected = "not requested";
        if (!request.tryLosslessCompression) {
            compressionObserved = "skipped";
            run.skip("compress", "Skipped: lossless compression was not requested");
        } else if (assembled.length > MAX_SINGLE_PDF_BYTES) {
            compressionExpected = "requested";
            compressionObserved = "skipped: over the 10 MiB compressor limit";
            run.skip("compress", `Skipped: the packet is ${formatPdfBytes(assembled.length)}, over the 10 MiB limit of the compressor. The verified uncompressed packet is kept.`);
        } else {
            compressionExpected = "requested";
            run.enter("compress", "Trying lossless compression");
            const outcome = await compressPacketPdf(assembled, run.signal);
            if (outcome.status === "smaller") {
                final = outcome.bytes;
                compressionObserved = `saved ${formatCount(outcome.savedBytes)} bytes`;
                run.pass("compress", `Saved ${formatCount(outcome.savedBytes)} bytes (${outcome.percentage.toFixed(1)}%) and verified every page`);
            } else {
                compressionObserved = "no reduction";
                run.pass("compress", "Compression ran but did not make the PDF smaller. The already verified packet is kept.");
            }
        }

        run.enter("verify", "Checking the packet independently");
        const checks = await verifyPdfOutput(final, expected, run.signal);
        run.checkpoint();
        checks.push({ name: "Lossless compression", expected: compressionExpected, observed: compressionObserved, passed: true });
        const unmetChecks = checks.filter(check => !check.passed);
        if (unmetChecks.length > 0) {
            return run.stop({ code: "VERIFICATION_FAILED", stage: "verify", message: "The packet did not pass verification, so it is not offered for download.", unmetChecks });
        }
        run.pass("verify", "Every check passed");
        run.checkpoint();
        run.pass("complete", "Your packet is ready to download");
        return { ok: true, slug: request.slug, outputs: [pdfArtifact(PACKET_PDF_NAME, final)], checks };
    } catch (error) {
        return run.fail(error);
    }
}

/* ---------- PDF pages for slides ---------- */

type SlidesRequest = Extract<WorkflowRequest, { slug: "pdf-pages-for-slides" }>;

/** Rounds away binary noise (792 * 150 / 72 is 1650.0000000000002) before taking the ceiling the renderer uses. */
function scaledPixels(points: number, scale: number): number {
    return Math.ceil(Math.round(points * scale * 1_000_000) / 1_000_000);
}

function validateSlidesRequest(request: SlidesRequest): void {
    if (!(request.source instanceof File)) throw new WorkflowAdapterError("INVALID_INPUT", "Choose one PDF file.");
    const page = request.pageNumbersInOutputOrder;
    if (!Array.isArray(page) || page.length < 1) throw new WorkflowAdapterError("INVALID_INPUT", "Choose at least one page to export.");
    if (page.length > MAX_OUTPUT_IMAGES_PER_OPERATION) throw new WorkflowAdapterError("PAGE_LIMIT", `Export at most ${MAX_OUTPUT_IMAGES_PER_OPERATION} pages at a time. You chose ${page.length}.`);
    if (!page.every(isPositiveSafeInteger)) throw new WorkflowAdapterError("INVALID_INPUT", "Page numbers are whole numbers starting at 1.");
    if (new Set(page).size !== page.length) throw new WorkflowAdapterError("INVALID_INPUT", "Each page can be exported once. Remove the repeated page number.");
    if (request.format !== "png" && request.format !== "jpeg") throw new WorkflowAdapterError("INVALID_INPUT", "Choose PNG or JPEG for the slide images.");
    if (!DPI_LIST.includes(request.dpi)) throw new WorkflowAdapterError("INVALID_INPUT", "Choose 72, 150 or 300 DPI.");
    if (request.format === "jpeg" && !(Number.isFinite(request.jpegQuality) && request.jpegQuality >= 0.5 && request.jpegQuality <= 1)) {
        throw new WorkflowAdapterError("INVALID_INPUT", "JPEG quality must be from 50% to 100%.");
    }
    if (request.maxBytesPerImage !== undefined && !isPositiveSafeInteger(request.maxBytesPerImage)) {
        throw new WorkflowAdapterError("INVALID_INPUT", "The size limit for each image must be a positive whole number of bytes.");
    }
}

async function runSlides(request: SlidesRequest, option: WorkflowRunOption): Promise<WorkflowRunResult> {
    const run = createRunContext(request.slug, option);
    try {
        run.enter("validate", "Checking the PDF and your settings");
        validateSlidesRequest(request);
        const pageList = [...request.pageNumbersInOutputOrder];
        run.pass("validate", `${plural(pageList.length, "page")} requested in this order: ${pageList.join(", ")}`);

        run.enter("inspect", "Reading the PDF");
        const source = await inspectPdfSource(request.source, run.signal);
        run.checkpoint();
        run.pass("inspect", `The PDF has ${plural(source.inspection.pageCount, "page")}`);

        run.enter("select-pages", "Checking the requested pages exist");
        const missing = pageList.find(page => page > source.inspection.pageCount);
        if (missing !== undefined) {
            throw new WorkflowAdapterError("INVALID_INPUT", `The PDF has ${plural(source.inspection.pageCount, "page")}, so page ${missing} does not exist.`);
        }
        run.pass("select-pages", `Pages ${pageList.join(", ")} exist`);

        const mime = IMAGE_FILE_ENCODING[request.format].mime;
        const label = IMAGE_FILE_ENCODING[request.format].label;
        run.enter("render", `Rendering ${plural(pageList.length, "page")} as ${label} at ${request.dpi} DPI`);
        const rendered = await renderPdfPages(source.bytes, pageList, {
            format: request.format,
            dpi: request.dpi as 72 | 150 | 300,
            quality: request.format === "jpeg" ? request.jpegQuality : DEFAULT_JPEG_FRACTION,
        }, run.signal);
        run.checkpoint();
        run.pass("render", `Rendered ${plural(rendered.length, "image")}`);

        run.enter("verify", "Checking every image independently");
        const checks: WorkflowCheck[] = [];
        const artifacts: WorkflowArtifact[] = [];
        const scale = request.dpi / 72;
        for (const [index, output] of rendered.entries()) {
            const pageNumber = pageList[index];
            const measurement = await measureBlob(output.blob);
            run.checkpoint();
            const geometry = source.inspection.page[pageNumber - 1];
            const turned = geometry.rotation % 180 !== 0;
            const expectedWidth = scaledPixels(turned ? geometry.height : geometry.width, scale);
            const expectedHeight = scaledPixels(turned ? geometry.width : geometry.height, scale);
            const observedLabel = measurement.detectedMimeType === mime ? label : (measurement.detectedMimeType ?? "not a supported image");
            const identityPassed = output.pageNumber === pageNumber
                && measurement.detectedMimeType === mime
                && measurement.byteLength > 0
                && measurement.width === output.width && measurement.height === output.height
                && Math.abs(measurement.width - expectedWidth) <= 1 && Math.abs(measurement.height - expectedHeight) <= 1;
            checks.push({
                name: `Slide ${index + 1}: page, format and size`,
                expected: `page ${pageNumber}, ${label}, ${expectedWidth} x ${expectedHeight} px`,
                observed: `page ${output.pageNumber}, ${observedLabel}, ${measurement.width} x ${measurement.height} px`,
                passed: identityPassed,
            });
            if (request.maxBytesPerImage !== undefined) {
                checks.push({
                    name: `Slide ${index + 1}: size in bytes`,
                    expected: `at most ${request.maxBytesPerImage}`,
                    observed: measurement.byteLength,
                    passed: measurement.byteLength > 0 && measurement.byteLength <= request.maxBytesPerImage,
                });
            }
            artifacts.push({
                name: pdfToImageFilename(request.source.name, pageNumber, request.format),
                mimeType: mime,
                blob: output.blob,
                sizeBytes: measurement.byteLength,
                sourcePageNumber: pageNumber,
                width: output.width,
                height: output.height,
            });
        }
        const unmetChecks = checks.filter(check => !check.passed);
        if (unmetChecks.length > 0) {
            const sizeOnly = unmetChecks.every(check => check.name.endsWith("size in bytes"));
            if (sizeOnly && request.maxBytesPerImage !== undefined) {
                return run.stop({
                    code: "UNMET_REQUIREMENT",
                    stage: "verify",
                    message: `${plural(unmetChecks.length, "image")} larger than ${formatCount(request.maxBytesPerImage)} bytes. No images are offered. Raise the size limit, choose a lower DPI or use JPEG with a lower quality.`,
                    unmetChecks,
                });
            }
            return run.stop({ code: "VERIFICATION_FAILED", stage: "verify", message: "The images did not pass verification, so none are offered for download.", unmetChecks });
        }
        run.pass("verify", "Every check passed");
        run.checkpoint();
        run.pass("complete", `${plural(artifacts.length, "image")} ready to download`);
        return { ok: true, slug: request.slug, outputs: artifacts, checks };
    } catch (error) {
        return run.fail(error);
    }
}

/** Reads display facts for a selected file before Process. Never processes or stores the file. */
export async function inspectWorkflowSource(file: File): Promise<{ ok: true; source: SourceFact } | { ok: false; code: WorkflowFailureCode; message: string }> {
    try {
        const format = await readSourceFormat(file);
        return { ok: true, source: await inspectSource(file, format) };
    } catch (error) {
        if (error instanceof WorkflowAdapterError) return { ok: false, code: error.code, message: error.message };
        return { ok: false, code: "PROCESSING_FAILED", message: "The browser could not read this image." };
    }
}

export async function runWorkflow(request: WorkflowRequest, option: WorkflowRunOption): Promise<WorkflowRunResult> {
    switch (request.slug) {
        case "prepare-image-for-upload":
            return runPrepareImage(request, option);
        case "heic-photos-to-pdf":
            return runHeicToPdf(request, option);
        case "assemble-pdf-packet":
            return runPacket(request, option);
        case "pdf-pages-for-slides":
            return runSlides(request, option);
    }
}
