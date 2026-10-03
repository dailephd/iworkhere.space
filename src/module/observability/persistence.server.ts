import "server-only";
import { neon } from "@neondatabase/serverless";
import type { MetricRequest } from "./metric";

export interface EventRecord {
    kind: MetricRequest["type"];
    pathname: string;
    toolId: string | null;
    eventName: string | null;
    metricName: string | null;
    metricValue: number | null;
    metricRating: string | null;
    failureCategory: string | null;
    deviceClass: string;
    referrerHost: string | null;
    navigationType: string | null;
}

export function persistenceEnabled(): boolean {
    return process.env.OBSERVABILITY_PERSISTENCE_ENABLED === "true";
}

function database() {
    const url = process.env.OBSERVABILITY_DATABASE_URL;
    if (!url) throw new Error("Observability database configuration missing");
    return neon(url, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
}

/** Explicit durable projection; diagnostic data and client times never enter SQL. */
export function eventRecord(metric: MetricRequest): EventRecord {
    return {
        kind: metric.type,
        pathname: metric.pathname,
        toolId: metric.type === "analytic-event" ? metric.prop.toolId : metric.type === "client-error" ? metric.toolId ?? null : null,
        eventName: metric.type === "analytic-event" ? metric.event : null,
        metricName: metric.type === "web-vital" ? metric.name : null,
        metricValue: metric.type === "web-vital" ? metric.value : null,
        metricRating: metric.type === "web-vital" ? metric.rating ?? null : null,
        failureCategory: metric.type === "client-error" ? metric.failureCategory : null,
        deviceClass: metric.deviceClass ?? "unknown",
        referrerHost: metric.type === "navigation" ? metric.referrerHostname ?? null : null,
        navigationType: metric.type === "navigation" ? metric.navigationType : metric.type === "web-vital" ? metric.navigationType ?? null : null,
    };
}

export async function persistMetric(metric: MetricRequest): Promise<void> {
    const sql = database();
    const e = eventRecord(metric);
    await sql`INSERT INTO observability.event
        (kind, pathname, tool_id, event_name, metric_name, metric_value, metric_rating, failure_category, device_class, referrer_host, navigation_type)
        VALUES (${e.kind}, ${e.pathname}, ${e.toolId}, ${e.eventName}, ${e.metricName}, ${e.metricValue}, ${e.metricRating}, ${e.failureCategory}, ${e.deviceClass}, ${e.referrerHost}, ${e.navigationType})`;
}

export async function maintainObservability(): Promise<void> {
    if (!persistenceEnabled()) throw new Error("Observability persistence is disabled");
    await database().query("SELECT rolled_day_count, deleted_event_count FROM observability.maintain()", []);
}

/** Header checks discourage cross-site browser traffic; they are not authentication. */
export function sameOriginMetricRequest(request: Request): boolean {
    if (!persistenceEnabled() || process.env.NODE_ENV !== "production") return true;
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return false;
    return true;
}

export function reportPersistenceFailure(operation: "insert" | "maintenance"): void {
    // Fixed operational message only: no thrown diagnostics, request fields or secrets.
    console.error(JSON.stringify({ source: "observability-operation", operation, status: "unavailable" }));
}
