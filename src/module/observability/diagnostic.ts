import { diagnosticText } from "./diagnosticText";
import { classifyViewport, safePathname, token } from "./metric";

export const MAX_DIAGNOSTIC_BYTES = 65536;
export interface DiagnosticError {
    name: string;
    message: string;
    stack?: string;
    valueType?: string;
    code?: string | number;
    digest?: string | number;
    status?: string | number;
    statusCode?: string | number;
    errno?: string | number;
    syscall?: string | number;
    type?: string | number;
    cause?: DiagnosticError;
    errors?: DiagnosticError[];
    truncated?: boolean;
}
export interface DiagnosticContext {
    pathname: string;
    toolId?: string;
    boundary?: string;
    failureCategory: string;
    componentStack?: string;
    deviceClass?: string;
    userAgent?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    devicePixelRatio?: number;
    online?: boolean;
    visibilityState?: string;
    method?: string;
    routerKind?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
    revalidateReason?: string;
    runtime?: string;
    requestId?: string;
}
export interface DeploymentContext {
    commitSha?: string;
    environment?: string;
    region?: string;
    hostname?: string;
    deploymentId?: string;
}
export interface ErrorDiagnostic {
    id: string;
    timestamp: string;
    fingerprint: string;
    origin: "client" | "server";
    severity: "warn" | "error";
    error: DiagnosticError;
    context: DiagnosticContext;
    deployment?: DeploymentContext;
}
interface ErrorBudget { remaining: number; seen: WeakSet<object> }

function field(value: object, key: string): unknown {
    try { return Reflect.get(value, key); } catch { return undefined; }
}
function takeText(text: string, maximum: number, budget: ErrorBudget): string {
    if (budget.remaining < 32) return "[TRUNCATED]";
    const result = diagnosticText(text, Math.min(maximum, budget.remaining));
    budget.remaining -= new TextEncoder().encode(result).length;
    return result;
}
function serialize(value: unknown, depth: number, budget: ErrorBudget): DiagnosticError {
    if (depth > 5 || budget.remaining < 32) return { name: "Truncated", message: "[TRUNCATED]", truncated: true };
    const object = typeof value === "object" && value !== null;
    if (object && budget.seen.has(value)) return { name: "CircularCause", message: "[CIRCULAR]", truncated: true };
    if (object) budget.seen.add(value);
    const isError = value instanceof Error || typeof DOMException !== "undefined" && value instanceof DOMException;
    if (!isError) {
        const valueType = value === null ? "null" : typeof value;
        const primitive = ["string", "number", "boolean", "undefined", "bigint", "symbol"].includes(typeof value);
        return { name: "NonErrorRejection", valueType, message: takeText(primitive ? String(value) : `[${valueType} rejection; contents excluded]`, 4096, budget) };
    }
    const name = field(value, "name");
    const message = field(value, "message");
    const error: DiagnosticError = { name: takeText(typeof name === "string" ? name : "Error", 256, budget), message: takeText(typeof message === "string" ? message : "", 4096, budget) };
    const stack = field(value, "stack");
    if (typeof stack === "string") error.stack = takeText(stack, depth === 0 ? 24576 : 2048, budget);
    for (const key of ["code", "digest", "status", "statusCode", "errno", "syscall", "type"] as const) {
        const item = field(value, key);
        if (typeof item === "string") error[key] = takeText(item, 256, budget);
        if (typeof item === "number" && Number.isFinite(item)) error[key] = item;
    }
    const cause = field(value, "cause");
    if (cause !== undefined) error.cause = serialize(cause, depth + 1, budget);
    if (value instanceof AggregateError) {
        const errors = field(value, "errors");
        if (Array.isArray(errors)) {
            error.errors = errors.slice(0, 10).map(child => serialize(child, depth + 1, budget));
            if (errors.length > 10) error.truncated = true;
        }
    }
    return error;
}
export function serializeDiagnosticError(error: unknown): DiagnosticError {
    return serialize(error, 0, { remaining: 40960, seen: new WeakSet() });
}

export function diagnosticContext(meta?: Record<string, unknown>): DiagnosticContext {
    const context: DiagnosticContext = { pathname: typeof meta?.pathname === "string" ? safePathname(meta.pathname) : "/", failureCategory: token(meta?.failureCategory) ? meta.failureCategory : "unknown" };
    if (token(meta?.toolId)) context.toolId = meta.toolId;
    if (typeof meta?.boundary === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(meta.boundary)) context.boundary = meta.boundary;
    if (typeof meta?.componentStack === "string") context.componentStack = diagnosticText(meta.componentStack, 16384);
    return context;
}
export function clientDiagnosticContext(meta?: Record<string, unknown>): DiagnosticContext {
    const context = diagnosticContext(meta);
    if (typeof window === "undefined") return context;
    context.pathname = safePathname(window.location.pathname);
    context.deviceClass = classifyViewport(window.innerWidth);
    if (typeof navigator !== "undefined") {
        if (typeof navigator.userAgent === "string") context.userAgent = diagnosticText(navigator.userAgent, 1024);
        if (typeof navigator.onLine === "boolean") context.online = navigator.onLine;
    }
    for (const [key, value] of [["viewportWidth", window.innerWidth], ["viewportHeight", window.innerHeight], ["devicePixelRatio", window.devicePixelRatio]] as const) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) context[key] = Math.min(value, 100000);
    }
    if (typeof document !== "undefined" && ["visible", "hidden", "prerender"].includes(document.visibilityState)) context.visibilityState = document.visibilityState;
    return context;
}
export async function diagnosticFingerprint(error: DiagnosticError): Promise<string> {
    const frames = error.stack?.split("\n").slice(1, 4).map(frame => frame.trim().replace(/:\d+:\d+/g, ":#:#").replace(/https?:\/\/[^/\s]+/g, "")).join("\n") ?? "";
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${error.name}\n${error.message}\n${frames}`));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function createErrorDiagnostic(error: DiagnosticError, context: DiagnosticContext, origin: ErrorDiagnostic["origin"], severity: ErrorDiagnostic["severity"] = "error"): Promise<ErrorDiagnostic> {
    // Clone only the already serialized contract; never stringify an Error object.
    const result: ErrorDiagnostic = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), fingerprint: await diagnosticFingerprint(error), origin, severity, error: structuredClone(error), context: { ...context } };
    while (new TextEncoder().encode(JSON.stringify(result)).length > MAX_DIAGNOSTIC_BYTES - 2048) {
        if ((result.context.componentStack?.length ?? 0) > 512) result.context.componentStack = diagnosticText(result.context.componentStack!, Math.floor(new TextEncoder().encode(result.context.componentStack!).length / 2));
        else if ((result.error.stack?.length ?? 0) > 512) result.error.stack = diagnosticText(result.error.stack!, Math.floor(new TextEncoder().encode(result.error.stack!).length / 2));
        else { delete result.error.cause; delete result.error.errors; result.error.truncated = true; break; }
    }
    return result;
}
