import { MAX_AGGREGATE_PDF_BYTES, MAX_SINGLE_PDF_BYTES } from "./pdfFile";
export type QpdfFailure = "initialization" | "processing" | "protocol" | "timeout" | "encrypted";
export interface QpdfRequest { id: number; bytes: Uint8Array }
export interface QpdfSuccess { id: number; status: "success"; bytes: Uint8Array }
export interface QpdfError { id: number; status: "error"; category: QpdfFailure }
export type QpdfResponse = QpdfSuccess | QpdfError;
export function readQpdfRequest(value: unknown): QpdfRequest | null {
    if (!value || typeof value !== "object" || !("id" in value) || !("bytes" in value)) return null;
    if (typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 1 || !(value.bytes instanceof Uint8Array) || value.bytes.length === 0 || value.bytes.length > MAX_SINGLE_PDF_BYTES) return null;
    return { id: value.id, bytes: value.bytes };
}
export function readQpdfResponse(value: unknown, id: number): QpdfResponse | null {
    if (!value || typeof value !== "object" || !("id" in value) || value.id !== id || !("status" in value)) return null;
    if (value.status === "success" && "bytes" in value && value.bytes instanceof Uint8Array && value.bytes.length > 0 && value.bytes.length <= MAX_AGGREGATE_PDF_BYTES) return { id, status: "success", bytes: value.bytes };
    if (value.status === "error" && "category" in value && ["initialization", "processing", "protocol", "timeout", "encrypted"].includes(String(value.category))) return { id, status: "error", category: value.category as QpdfFailure };
    return null;
}
