import { heicQuality, heicRequiresWhite, type HeicConverterTarget } from "./heicConverter";
import { HeicProcessingError, requireHeicBlob } from "./heicConverter.workerType";

// Worker-local output composition; also used for the presentation-only PNG preview.
export async function encodeHeicBitmap(bitmap: ImageBitmap, width: number, height: number, target: HeicConverterTarget, quality?: number): Promise<Blob> {
    if (typeof OffscreenCanvas === "undefined") throw new HeicProcessingError("canvas-unavailable");
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new HeicProcessingError("canvas-unavailable");
    if (heicRequiresWhite(target)) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const mime = `image/${target}`;
    const fraction = heicQuality(target, quality);
    try {
        const blob = await canvas.convertToBlob(fraction === undefined ? { type: mime } : { type: mime, quality: fraction });
        requireHeicBlob(blob, mime);
        return blob;
    } catch { throw new HeicProcessingError("encode-failed"); }
}
