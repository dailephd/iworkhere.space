import { heicTo, isHeic } from "heic-to/next";
import { validateImageFileDimension, validateImageFileSize } from "./imageFile";
import { heicPreviewDimension } from "./heicConverter";
import { encodeHeicBitmap } from "./heicConverter.canvas";
import { HeicProcessingError, heicErrorResponse, type HeicWorkerRequest, type HeicWorkerResponse } from "./heicConverter.workerType";

interface HeicWorkerScope {
    onmessage: ((event: MessageEvent<HeicWorkerRequest>) => void) | null;
    postMessage(message: HeicWorkerResponse): void;
}
const scope = self as unknown as HeicWorkerScope;

async function processRequest(request: HeicWorkerRequest): Promise<HeicWorkerResponse> {
    let bitmap: ImageBitmap | null = null;
    try {
        if (validateImageFileSize(request.file.size) || !await isHeic(request.file)) throw new HeicProcessingError("unsupported");
        try { bitmap = await heicTo({ blob: request.file, type: "bitmap" }); }
        catch { throw new HeicProcessingError("decode-failed"); }
        const sourceWidth = bitmap.width, sourceHeight = bitmap.height;
        if (validateImageFileDimension({ width: sourceWidth, height: sourceHeight })) throw new HeicProcessingError("source-dimension-limit");
        if (request.operation === "inspect") {
            const preview = heicPreviewDimension(sourceWidth, sourceHeight);
            const previewBlob = await encodeHeicBitmap(bitmap, preview.width, preview.height, "png");
            return { id: request.id, status: "inspected", sourceWidth, sourceHeight, previewBlob };
        }
        // encodeHeicBitmap explicitly fills #ffffff before drawing JPEG; PNG remains transparent.
        const blob = await encodeHeicBitmap(bitmap, sourceWidth, sourceHeight, request.target, request.quality);
        return { id: request.id, status: "converted", sourceWidth, sourceHeight, blob };
    } catch (failure) {
        return heicErrorResponse(request.id, failure instanceof HeicProcessingError ? failure.category : "unexpected-worker-failure");
    } finally { bitmap?.close(); }
}

scope.onmessage = event => { void processRequest(event.data).then(response => scope.postMessage(response)); };
