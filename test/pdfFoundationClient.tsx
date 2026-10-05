"use client";
import { useEffect } from "react";
import { openPdfDocument, renderPdfPage } from "../src/module/tool/document/pdfRuntime.client";
import { startPdfLibOperation, startMergePdfOperation, startSplitPdfOperation } from "../src/module/tool/document/pdfLib.client";
import { startQpdfOperation } from "../src/module/tool/document/qpdf.client";
import { classifyPdfFailure, type PdfInspection } from "../src/module/tool/document/pdfFile";
import { parsePageSelection } from "../src/module/tool/document/pageSelection";
import { verifyPdfLibOutput } from "../src/module/tool/document/pdfLibVerification.client";
export interface FoundationResult { category?: string; pageCount?: number; page?: { width: number; height: number; rotation: number }[]; raster?: string; text?: string[]; outputBytes?: number; nativeWidth?: number; nativeHeight?: number }
export interface PageCopyResult extends FoundationResult { pageRaster?: string[]; signature?: string }
declare global { interface Window {
    pdfFoundation?: (input: number[], kind: string) => Promise<FoundationResult>;
    pdfPageCopy?: (input: number[][], kind: "inspect" | "merge" | "split" | "cancelMerge" | "cancelSplit", expression?: string[]) => Promise<PageCopyResult[]>;
} }
export default function PdfFoundationClient() {
    useEffect(() => {
        window.pdfPageCopy = async (input, kind, expression = []) => {
            try {
                const source: Uint8Array[] = input.map(value => new Uint8Array(value));
                const inspection: PdfInspection[] = [];
                for (const bytes of source) {
                    const handle = await openPdfDocument(bytes).promise;
                    try { inspection.push(handle.inspection); } finally { await handle.close(); }
                }
                const selection = expression.map(value => {
                    const parsed = parsePageSelection(value, { pageCount: inspection[0].pageCount, maxOutputCount: 100 });
                    if (!parsed.ok) throw new Error("Invalid test expression");
                    return parsed.page;
                });
                let output = source;
                if (kind !== "inspect") {
                    if (kind === "merge" || kind === "cancelMerge") {
                        const operation = startMergePdfOperation(source);
                        if (kind === "cancelMerge") operation.cancel();
                        output = [await operation.promise];
                    } else {
                        const operation = startSplitPdfOperation(source[0], selection);
                        if (kind === "cancelSplit") operation.cancel();
                        output = await operation.promise;
                    }
                }
                const expected = kind === "inspect" ? inspection.map(value => value.page) : kind === "merge" ? [inspection.flatMap(value => value.page)] : selection.map(group => group.map(page => inspection[0].page[page - 1]));
                const result: PageCopyResult[] = [];
                for (let index = 0; index < output.length; index++) {
                    const bytes = output[index];
                    await verifyPdfLibOutput(bytes, expected[index], new AbortController().signal);
                    const handle = await openPdfDocument(bytes, "generated-output").promise;
                    try {
                        const text: string[] = [], pageRaster: string[] = [];
                        for (let pageNumber = 1; pageNumber <= handle.inspection.pageCount; pageNumber++) {
                            const page = await handle.document.getPage(pageNumber);
                            const content = await page.getTextContent();
                            text.push(content.items.map(item => "str" in item ? item.str : "").join(" ")); page.cleanup();
                            const canvas = document.createElement("canvas");
                            await renderPdfPage(handle, pageNumber, canvas);
                            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Raster failed")), "image/png"));
                            pageRaster.push(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).map(value => value.toString(16).padStart(2, "0")).join(""));
                            canvas.width = 0; canvas.height = 0;
                        }
                        result.push({ ...handle.inspection, text, pageRaster, signature: new TextDecoder().decode(bytes.subarray(0, 5)), outputBytes: bytes.length });
                    } finally { await handle.close(); }
                }
                return result;
            } catch (error) { return [{ category: error instanceof DOMException && error.name === "AbortError" ? "cancelled" : classifyPdfFailure(error) }]; }
        };
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
        return () => { delete window.pdfFoundation; delete window.pdfPageCopy; };
    }, []);
    return <p>PDF foundation test harness</p>;
}
