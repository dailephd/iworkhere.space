import type { AnalyticEventName } from "@/module/analytics/type";
import type { ToolId } from "@/module/tool/type";

export const MAX_TELEMETRY_BYTES = 8192;
export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";
export type FailureCategory = "window-error" | "unhandled-rejection" | "tool-render-error" | "unknown";
interface MetricBase { timestamp: string; pathname: string; deviceClass?: DeviceClass }
export interface ClientErrorMetric extends MetricBase {
    type: "client-error";
    failureCategory: FailureCategory;
    toolId?: ToolId;
}
export type MetricRequest =
    | ClientErrorMetric
    | (MetricBase & { type: "analytic-event"; event: AnalyticEventName; prop: { toolId: string; slug: string } })
    | (MetricBase & { type: "navigation"; navigationType: "initial" | "push" | "replace" | "traverse"; referrerHostname?: string })
    | (MetricBase & { type: "web-vital"; name: string; value: number; delta: number; id: string; rating?: string; navigationType?: string });

export function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
export function exact(value: Record<string, unknown>, keys: string[]): boolean {
    return Object.keys(value).every(key => keys.includes(key));
}
export function token(value: unknown): value is string {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
function member(value: unknown, choices: string[]): boolean {
    return typeof value === "string" && choices.includes(value);
}
export function classifyViewport(width: unknown): DeviceClass {
    if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return "unknown";
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
}
export function safePathname(value: string): string {
    const path = value.split(/[?#]/, 1)[0];
    return /^\/(?:[a-zA-Z0-9/_-]*)$/.test(path) && !path.startsWith("//") && path.length <= 256 ? path : "/";
}
export function referrerHostname(value: string): string | undefined {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.hostname : undefined; }
    catch { return undefined; }
}
export function isMetricRequest(value: unknown): value is MetricRequest {
    if (!record(value) || typeof value.timestamp !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp))) return false;
    if (typeof value.pathname !== "string" || safePathname(value.pathname) !== value.pathname) return false;
    if (value.deviceClass !== undefined && !member(value.deviceClass, ["mobile", "tablet", "desktop", "unknown"])) return false;
    const base = ["type", "timestamp", "pathname", "deviceClass"];
    if (value.type === "client-error") {
        return exact(value, [...base, "failureCategory", "toolId"])
            && member(value.failureCategory, ["window-error", "unhandled-rejection", "tool-render-error", "unknown"])
            && (value.toolId === undefined || token(value.toolId));
    }
    if (value.type === "analytic-event") {
        return exact(value, [...base, "event", "prop"]) && member(value.event, ["tool_opened", "tool_executed", "tool_result_copied", "tool_mode_changed"])
            && record(value.prop) && exact(value.prop, ["toolId", "slug"]) && token(value.prop.toolId) && token(value.prop.slug);
    }
    if (value.type === "navigation") {
        return exact(value, [...base, "navigationType", "referrerHostname"]) && member(value.navigationType, ["initial", "push", "replace", "traverse"])
            && (value.referrerHostname === undefined || typeof value.referrerHostname === "string" && /^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(value.referrerHostname) && value.referrerHostname.length <= 253);
    }
    if (value.type === "web-vital") {
        return exact(value, [...base, "name", "value", "delta", "id", "rating", "navigationType"]) && member(value.name, ["LCP", "INP", "CLS", "FCP", "TTFB", "FID"])
            && typeof value.value === "number" && Number.isFinite(value.value) && value.value >= 0
            && typeof value.delta === "number" && Number.isFinite(value.delta) && token(value.id)
            && (value.rating === undefined || member(value.rating, ["good", "needs-improvement", "poor"]))
            && (value.navigationType === undefined || member(value.navigationType, ["navigate", "reload", "back-forward", "back-forward-cache", "prerender", "restore"]));
    }
    return false;
}
export async function readTelemetryBody(request: Request, maximumBytes = MAX_TELEMETRY_BYTES): Promise<unknown> {
    if (!request.body || Number(request.headers.get("content-length")) > maximumBytes) throw new Error("Invalid telemetry size");
    const reader = request.body.getReader();
    let text = "";
    let size = 0;
    const decoder = new TextDecoder();
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maximumBytes) { await reader.cancel(); throw new Error("Invalid telemetry size"); }
            text += decoder.decode(chunk.value, { stream: true });
        }
        return JSON.parse(text + decoder.decode());
    } finally { reader.releaseLock(); }
}
