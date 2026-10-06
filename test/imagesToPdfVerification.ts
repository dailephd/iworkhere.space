import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
export interface ImagePdfPage { width: number; height: number; rotation: number; pixel: number[][] }
/** Independent PDF.js rendering; colored viewer background distinguishes embedded PNG alpha. */
export async function inspectImagePdf(bytes: Uint8Array): Promise<ImagePdfPage[]> {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Missing PDF signature");
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useWasm: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/" });
    const document = await task.promise;
    const factory = document.canvasFactory as { create(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }; destroy(value: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void };
    try {
        const result: ImagePdfPage[] = [];
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index), viewport = page.getViewport({ scale: 1, rotation: 0 });
            const target = factory.create(viewport.width, viewport.height);
            try {
                await page.render({ canvas: target.canvas, viewport, background: "#12ab34" }).promise;
                const pixel = [[5, 5], [Math.floor(viewport.width * .75), 5], [5, Math.floor(viewport.height * .75)]].map(([x, y]) => [...target.context.getImageData(x, y, 1, 1).data]);
                result.push({ width: viewport.width, height: viewport.height, rotation: page.rotate, pixel });
            } finally { factory.destroy(target); page.cleanup(); }
        }
        return result;
    } finally { await task.destroy(); }
}
