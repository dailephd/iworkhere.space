"use client";
import { useEffect } from "react";
import { openPdfDocument, renderPdfPage } from "../src/module/tool/document/pdfRuntime.client";
import { startPdfLibOperation, startMergePdfOperation, startSplitPdfOperation } from "../src/module/tool/document/pdfLib.client";
import { startQpdfOperation, startCompressPdfOperation } from "../src/module/tool/document/qpdf.client";
import { compressPdf } from "../src/module/tool/document/compressPdf.client";
import { verifyCompressedPdf } from "../src/module/tool/document/compressPdfVerification.client";
import { classifyPdfFailure, type PdfInspection } from "../src/module/tool/document/pdfFile";
import { parsePageSelection } from "../src/module/tool/document/pageSelection";
import { verifyPdfLibOutput } from "../src/module/tool/document/pdfLibVerification.client";
import { convertPdfToImages } from "../src/module/tool/document/pdfToImage.client";
import type { PdfToImageOption } from "../src/module/tool/document/pdfToImage";
export interface PdfImageProof { category?: string; canvasCount: number; output: { pageNumber: number; mime: string; width: number; height: number; hash: string; referenceHash: string; maximumDifference: number; meanDifference: number }[] }
export interface FoundationResult { category?: string; pageCount?: number; page?: { width: number; height: number; rotation: number }[]; raster?: string; text?: string[]; outputBytes?: number; nativeWidth?: number; nativeHeight?: number }
export interface PageCopyResult extends FoundationResult { pageRaster?: string[]; signature?: string }
export interface CompressionProof { category?: string; INPUT_BYTES: number; OUTPUT_BYTES?: number; REDUCTION_BYTES?: number; REDUCTION_PERCENT?: number; QPDF_EXIT_STATUS?: number; PAGE_COUNT_BEFORE?: number; PAGE_COUNT_AFTER?: number; PAGE_GEOMETRY?: string; ROTATION?: string; TEXT_COMPARISON?: string; RENDER_COMPARISON?: string; WARNINGS: string; DURATION: number; outcome?: string }
declare global { interface Window {
    pdfFoundation?: (input: number[], kind: string) => Promise<FoundationResult>;
    pdfPageCopy?: (input: number[][], kind: "inspect" | "merge" | "split" | "cancelMerge" | "cancelSplit", expression?: string[]) => Promise<PageCopyResult[]>;
    pdfImageExport?: (input: number[], page: number[], option: PdfToImageOption, cancel?: boolean) => Promise<PdfImageProof>;
    pdfCompression?: (input: number[], cancel?: boolean) => Promise<CompressionProof>;
} }
export default function PdfFoundationClient() {
    useEffect(() => {
        window.pdfCompression = async (input, cancel) => {
            const started = performance.now(), bytes = new Uint8Array(input);
            const proof: CompressionProof = { INPUT_BYTES: bytes.length, WARNINGS: "NONE", DURATION: 0 };
            try {
                const operation = startCompressPdfOperation(bytes);
                if (cancel) operation.cancel();
                const candidate = await operation.promise;
                proof.QPDF_EXIT_STATUS = 0; proof.OUTPUT_BYTES = candidate.length;
                proof.REDUCTION_BYTES = bytes.length - candidate.length; proof.REDUCTION_PERCENT = proof.REDUCTION_BYTES / bytes.length * 100;
                // Corpus acceptance verifies even discarded candidates, then deeply renders every page.
                await verifyCompressedPdf(bytes, candidate, new AbortController().signal);
                const source = await window.pdfPageCopy!([input], "inspect");
                const output = await window.pdfPageCopy!([[...candidate]], "inspect");
                proof.PAGE_COUNT_BEFORE = source[0].pageCount; proof.PAGE_COUNT_AFTER = output[0].pageCount;
                proof.PAGE_GEOMETRY = JSON.stringify(source[0].page) === JSON.stringify(output[0].page) ? "PASS" : "FAIL";
                proof.ROTATION = proof.PAGE_GEOMETRY;
                proof.TEXT_COMPARISON = JSON.stringify(source[0].text) === JSON.stringify(output[0].text) ? "PASS" : "FAIL";
                proof.RENDER_COMPARISON = JSON.stringify(source[0].pageRaster) === JSON.stringify(output[0].pageRaster) ? "PASS_ALL_PAGES" : "FAIL";
                proof.outcome = (await compressPdf(bytes, new AbortController().signal)).status;
            } catch (error) { proof.category = error instanceof DOMException && error.name === "AbortError" ? "cancelled" : error && typeof error === "object" && "category" in error ? String(error.category) : "verification"; }
            proof.DURATION = performance.now() - started;
            return proof;
        };
        window.pdfImageExport = async (input, selection, option, cancel) => {
            const proof: PdfImageProof = { canvasCount: 0, output: [] };
            const nativeCreate = document.createElement.bind(document);
            document.createElement = ((tag: string, options?: ElementCreationOptions) => {
                if (tag === "canvas") proof.canvasCount++;
                return nativeCreate(tag, options);
            }) as typeof document.createElement;
            try {
                const controller = new AbortController();
                const processing = convertPdfToImages(new Uint8Array(input), selection, option, controller.signal);
                if (cancel) controller.abort();
                const output = await processing;
                document.createElement = nativeCreate;
                const reference = await openPdfDocument(new Uint8Array(input)).promise;
                const hash = async (data: Uint8ClampedArray) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data)))).map(value => value.toString(16).padStart(2, "0")).join("");
                try {
                    for (const item of output) {
                        const canvas = nativeCreate("canvas"), decoded = nativeCreate("canvas");
                        const bitmap = await createImageBitmap(item.blob);
                        try {
                            await renderPdfPage(reference, item.pageNumber, canvas, option.dpi / 72, undefined, option.format === "jpeg" ? "#ffffff" : undefined);
                            decoded.width = bitmap.width; decoded.height = bitmap.height;
                            decoded.getContext("2d")!.drawImage(bitmap, 0, 0);
                            const actual = decoded.getContext("2d")!.getImageData(0, 0, decoded.width, decoded.height).data;
                            const expected = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
                            let maximumDifference = 0, total = 0;
                            for (let index = 0; index < actual.length; index++) { const difference = Math.abs(actual[index] - expected[index]); maximumDifference = Math.max(maximumDifference, difference); total += difference; }
                            proof.output.push({ pageNumber: item.pageNumber, mime: item.blob.type, width: bitmap.width, height: bitmap.height, hash: await hash(actual), referenceHash: await hash(expected), maximumDifference, meanDifference: total / actual.length });
                        } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; decoded.width = 0; decoded.height = 0; }
                    }
                } finally { await reference.close(); }
            } catch (error) { proof.category = error instanceof DOMException && error.name === "AbortError" ? "cancelled" : error && typeof error === "object" && "category" in error ? String(error.category) : classifyPdfFailure(error); }
            finally { document.createElement = nativeCreate; }
            return proof;
        };
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
        return () => { delete window.pdfFoundation; delete window.pdfPageCopy; delete window.pdfImageExport; delete window.pdfCompression; };
    }, []);
    return <p>PDF foundation test harness</p>;
}
