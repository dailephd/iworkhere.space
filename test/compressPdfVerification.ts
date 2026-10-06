import path from "node:path";
import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
export interface CompressionPageEvidence { width: number; height: number; rotation: number; text: string; raster: string }
/** Independent downloaded-artifact evidence, using Node PDF.js on every page. */
export async function inspectCompressedArtifact(bytes: Uint8Array): Promise<CompressionPageEvidence[]> {
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useWasm: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/" });
    try {
        const document = await task.promise;
        const factory = document.canvasFactory as { create(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }; destroy(target: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void };
        const result: CompressionPageEvidence[] = [];
        for (let number = 1; number <= document.numPages; number++) {
            const page = await document.getPage(number), geometry = page.getViewport({ scale: 1, rotation: 0 }), viewport = page.getViewport({ scale: 0.5 });
            const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
            try {
                const text = await page.getTextContent();
                await page.render({ canvas: target.canvas, viewport, background: "#ffffff" }).promise;
                const pixel = target.context.getImageData(0, 0, target.canvas.width, target.canvas.height).data;
                result.push({ width: geometry.width, height: geometry.height, rotation: page.rotate, text: JSON.stringify(text.items.flatMap(item => "str" in item && item.str ? [[item.str, item.hasEOL]] : [])), raster: createHash("sha256").update(pixel).digest("hex") });
            } finally { factory.destroy(target); page.cleanup(); }
        }
        return result;
    } finally { await task.destroy(); }
}
