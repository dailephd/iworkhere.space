import { MAX_PIXEL_AREA, validateImageFileDimension, type ImageFileDimension } from "./imageFile";
import type { HeicConverterTarget } from "./heicConverter";

export type HeicWorkerError = "unsupported" | "decode-failed" | "source-dimension-limit" |
    "canvas-unavailable" | "encode-failed" | "worker-start-failed" | "worker-runtime-failed" | "worker-response-invalid";

export interface HeicInspectRequest { id: number; operation: "inspect"; file: File }
export interface HeicConvertRequest { id: number; operation: "convert"; file: File; target: HeicConverterTarget; quality?: number }
export type HeicWorkerRequest = HeicInspectRequest | HeicConvertRequest;
export interface HeicInspectResponse { id: number; status: "inspected"; sourceWidth: number; sourceHeight: number; previewBlob: Blob }
export interface HeicConvertResponse { id: number; status: "converted"; sourceWidth: number; sourceHeight: number; blob: Blob }
export interface HeicErrorResponse { id: number; status: "error"; category: HeicWorkerError; sourceWidth?: number; sourceHeight?: number }
export type HeicWorkerResponse = HeicInspectResponse | HeicConvertResponse | HeicErrorResponse;

const ERROR_CATEGORY: readonly HeicWorkerError[] = ["unsupported", "decode-failed", "source-dimension-limit", "canvas-unavailable", "encode-failed", "worker-start-failed", "worker-runtime-failed", "worker-response-invalid"];
const ERROR_MESSAGE: Record<HeicWorkerError, string> = {
    unsupported: "This file is not valid HEIC or HEIF content. Choose a HEIC or HEIF image.",
    "decode-failed": "The file is HEIC/HEIF content, but its image data could not be decoded. It may be damaged or use an HEIC variant this decoder does not support. Choose another HEIC or HEIF image.",
    "source-dimension-limit": "The image reported invalid dimensions and cannot be processed. Choose another HEIC or HEIF image.",
    "canvas-unavailable": "This browser does not provide the off-screen canvas required for HEIC conversion. Use another current browser with OffscreenCanvas support.",
    "encode-failed": "The HEIC image decoded successfully, but the browser could not produce a valid result. Reset the tool and try again, choose the other output format, or try another current browser.",
    "worker-start-failed": "HEIC processing could not start because the browser could not create the decoder worker. Reload the page and try again, or use another current browser.",
    "worker-runtime-failed": "The HEIC decoder worker stopped unexpectedly while processing this image. Reset the tool and try again. If the problem repeats, try another current browser.",
    "worker-response-invalid": "The HEIC decoder returned an invalid response, so the result was discarded. Reset the tool and try again.",
};

export class HeicProcessingError extends Error {
    constructor(public readonly category: HeicWorkerError, public readonly dimension?: ImageFileDimension,
        target?: HeicConverterTarget, operation?: "inspect" | "convert") {
        let message = ERROR_MESSAGE[category];
        if (category === "source-dimension-limit" && dimension && isOversizedDimension(dimension.width, dimension.height)) {
            message = `This HEIC image is ${dimension.width} × ${dimension.height} px (${(dimension.width * dimension.height).toLocaleString("en-US")} pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller HEIC or HEIF image.`;
        }
        if (category === "encode-failed" && target) {
            message = operation === "inspect"
                ? "The HEIC image decoded successfully, but the browser could not create its PNG preview. Reset the tool and try again, or try another current browser."
                : `The HEIC image decoded successfully, but the browser could not produce a valid ${target === "jpeg" ? "JPEG" : "PNG"} result. Reset the tool and try again, choose the other output format, or try another current browser.`;
        }
        super(message);
    }
}

function isOversizedDimension(width: number, height: number): boolean {
    return Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0 &&
        Number.isSafeInteger(width * height) && width * height > MAX_PIXEL_AREA;
}

export function heicErrorResponse(id: number, category: HeicWorkerError, dimension?: ImageFileDimension): HeicErrorResponse {
    if (category === "source-dimension-limit" && dimension && isOversizedDimension(dimension.width, dimension.height)) {
        return { id, status: "error", category, sourceWidth: dimension.width, sourceHeight: dimension.height };
    }
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
        if (!ERROR_CATEGORY.includes(response.category as HeicWorkerError)) return null;
        if (Object.keys(response).length === 5 && response.category === "source-dimension-limit" &&
            typeof response.sourceWidth === "number" && typeof response.sourceHeight === "number" &&
            isOversizedDimension(response.sourceWidth, response.sourceHeight)) {
            return heicErrorResponse(request.id, "source-dimension-limit", { width: response.sourceWidth, height: response.sourceHeight });
        }
        if (Object.keys(response).length !== 3 || "sourceWidth" in response || "sourceHeight" in response) return null;
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
