import { exact, record, safePathname, token } from "./metric";
import { diagnosticText } from "./diagnosticText";
import type { DiagnosticError, ErrorDiagnostic } from "./diagnostic";

export interface SafeLogRequest {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    timestamp: string;
    pathname: string;
    meta: Record<string, string>;
    diagnostic?: ErrorDiagnostic;
}
const semanticKeys = ["toolId", "boundary", "failureCategory", "placement"];
export function safeLogMeta(meta?: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    if (!meta) return result;
    for (const key of semanticKeys) if (token(meta[key])) result[key] = meta[key];
    return result;
}
export function isSafeLogRequest(value: unknown): value is SafeLogRequest {
    if (!record(value) || !exact(value, ["level", "message", "timestamp", "pathname", "meta", "diagnostic"])) return false;
    if (typeof value.level !== "string" || !["debug", "info", "warn", "error"].includes(value.level) || !boundedText(value.message, 4096)) return false;
    if (typeof value.timestamp !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp))) return false;
    if (typeof value.pathname !== "string" || safePathname(value.pathname) !== value.pathname || !record(value.meta)) return false;
    const clean = safeLogMeta(value.meta);
    if (Object.keys(value.meta).length !== Object.keys(clean).length || !Object.entries(value.meta).every(([key, item]) => clean[key] === item)) return false;
    return value.diagnostic === undefined || isClientDiagnostic(value.diagnostic) && value.diagnostic.severity === value.level && value.diagnostic.context.pathname === value.pathname;
}

function boundedText(value: unknown, maximum: number): value is string {
    return typeof value === "string" && new TextEncoder().encode(value).length <= maximum;
}
export function isDiagnosticError(value: unknown, depth = 0): value is DiagnosticError {
    if (depth > 6 || !record(value) || !exact(value, ["name", "message", "stack", "valueType", "code", "digest", "status", "statusCode", "errno", "syscall", "type", "cause", "errors", "truncated"])) return false;
    if (!boundedText(value.name, 256) || !boundedText(value.message, 4096) || value.stack !== undefined && !boundedText(value.stack, 24576)) return false;
    if (value.valueType !== undefined && !boundedText(value.valueType, 32) || value.truncated !== undefined && typeof value.truncated !== "boolean") return false;
    for (const key of ["code", "digest", "status", "statusCode", "errno", "syscall", "type"]) {
        const item = value[key];
        if (item !== undefined && !boundedText(item, 256) && !(typeof item === "number" && Number.isFinite(item))) return false;
    }
    if (value.cause !== undefined && !isDiagnosticError(value.cause, depth + 1)) return false;
    return value.errors === undefined || Array.isArray(value.errors) && value.errors.length <= 10 && value.errors.every(child => isDiagnosticError(child, depth + 1));
}
export function redactSerializedError(error: DiagnosticError): DiagnosticError {
    const result = { ...error, name: diagnosticText(error.name, 256), message: diagnosticText(error.message, 4096) };
    if (result.stack !== undefined) result.stack = diagnosticText(result.stack, 24576);
    for (const key of ["code", "digest", "status", "statusCode", "errno", "syscall", "type"] as const) if (typeof result[key] === "string") result[key] = diagnosticText(result[key], 256);
    if (error.cause) result.cause = redactSerializedError(error.cause);
    if (error.errors) result.errors = error.errors.map(redactSerializedError);
    return result;
}
export function isClientDiagnostic(value: unknown): value is ErrorDiagnostic {
    if (!record(value) || !exact(value, ["id", "timestamp", "fingerprint", "origin", "severity", "error", "context"])) return false;
    if (!boundedText(value.id, 36) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id)) return false;
    if (!boundedText(value.fingerprint, 64) || !/^[a-f0-9]{64}$/.test(value.fingerprint) || value.origin !== "client" || !["warn", "error"].includes(String(value.severity))) return false;
    if (!boundedText(value.timestamp, 64) || !Number.isFinite(Date.parse(value.timestamp)) || !isDiagnosticError(value.error) || !record(value.context)) return false;
    const c = value.context;
    if (!exact(c, ["pathname", "toolId", "boundary", "failureCategory", "componentStack", "deviceClass", "userAgent", "viewportWidth", "viewportHeight", "devicePixelRatio", "online", "visibilityState"])) return false;
    if (!boundedText(c.pathname, 256) || safePathname(c.pathname) !== c.pathname || !token(c.failureCategory)) return false;
    if (c.toolId !== undefined && !token(c.toolId)) return false;
    if (c.boundary !== undefined && !(typeof c.boundary === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(c.boundary))) return false;
    if (c.componentStack !== undefined && !boundedText(c.componentStack, 16384) || c.userAgent !== undefined && !boundedText(c.userAgent, 1024)) return false;
    if (c.deviceClass !== undefined && !["mobile", "tablet", "desktop", "unknown"].includes(String(c.deviceClass))) return false;
    if (c.visibilityState !== undefined && !["visible", "hidden", "prerender"].includes(String(c.visibilityState))) return false;
    if (c.online !== undefined && typeof c.online !== "boolean") return false;
    return ["viewportWidth", "viewportHeight", "devicePixelRatio"].every(key => c[key] === undefined || typeof c[key] === "number" && Number.isFinite(c[key]) && c[key] >= 0 && c[key] <= 100000);
}
