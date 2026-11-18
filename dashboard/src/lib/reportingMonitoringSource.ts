export const PUBLIC_PROJECT = "prj_OZIQho0P485NwArPlWTQuYfSQtNI";
/** Reduce authenticated provider request logs in memory. Never return provider
 * envelopes, request identifiers, headers, diagnostic or metric-body messages. */
export function healthRequestRows(text: string): Record<string, unknown>[] {
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new Error("log_limit");
    const result: Record<string, unknown>[] = [];
    for (const line of text.split("\n").filter(Boolean)) {
        let row: unknown;
        try { row = JSON.parse(line); } catch { throw new Error("log_shape"); }
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("log_shape");
        const request = row as Record<string, unknown>;
        result.push(request);
    }
    return result;
}
export function healthRequestMessages(request: Record<string, unknown>): unknown[] {
    const result: unknown[] = [];
    if (request.projectId !== PUBLIC_PROJECT || request.environment !== "production"
        || !["/api/metric", "/api/observability/maintenance"].includes(String(request.requestPath))) return result;
    const messages: unknown[] = [request.message];
    if (Array.isArray(request.logs)) {
        if (request.logs.length > 256) throw new Error("log_limit");
        for (const item of request.logs) if (item && typeof item === "object" && !Array.isArray(item)) messages.push((item as Record<string, unknown>).message);
    }
    for (const message of messages) {
        if (typeof message !== "string" || message.length > 768) continue;
        let value: unknown; try { value = JSON.parse(message); } catch { continue; }
        if (value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).source === "observability-health") result.push(value);
    }
    return result;
}

export function healthOperationMessages(text: string): unknown[] {
    return healthRequestRows(text).flatMap(healthRequestMessages);
}
