import { classifyViewport, isMetricRequest, MAX_TELEMETRY_BYTES, safePathname, type MetricRequest } from "./metric";

export function observabilityEnabled(): boolean {
    return typeof window !== "undefined" && process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED === "true";
}
export function currentMetricContext(): { timestamp: string; pathname: string } {
    return { timestamp: new Date().toISOString(), pathname: typeof window === "undefined" ? "/" : safePathname(window.location.pathname) };
}
export function sendMetric(metric: MetricRequest, beacon = false): void {
    try {
        if (!observabilityEnabled() || !isMetricRequest(metric)) return;
        const body = JSON.stringify({ ...metric, deviceClass: metric.deviceClass ?? classifyViewport(window.innerWidth) });
        if (new TextEncoder().encode(body).length > MAX_TELEMETRY_BYTES) return;
        if (beacon && typeof navigator.sendBeacon === "function") {
            try { if (navigator.sendBeacon("/api/metric", new Blob([body], { type: "application/json" }))) return; } catch { /* Fetch fallback. */ }
        }
        void fetch("/api/metric", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" }).catch(() => {});
    } catch { /* Telemetry must never affect application behavior. */ }
}
