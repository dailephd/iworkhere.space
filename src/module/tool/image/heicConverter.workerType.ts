import { validateImageFileDimension } from "./imageFile";
import type { HeicConverterTarget } from "./heicConverter";

export type HeicWorkerError = "unsupported" | "decode-failed" | "source-dimension-limit" |
    "canvas-unavailable" | "encode-failed" | "unexpected-worker-failure";

export interface HeicInspectRequest { id: number; operation: "inspect"; file: File }
export interface HeicConvertRequest { id: number; operation: "convert"; file: File; target: HeicConverterTarget; quality?: number }
export type HeicWorkerRequest = HeicInspectRequest | HeicConvertRequest;
export interface HeicInspectResponse { id: number; status: "inspected"; sourceWidth: number; sourceHeight: number; previewBlob: Blob }
export interface HeicConvertResponse { id: number; status: "converted"; sourceWidth: number; sourceHeight: number; blob: Blob }
export interface HeicErrorResponse { id: number; status: "error"; category: HeicWorkerError }
export type HeicWorkerResponse = HeicInspectResponse | HeicConvertResponse | HeicErrorResponse;

const ERROR_CATEGORY: readonly HeicWorkerError[] = ["unsupported", "decode-failed", "source-dimension-limit", "canvas-unavailable", "encode-failed", "unexpected-worker-failure"];
const ERROR_MESSAGE: Record<HeicWorkerError, string> = {
    unsupported: "Select a supported HEIC or HEIF image. This file is not HEIC/HEIF content.",
    "decode-failed": "This HEIC image could not be decoded. Select another image and try again.",
    "source-dimension-limit": "The source image must have valid dimensions and contain 30 megapixels or fewer.",
    "canvas-unavailable": "This browser cannot process HEIC images in a worker. Try a browser with OffscreenCanvas support.",
    "encode-failed": "The image could not be encoded in the selected format. Try again or select another image.",
    "unexpected-worker-failure": "HEIC processing could not finish. Try again or select another image.",
};

export class HeicProcessingError extends Error {
    constructor(public readonly category: HeicWorkerError) { super(ERROR_MESSAGE[category]); }
}

export function heicErrorResponse(id: number, category: HeicWorkerError): HeicErrorResponse {
    return { id, status: "error", category };
}

export function requireHeicBlob(blob: Blob, mime: string): void {
    if (!(blob instanceof Blob) || blob.type !== mime || blob.size <= 0) throw new HeicProcessingError("encode-failed");
}

// Reject extra diagnostic fields as well as malformed terminal messages.
export function readHeicResponse(value: unknown, request: HeicWorkerRequest): HeicWorkerResponse | null {
    if (!value || typeof value !== "object") return null;
    const response = value as Record<string, unknown>;
    if (response.id !== request.id) return null;
    if (response.status === "error") {
        if (Object.keys(response).length !== 3 || !ERROR_CATEGORY.includes(response.category as HeicWorkerError)) return null;
        return heicErrorResponse(request.id, response.category as HeicWorkerError);
    }
    if (Object.keys(response).length !== 5 || typeof response.sourceWidth !== "number" || typeof response.sourceHeight !== "number") return null;
    if (validateImageFileDimension({ width: response.sourceWidth, height: response.sourceHeight })) return null;
    if (request.operation === "inspect" && response.status === "inspected" && response.previewBlob instanceof Blob) {
        requireHeicBlob(response.previewBlob, "image/png");
        return { id: request.id, status: "inspected", sourceWidth: response.sourceWidth, sourceHeight: response.sourceHeight, previewBlob: response.previewBlob };
    }
    if (request.operation === "convert" && response.status === "converted" && response.blob instanceof Blob) {
        requireHeicBlob(response.blob, `image/${request.target}`);
        return { id: request.id, status: "converted", sourceWidth: response.sourceWidth, sourceHeight: response.sourceHeight, blob: response.blob };
    }
    return null;
}
