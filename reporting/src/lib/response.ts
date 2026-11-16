import { serializeReportingResponse, validateReportingResponse } from "../../../dashboard/src/lib/reportingModel";
import { SUPPORTED_PROTOCOL_VERSIONS, type CallToolResult } from "@modelcontextprotocol/server";

export const MAX_MCP_BYTES = 64 * 1024;
export class ServiceUnavailable extends Error {
    constructor(public readonly code: "configuration" | "database" | "size_limit" | "invalid_result") { super("Reporting unavailable: " + code); }
}
/** Bound bytes while reading; never buffer an unlimited upstream response. */
export async function boundedBytes(response: Response, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
    if (Number(response.headers.get("content-length")) > maximum || !response.body) {
        await response.body?.cancel(); throw new ServiceUnavailable("size_limit");
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const item = await reader.read(); if (item.done) break;
            size += item.value.byteLength;
            if (size > maximum) { await reader.cancel(); throw new ServiceUnavailable("size_limit"); }
            chunks.push(item.value);
        }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
}
export function reportResult(value: unknown): CallToolResult {
    const dto = validateReportingResponse(value), text = serializeReportingResponse(dto);
    // Parse only an already validated DTO: excludes prototype/serialization tricks.
    const result = { content: [{ type: "text" as const, text }], structuredContent: JSON.parse(text) };
    // Leave additional room for SDK JSON-RPC id and metadata; final envelope is checked too.
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_MCP_BYTES - 8192) throw new ServiceUnavailable("size_limit");
    return result;
}
export function unavailableResult(): CallToolResult {
    return { isError: true, content: [{ type: "text", text: "Reporting is temporarily unavailable. No report was returned." }] };
}
export function safeResponse(status: number, error: string): Response {
    return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Protocol errors keep the SDK's status/code/id but never diagnostic or input text. */
export function boundedProtocolText(text: string, contentType: string): string {
    function normalize(value: unknown): unknown {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
        const message = value as Record<string, unknown>;
        if (typeof message.error === "object" && message.error !== null) {
            const error = message.error as Record<string, unknown>;
            const data = typeof error.data === "object" && error.data !== null ? error.data as Record<string, unknown> : null;
            const supported = data && Array.isArray(data.supported) && data.supported.length <= SUPPORTED_PROTOCOL_VERSIONS.length && data.supported.every(item => typeof item === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(item));
            const versionData = supported && typeof data?.requested === "string" && /^\d{4}-\d\d-\d\d$/.test(data.requested) ? { supported: data.supported, requested: data.requested } : undefined;
            return { jsonrpc: "2.0", id: message.id ?? null, error: { code: error.code, message: "MCP request rejected.", ...(versionData ? { data: versionData } : {}) } };
        }
        const result = message.result;
        if (typeof result === "object" && result !== null && (result as Record<string, unknown>).isError === true) return { ...message, result: unavailableResult() };
        return value;
    }
    const result = contentType.includes("text/event-stream")
        ? text.split("\n").map(line => line.startsWith("data: ") ? "data: " + JSON.stringify(normalize(JSON.parse(line.slice(6)))) : line).join("\n")
        : JSON.stringify(normalize(JSON.parse(text)));
    if (Buffer.byteLength(result, "utf8") > MAX_MCP_BYTES) throw new ServiceUnavailable("size_limit");
    return result;
}
