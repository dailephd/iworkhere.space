"use client";
import { useEffect } from "react";
import { openPdfDocument, renderPdfPage } from "../src/module/tool/document/pdfRuntime.client";
import { startPdfLibOperation } from "../src/module/tool/document/pdfLib.client";
import { startQpdfOperation } from "../src/module/tool/document/qpdf.client";
import { classifyPdfFailure } from "../src/module/tool/document/pdfFile";
export interface FoundationResult { category?: string; pageCount?: number; page?: { width: number; height: number; rotation: number }[]; raster?: string; text?: string[]; outputBytes?: number; nativeWidth?: number; nativeHeight?: number }
declare global { interface Window { pdfFoundation?: (input: number[], kind: string) => Promise<FoundationResult> } }
export default function PdfFoundationClient() {
    useEffect(() => {
        window.pdfFoundation = async (input, kind) => {
            let bytes = new Uint8Array(input);
            try {
                if (kind === "pdfLib" || kind === "qpdf" || kind === "cancelLib" || kind === "cancelQpdf") {
                    const operation = kind === "pdfLib" || kind === "cancelLib" ? startPdfLibOperation(bytes) : startQpdfOperation(bytes);
                    if (kind.startsWith("cancel")) operation.cancel();
                    bytes = new Uint8Array(await operation.promise);
                }
                const operation = openPdfDocument(bytes);
                if (kind === "cancelPdf") operation.cancel();
                const handle = await operation.promise;
                try {
                    const canvas = document.createElement("canvas");
                    const controller = kind === "cancelRender" ? new AbortController() : undefined;
                    const rendering = renderPdfPage(handle, 1, canvas, 1, controller?.signal);
                    if (controller) queueMicrotask(() => controller.abort());
                    await rendering;
                    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Raster encoding failed")), "image/png"));
                    const image = await createImageBitmap(blob);
                    const nativeWidth = image.width, nativeHeight = image.height; image.close();
                    const raster = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).map(value => value.toString(16).padStart(2, "0")).join("");
                    const text: string[] = [];
                    for (let index = 1; index <= handle.inspection.pageCount; index++) {
                        const page = await handle.document.getPage(index);
                        const content = await page.getTextContent();
                        text.push(content.items.map(item => "str" in item ? item.str : "").join(" ")); page.cleanup();
                    }
                    return { ...handle.inspection, raster, text, outputBytes: bytes.length, nativeWidth, nativeHeight };
                } finally { await handle.close(); }
            } catch (error) { return { category: error instanceof DOMException && error.name === "AbortError" ? "cancelled" : error && typeof error === "object" && "category" in error ? String(error.category) : classifyPdfFailure(error) }; }
        };
        return () => { delete window.pdfFoundation; };
    }, []);
    return <p>PDF foundation test harness</p>;
}
