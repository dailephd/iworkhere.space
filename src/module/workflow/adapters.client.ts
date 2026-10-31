import {
    IMAGE_FILE_ENCODING,
    MAX_PIXEL_AREA,
    imageFileBasename,
    validateImageFileDimension,
    validateImageFileSize,
    type ImageFileDimension,
    type ImageFileFormat,
} from "@/module/tool/image/imageFile";
import { decodeImageFile, ImageFileError, readImageFileFormat } from "@/module/tool/image/imageFile.client";
import { convertImage } from "@/module/tool/image/imageConverter.client";
import { resizeImage } from "@/module/tool/image/imageResizer.client";
import { compressImage } from "@/module/tool/image/imageCompressor.client";
import { startHeicOperation } from "@/module/tool/image/heicConverter.client";
import { HeicProcessingError, type HeicWorkerError } from "@/module/tool/image/heicConverter.workerType";
import { PdfFileError, type PdfFileFailure, type PdfInspection } from "@/module/tool/document/pdfFile";
import { inspectPdfFile } from "@/module/tool/document/pdfFile.client";
import { openPdfDocument } from "@/module/tool/document/pdfRuntime.client";
import type { ImagesToPdfSource } from "@/module/tool/document/imagesToPdf";
import { PdfLibProcessingError, startAssemblePdfOperation, startImagesToPdfOperation } from "@/module/tool/document/pdfLib.client";
import type { PdfLibFailure, PdfPacketPageRef, PdfPacketSource } from "@/module/tool/document/pdfLib.workerType";
import { convertPdfToImages } from "@/module/tool/document/pdfToImage.client";
import { PdfToImageError, type PdfToImageOption, type PdfToImageOutput } from "@/module/tool/document/pdfToImage";
import { CompressPdfVerificationError, compressPdf, compressPdfErrorMessage, type CompressPdfOutcome } from "@/module/tool/document/compressPdf.client";
import type { WorkflowFailureCode } from "./type";

/** Existing converter default; the workflow adds no competing quality scale. */
const CONVERT_QUALITY = 90;

const GENERIC_PROCESSING_MESSAGE = "The browser could not process this image. Reset the form and try again, or try another current browser.";

/** A typed adapter failure carrying the frozen workflow failure code. Messages never contain file content. */
export class WorkflowAdapterError extends Error {
    readonly code: WorkflowFailureCode;
    /** Stable local identity of the offending input (an ordinal or a form-assigned id), never a file name. */
    readonly sourceId?: string;

    constructor(code: WorkflowFailureCode, message: string, sourceId?: string) {
        super(message);
        this.code = code;
        this.sourceId = sourceId;
    }
}

export interface SourceFact {
    format: ImageFileFormat;
    width: number;
    height: number;
    sizeBytes: number;
}

export interface BlobMeasurement {
    detectedMimeType: string | null;
    width: number;
    height: number;
    byteLength: number;
}

function asProcessingError(error: unknown): WorkflowAdapterError {
    if (error instanceof WorkflowAdapterError) return error;
    if (error instanceof ImageFileError) return new WorkflowAdapterError("PROCESSING_FAILED", error.message);
    return new WorkflowAdapterError("PROCESSING_FAILED", GENERIC_PROCESSING_MESSAGE);
}

function blobToFile(blob: Blob, name: string, format: ImageFileFormat): File {
    return new File([blob], name, { type: IMAGE_FILE_ENCODING[format].mime });
}

/** Validate step: actual byte size and magic-byte encoding. Filename and declared MIME are never used. */
export async function readSourceFormat(file: File): Promise<ImageFileFormat> {
    const sizeError = validateImageFileSize(file.size);
    if (sizeError) throw new WorkflowAdapterError(file.size > 0 ? "SOURCE_LIMIT" : "INVALID_INPUT", sizeError);
    try {
        return await readImageFileFormat(file);
    } catch (error) {
        if (error instanceof ImageFileError) throw new WorkflowAdapterError("UNSUPPORTED_FORMAT", error.message);
        throw asProcessingError(error);
    }
}

/** Inspect step: real decoded dimensions, checked against the existing pixel limit. */
export async function inspectSource(file: File, format: ImageFileFormat): Promise<SourceFact> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await decodeImageFile(file);
    } catch (error) {
        throw asProcessingError(error);
    }
    try {
        const dimension: ImageFileDimension = { width: bitmap.width, height: bitmap.height };
        const limitError = validateImageFileDimension(dimension);
        if (limitError) throw new WorkflowAdapterError("RESOURCE_LIMIT", limitError);
        return { format, width: dimension.width, height: dimension.height, sizeBytes: file.size };
    } finally {
        bitmap.close();
    }
}

export async function convertTo(file: File, target: ImageFileFormat): Promise<File> {
    try {
        return blobToFile(await convertImage(file, target, CONVERT_QUALITY), file.name, target);
    } catch (error) {
        throw asProcessingError(error);
    }
}

export async function resizeTo(file: File, format: ImageFileFormat, dimension: ImageFileDimension): Promise<File> {
    try {
        return blobToFile(await resizeImage(file, format, dimension), file.name, format);
    } catch (error) {
        throw asProcessingError(error);
    }
}

export async function compressTo(file: File, format: ImageFileFormat, quality: number): Promise<File> {
    try {
        return blobToFile(await compressImage(file, format, quality), file.name, format);
    } catch (error) {
        throw asProcessingError(error);
    }
}

/**
 * Verify step: measures the emitted blob from its own bytes. Nothing here trusts form state,
 * predicted dimensions or the blob's declared type.
 */
export async function measureBlob(blob: Blob): Promise<BlobMeasurement> {
    const probe = new File([blob], "output", { type: blob.type });
    let format: ImageFileFormat | null = null;
    try {
        format = await readImageFileFormat(probe);
    } catch (error) {
        if (!(error instanceof ImageFileError)) throw asProcessingError(error);
    }
    const byteLength = (await probe.arrayBuffer()).byteLength;
    if (!format) return { detectedMimeType: null, width: 0, height: 0, byteLength };
    let bitmap: ImageBitmap;
    try {
        bitmap = await decodeImageFile(probe);
    } catch {
        return { detectedMimeType: IMAGE_FILE_ENCODING[format].mime, width: 0, height: 0, byteLength };
    }
    try {
        return { detectedMimeType: IMAGE_FILE_ENCODING[format].mime, width: bitmap.width, height: bitmap.height, byteLength };
    } finally {
        bitmap.close();
    }
}

/* ---------- PDF and multi-file workflows ---------- */

const HEIC_CODE: Record<HeicWorkerError, WorkflowFailureCode> = {
    unsupported: "UNSUPPORTED_FORMAT",
    "decode-failed": "UNSUPPORTED_FORMAT",
    "source-dimension-limit": "RESOURCE_LIMIT",
    "canvas-unavailable": "PROCESSING_FAILED",
    "encode-failed": "PROCESSING_FAILED",
    "worker-start-failed": "PROCESSING_FAILED",
    "worker-runtime-failed": "PROCESSING_FAILED",
    "worker-response-invalid": "PROCESSING_FAILED",
};

const PDF_FILE_CODE: Record<PdfFileFailure, WorkflowFailureCode> = {
    empty: "INVALID_INPUT",
    "source-limit": "SOURCE_LIMIT",
    signature: "UNSUPPORTED_FORMAT",
    encrypted: "UNSUPPORTED_FORMAT",
    malformed: "UNSUPPORTED_FORMAT",
    "page-limit": "PAGE_LIMIT",
    geometry: "UNSUPPORTED_FORMAT",
    "render-limit": "RESOURCE_LIMIT",
    runtime: "PROCESSING_FAILED",
};

const PDF_LIB_CODE: Record<PdfLibFailure, WorkflowFailureCode> = {
    initialization: "PROCESSING_FAILED",
    processing: "PROCESSING_FAILED",
    protocol: "PROCESSING_FAILED",
    timeout: "PROCESSING_FAILED",
    encrypted: "UNSUPPORTED_FORMAT",
};

const PDF_LIB_MESSAGE: Record<PdfLibFailure, string> = {
    initialization: "The PDF engine could not start in this browser. Reload the page and try again.",
    processing: "The PDF engine could not build the PDF. A source may be damaged or unsupported, or the result would exceed the supported size.",
    protocol: "The PDF engine returned a response that was rejected, so the result was discarded. The assembled PDF may exceed the 25 MiB output limit.",
    timeout: "The PDF engine took too long and was stopped. Try fewer or smaller files.",
    encrypted: "Encrypted or password-protected PDFs are unsupported. Choose an unprotected PDF.",
};

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

/** Maps any processor error to a typed workflow error. Abort errors pass through so the runner reports CANCELLED. */
export function toAdapterError(error: unknown, sourceId?: string, label?: string): Error {
    if (isAbortError(error)) return error as Error;
    const prefix = label ? `${label}: ` : "";
    if (error instanceof WorkflowAdapterError) {
        if (error.sourceId || !sourceId) return error;
        return new WorkflowAdapterError(error.code, `${prefix}${error.message}`, sourceId);
    }
    if (error instanceof HeicProcessingError) return new WorkflowAdapterError(HEIC_CODE[error.category], `${prefix}${error.message}`, sourceId);
    if (error instanceof PdfFileError) return new WorkflowAdapterError(PDF_FILE_CODE[error.category], `${prefix}${error.message}`, sourceId);
    if (error instanceof PdfLibProcessingError) return new WorkflowAdapterError(PDF_LIB_CODE[error.category], `${prefix}${PDF_LIB_MESSAGE[error.category]}`, sourceId);
    if (error instanceof PdfToImageError) {
        const code: WorkflowFailureCode = error.category === "option" ? "INVALID_INPUT" : error.category === "verification" ? "VERIFICATION_FAILED" : "PROCESSING_FAILED";
        return new WorkflowAdapterError(code, `${prefix}${error.message}`, sourceId);
    }
    if (error instanceof ImageFileError) return new WorkflowAdapterError("PROCESSING_FAILED", `${prefix}${error.message}`, sourceId);
    return new WorkflowAdapterError("PROCESSING_FAILED", `${prefix}The browser could not process this file. Reset the form and try again.`, sourceId);
}

/** Awaits a worker-style operation and cancels it when the run is aborted. */
async function settle<T>(operation: { promise: Promise<T>; cancel(): void }, signal: AbortSignal): Promise<T> {
    const cancel = () => operation.cancel();
    if (signal.aborted) {
        /* Cancelling rejects the operation; handle that rejection so it is never reported as unhandled. */
        operation.promise.catch(() => undefined);
        operation.cancel();
        throw new DOMException("Operation cancelled", "AbortError");
    }
    signal.addEventListener("abort", cancel, { once: true });
    try {
        return await operation.promise;
    } finally {
        signal.removeEventListener("abort", cancel);
    }
}

let nextHeicOperationId = 0;

export interface HeicPhotoFact {
    width: number;
    height: number;
}

/** Inspect step for one HEIC photo. The HEIC worker, not the file name, decides whether the content is supported. */
export async function inspectHeicPhoto(file: File, ordinal: number, signal: AbortSignal): Promise<HeicPhotoFact> {
    const sourceId = `photo-${ordinal}`;
    try {
        const response = await settle(startHeicOperation({ id: ++nextHeicOperationId, operation: "inspect", file }), signal);
        if (response.status !== "inspected") throw new WorkflowAdapterError("PROCESSING_FAILED", "The HEIC decoder returned an unexpected response.");
        return { width: response.sourceWidth, height: response.sourceHeight };
    } catch (error) {
        throw toAdapterError(error, sourceId, `Photo ${ordinal}`);
    }
}

/**
 * Convert step for one HEIC photo. The encoded bytes stay in memory and are measured from their own bytes
 * before they may reach the PDF engine.
 */
export async function convertHeicPhoto(file: File, ordinal: number, target: "jpeg" | "png", quality: number, signal: AbortSignal): Promise<ImagesToPdfSource> {
    const sourceId = `photo-${ordinal}`;
    const mime = IMAGE_FILE_ENCODING[target].mime;
    try {
        const response = await settle(startHeicOperation({
            id: ++nextHeicOperationId,
            operation: "convert",
            file,
            target,
            ...(target === "jpeg" ? { quality } : {}),
        }), signal);
        if (response.status !== "converted") throw new WorkflowAdapterError("PROCESSING_FAILED", "The HEIC decoder returned an unexpected response.");
        const measurement = await measureBlob(response.blob);
        const dimension = { width: measurement.width, height: measurement.height };
        const checks = [
            response.blob.size > 0,
            measurement.detectedMimeType === mime,
            validateImageFileDimension(dimension) === null,
            dimension.width === response.sourceWidth && dimension.height === response.sourceHeight,
        ];
        if (checks.some(passed => !passed)) {
            throw new WorkflowAdapterError("VERIFICATION_FAILED", "The converted image did not match the original photo, so it was discarded.");
        }
        return { bytes: new Uint8Array(await response.blob.arrayBuffer()), format: target, ...dimension };
    } catch (error) {
        throw toAdapterError(error, sourceId, `Photo ${ordinal}`);
    }
}

export interface PdfSourceFact {
    bytes: Uint8Array;
    inspection: PdfInspection;
}

/** Validate and inspect step for one PDF: real size, header, encryption, page count and per-page geometry. */
export async function inspectPdfSource(file: File, signal: AbortSignal, sourceId?: string): Promise<PdfSourceFact> {
    try {
        return await inspectPdfFile(file, signal);
    } catch (error) {
        throw toAdapterError(error, sourceId, sourceId ? `Source "${sourceId}"` : undefined);
    }
}

export interface PacketImageFact {
    bytes: Uint8Array;
    format: "jpeg" | "png";
    width: number;
    height: number;
}

/** Validate and inspect step for one JPEG or PNG packet source. The declared kind must match the real encoding. */
export async function inspectPacketImage(file: File, kind: "jpeg" | "png", signal: AbortSignal, sourceId: string): Promise<PacketImageFact> {
    const label = `Source "${sourceId}"`;
    try {
        const format = await readSourceFormat(file);
        if (format !== kind) {
            const detail = format === "webp" ? "WebP is not supported in a PDF packet" : `the file is ${IMAGE_FILE_ENCODING[format].label}, not ${IMAGE_FILE_ENCODING[kind].label}`;
            throw new WorkflowAdapterError("UNSUPPORTED_FORMAT", `${detail}. Choose a JPEG, PNG or PDF file.`);
        }
        const fact = await inspectSource(file, format);
        signal.throwIfAborted();
        const bytes = new Uint8Array(await file.arrayBuffer());
        signal.throwIfAborted();
        return { bytes, format: kind, width: fact.width, height: fact.height };
    } catch (error) {
        throw toAdapterError(error, sourceId, label);
    }
}

/** Assemble step for the HEIC workflow: one image per page, in the given order, via the existing images-to-PDF operation. */
export async function assembleImagePdf(source: readonly ImagesToPdfSource[], signal: AbortSignal): Promise<Uint8Array> {
    try {
        return await settle(startImagesToPdfOperation(source), signal);
    } catch (error) {
        throw toAdapterError(error);
    }
}

/** Assemble step for the packet workflow: the additive ordered `assemble` operation of the existing pdf-lib worker. */
export async function assemblePacketPdf(source: readonly PdfPacketSource[], pageOrder: readonly PdfPacketPageRef[], signal: AbortSignal): Promise<Uint8Array> {
    try {
        return await settle(startAssemblePdfOperation(source, pageOrder), signal);
    } catch (error) {
        throw toAdapterError(error);
    }
}

/** Verify step: re-reads the generated PDF with the PDF.js document reader, independent of the engine that wrote it. */
export async function inspectGeneratedPdf(bytes: Uint8Array, signal: AbortSignal): Promise<PdfInspection> {
    try {
        const handle = await settle(openPdfDocument(bytes, "generated-output"), signal);
        try {
            return handle.inspection;
        } finally {
            await handle.close();
        }
    } catch (error) {
        throw toAdapterError(error);
    }
}

/** Optional lossless compression via the existing QPDF owner, including its own independent verification. */
export async function compressPacketPdf(bytes: Uint8Array, signal: AbortSignal): Promise<CompressPdfOutcome> {
    try {
        return await compressPdf(bytes, signal);
    } catch (error) {
        if (isAbortError(error)) throw error;
        const code: WorkflowFailureCode = error instanceof CompressPdfVerificationError ? "VERIFICATION_FAILED" : "PROCESSING_FAILED";
        throw new WorkflowAdapterError(code, compressPdfErrorMessage(error));
    }
}

/** Render step for the slides workflow: the existing PDF.js renderer, with no second rendering algorithm. */
export async function renderPdfPages(bytes: Uint8Array, page: readonly number[], option: PdfToImageOption, signal: AbortSignal): Promise<PdfToImageOutput[]> {
    try {
        return await convertPdfToImages(bytes, page, option, signal);
    } catch (error) {
        throw toAdapterError(error);
    }
}

export { IMAGE_FILE_ENCODING, MAX_PIXEL_AREA, imageFileBasename };
export type { ImageFileFormat };
