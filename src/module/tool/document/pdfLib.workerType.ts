import { MAX_AGGREGATE_PDF_BYTES, MAX_INPUT_PDFS, MAX_PDF_PAGES, MAX_SINGLE_PDF_BYTES, MAX_SPLIT_OUTPUT_GROUPS } from "./pdfFile";
import { MAX_IMAGES, MAX_AGGREGATE_IMAGE_BYTES } from "./pdfFile";
import { detectImageFileFormat, validateImageFileDimension, validateImageFileSize } from "../image/imageFile";
import type { ImagesToPdfSource } from "./imagesToPdf";
export type PdfLibFailure = "initialization" | "processing" | "protocol" | "timeout" | "encrypted";
export interface PdfLibFoundationRequest { id: number; bytes: Uint8Array; operation?: "foundation" }
export interface PdfLibMergeRequest { id: number; operation: "merge"; input: Uint8Array[] }
/** Split indices are one-based, unique within each group, and retain requested order. */
export interface PdfLibSplitRequest { id: number; operation: "split"; bytes: Uint8Array; group: number[][] }
export interface PdfLibImagesRequest { id: number; operation: "images-to-pdf"; image: ImagesToPdfSource[] }
export type PdfLibRequest = PdfLibFoundationRequest | PdfLibMergeRequest | PdfLibSplitRequest | PdfLibImagesRequest;
export interface PdfLibSuccess { id: number; status: "success"; bytes: Uint8Array }
export interface PdfLibSplitSuccess { id: number; status: "success"; output: Uint8Array[] }
export interface PdfLibError { id: number; status: "error"; category: PdfLibFailure }
export type PdfLibResponse = PdfLibSuccess | PdfLibSplitSuccess | PdfLibError;
function inputBytes(value: unknown): value is Uint8Array {
    return value instanceof Uint8Array && value.length > 0 && value.length <= MAX_SINGLE_PDF_BYTES;
}
export function readPdfLibRequest(value: unknown): PdfLibRequest | null {
    if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 1) return null;
    const operation = "operation" in value ? value.operation : "foundation";
    if (operation === "images-to-pdf") {
        if (!("image" in value) || !Array.isArray(value.image) || value.image.length < 1 || value.image.length > MAX_IMAGES) return null;
        const image: ImagesToPdfSource[] = [];
        let total = 0;
        for (const entry of value.image) {
            if (!entry || typeof entry !== "object" || !(entry.bytes instanceof Uint8Array) || validateImageFileSize(entry.bytes.length)) return null;
            if (entry.format !== "jpeg" && entry.format !== "png") return null;
            if (detectImageFileFormat(entry.bytes) !== entry.format || validateImageFileDimension(entry)) return null;
            total += entry.bytes.length;
            image.push({ bytes: entry.bytes, format: entry.format, width: entry.width, height: entry.height });
        }
        if (total > MAX_AGGREGATE_IMAGE_BYTES) return null;
        return { id: value.id, operation, image };
    }
    if (operation === "merge") {
        if (!("input" in value) || !Array.isArray(value.input) || value.input.length < 2 || value.input.length > MAX_INPUT_PDFS || !value.input.every(inputBytes)) return null;
        if (value.input.reduce((sum, bytes) => sum + bytes.length, 0) > MAX_AGGREGATE_PDF_BYTES) return null;
        return { id: value.id, operation, input: value.input };
    }
    if (!("bytes" in value) || !inputBytes(value.bytes)) return null;
    if (operation === "foundation") return "operation" in value ? { id: value.id, operation, bytes: value.bytes } : { id: value.id, bytes: value.bytes };
    if (operation !== "split" || !("group" in value) || !Array.isArray(value.group) || value.group.length === 0 || value.group.length > MAX_SPLIT_OUTPUT_GROUPS) return null;
    for (const group of value.group) {
        if (!Array.isArray(group) || group.length === 0 || group.length > MAX_PDF_PAGES || !group.every(page => Number.isSafeInteger(page) && page >= 1 && page <= MAX_PDF_PAGES) || new Set(group).size !== group.length) return null;
    }
    return { id: value.id, operation, bytes: value.bytes, group: value.group };
}
export function readPdfLibResponse(value: unknown, id: number, operation: "foundation" | "merge" | "split" | "images-to-pdf" = "foundation", groupCount = 0): PdfLibResponse | null {
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== id || !("status" in value)) return null;
    if (value.status === "error" && "category" in value && ["initialization", "processing", "protocol", "timeout", "encrypted"].includes(String(value.category))) return { id, status: "error", category: value.category as PdfLibFailure };
    if (value.status !== "success") return null;
    const outputBytes = (bytes: unknown): bytes is Uint8Array => bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= MAX_AGGREGATE_PDF_BYTES;
    if (operation === "split") {
        if (!("output" in value) || !Array.isArray(value.output) || value.output.length !== groupCount || groupCount < 1 || groupCount > MAX_SPLIT_OUTPUT_GROUPS || !value.output.every(outputBytes)) return null;
        return { id, status: "success", output: value.output };
    }
    return "bytes" in value && outputBytes(value.bytes) ? { id, status: "success", bytes: value.bytes } : null;
}
