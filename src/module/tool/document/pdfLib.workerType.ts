import { MAX_AGGREGATE_PDF_BYTES, MAX_SINGLE_PDF_BYTES } from "./pdfFile";
export type PdfLibFailure = "initialization" | "processing" | "protocol" | "timeout" | "encrypted";
export interface PdfLibRequest { id: number; bytes: Uint8Array }
export interface PdfLibSuccess { id: number; status: "success"; bytes: Uint8Array }
export interface PdfLibError { id: number; status: "error"; category: PdfLibFailure }
export type PdfLibResponse = PdfLibSuccess | PdfLibError;
export function readPdfLibRequest(value: unknown): PdfLibRequest | null {
    if (!value || typeof value !== "object" || !("id" in value) || !("bytes" in value)) return null;
    if (typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 1 || !(value.bytes instanceof Uint8Array) || value.bytes.length === 0 || value.bytes.length > MAX_SINGLE_PDF_BYTES) return null;
    return { id: value.id, bytes: value.bytes };
}
export function readPdfLibResponse(value: unknown, id: number): PdfLibResponse | null {
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== id || !("status" in value)) return null;
    if (value.status === "success" && "bytes" in value && value.bytes instanceof Uint8Array && value.bytes.length > 0 && value.bytes.length <= MAX_AGGREGATE_PDF_BYTES) return { id, status: "success", bytes: value.bytes };
    if (value.status === "error" && "category" in value && ["initialization", "processing", "protocol", "timeout", "encrypted"].includes(String(value.category))) return { id, status: "error", category: value.category as PdfLibFailure };
    return null;
}
