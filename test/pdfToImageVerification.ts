import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
export interface PdfRasterReference { width: number; height: number; sample: { x: number; y: number; pixel: number[] }[]; label: { x: number; y: number; width: number; height: number; pixel: number[] } }
/** Independent PDF.js fixture reference: honors rotation, samples flat content and page-label pixels. */
export async function referencePdfRaster(bytes: Uint8Array, pageNumber: number, dpi: number): Promise<PdfRasterReference> {
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useWasm: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/" });
    const document = await task.promise;
    const factory = document.canvasFactory as { create(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }; destroy(value: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void };
    try {
        const page = await document.getPage(pageNumber), viewport = page.getViewport({ scale: dpi / 72 });
        const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height), target = factory.create(width, height);
        try {
            await page.render({ canvas: target.canvas, viewport, background: "#ffffff" }).promise;
            const sample = [[35, 25], [70, 60]].map(([x, y]) => {
                const point = viewport.convertToViewportPoint(x, y), px = Math.floor(point[0]), py = Math.floor(point[1]);
                return { x: px, y: py, pixel: [...target.context.getImageData(px, py, 1, 1).data] };
            });
            const rectangle = [...viewport.convertToViewportPoint(15, 205), ...viewport.convertToViewportPoint(70, 225)];
            const x = Math.floor(Math.min(rectangle[0], rectangle[2])), y = Math.floor(Math.min(rectangle[1], rectangle[3]));
            const labelWidth = Math.ceil(Math.max(rectangle[0], rectangle[2])) - x, labelHeight = Math.ceil(Math.max(rectangle[1], rectangle[3])) - y;
            return { width, height, sample, label: { x, y, width: labelWidth, height: labelHeight, pixel: [...target.context.getImageData(x, y, labelWidth, labelHeight).data] } };
        } finally { factory.destroy(target); page.cleanup(); }
    } finally { await task.destroy(); }
}
