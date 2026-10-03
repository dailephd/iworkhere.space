import { exact, record, safePathname, token } from "./metric";

export interface SafeLogRequest {
    level: "debug" | "info" | "warn" | "error";
    message: "Application event" | "Client failure";
    timestamp: string;
    pathname: string;
    meta: Record<string, string>;
}
const semanticKeys = ["toolId", "boundary", "failureCategory", "placement"];
export function safeLogMeta(meta?: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    if (!meta) return result;
    for (const key of semanticKeys) if (token(meta[key])) result[key] = meta[key];
    // Keep emitted application asset locations, never messages, input or function names.
    if (typeof meta.stack === "string") {
        const frames = meta.stack.match(/\/_next\/static\/[a-zA-Z0-9_./-]+\.js:\d+:\d+/g)?.slice(0, 10);
        if (frames?.length) result.stack = frames.join("\n").slice(0, 2048);
    }
    return result;
}
export function isSafeLogRequest(value: unknown): value is SafeLogRequest {
    if (!record(value) || !exact(value, ["level", "message", "timestamp", "pathname", "meta"])) return false;
    if (typeof value.level !== "string" || !["debug", "info", "warn", "error"].includes(value.level) || typeof value.message !== "string" || !["Application event", "Client failure"].includes(value.message)) return false;
    if (typeof value.timestamp !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp))) return false;
    if (typeof value.pathname !== "string" || safePathname(value.pathname) !== value.pathname || !record(value.meta)) return false;
    const clean = safeLogMeta(value.meta);
    return Object.keys(value.meta).length === Object.keys(clean).length && Object.entries(value.meta).every(([key, item]) => clean[key] === item);
}
