import { array, count, invalid, object, timestamp } from "./reportingContract";
import type { CollectorProvider } from "./reportingCollector";
import { operationRecord } from "./reportingMonitoring";
import { healthRequestMessages, PUBLIC_PROJECT } from "./reportingMonitoringSource";
import { invocationCount, type CollectionWindow } from "./reportingMonitoringWindow";

const OWNER = "team_sQEdGnWaessGuITNTUuPtmfx";
const FILTER = "(route:/api/metric OR route:/api/observability/maintenance) AND (environment:production)";
const GROUP = ["requestPath", "requestMethod", "httpStatus"];
const COUNT_COLUMN = "vercel_function_invocation_count_count";
const MAX_BYTES = 8 * 1024 * 1024;

export interface VercelReadRequest {
    kind: "logs" | "counts";
    path: string;
    body?: Record<string, unknown>;
}
export type VercelRead = (request: VercelReadRequest) => Promise<string>;
export interface VercelAuthorizationResult {
    source: "observability-health-source";
    kind: "project" | "logs" | "counts";
    status: number | null;
    outcome: "verified" | "invalid_token" | "missing_token" | "credential_format" | "forbidden" | "unauthorized" | "plan_limit" | "unavailable" | "source_truncated";
}

/** Use only the supplied hosted credential, without CLI login/config discovery.
 * Provider errors are reduced to fixed categories; their text is never logged. */
export function vercelMonitoringRead(token: string, emit: (result: VercelAuthorizationResult) => void,
    send: typeof fetch = fetch): { read: VercelRead; verifyProject: () => Promise<void> } {
    if (!token || token.length > 4096 || /\s/.test(token)) {
        emit({ source: "observability-health-source", kind: "project", status: null, outcome: token ? "credential_format" : "missing_token" });
        return invalid();
    }
    async function request(kind: VercelAuthorizationResult["kind"], url: string, body?: Record<string, unknown>): Promise<string> {
        let status: number | null = null;
        try {
            const response = await send(url, { method: body ? "POST" : "GET", redirect: "error",
                headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
            status = response.status;
            const reader = response.body?.getReader();
            let bytes = 0;
            const chunks: Uint8Array[] = [];
            if (reader) try {
                while (true) {
                    const chunk = await reader.read();
                    if (chunk.done) break;
                    bytes += chunk.value.byteLength;
                    if (bytes > MAX_BYTES) { await reader.cancel(); throw Error("source_truncated"); }
                    chunks.push(chunk.value);
                }
            } finally { reader.releaseLock(); }
            const text = Buffer.concat(chunks).toString("utf8");
            if (!response.ok) {
                let error: Record<string, unknown> = {};
                try { error = sourceObject(sourceObject(JSON.parse(text)).error); } catch { /* Untrusted provider text is discarded. */ }
                const outcome = error.invalidToken === true ? "invalid_token" : error.missingToken === true ? "missing_token"
                    : status === 403 ? "forbidden" : status === 401 ? "unauthorized" : status === 402 ? "plan_limit" : "unavailable";
                emit({ source: "observability-health-source", kind, status, outcome });
                throw Error("classified_source_failure");
            }
            return text;
        } catch (error) {
            if (!(error instanceof Error && error.message === "classified_source_failure")) {
                emit({ source: "observability-health-source", kind, status,
                    outcome: error instanceof Error && error.message === "source_truncated" ? "source_truncated" : "unavailable" });
            }
            throw Error(error instanceof Error && error.message === "source_truncated" ? "source_truncated" : "source_unavailable");
        }
    }
    return {
        async verifyProject() {
            const text = await request("project", `https://api.vercel.com/v9/projects/${PUBLIC_PROJECT}?teamId=${OWNER}`);
            const project = sourceObject(JSON.parse(text));
            if (project.id !== PUBLIC_PROJECT || project.accountId !== OWNER) return invalid();
            emit({ source: "observability-health-source", kind: "project", status: 200, outcome: "verified" });
        },
        async read(value) {
            const url = new URL(value.path, value.kind === "logs" ? "https://vercel.com" : "https://api.vercel.com");
            if (value.kind === "logs") {
                if (url.origin !== "https://vercel.com" || url.pathname !== "/api/logs/request-logs"
                    || url.searchParams.get("projectId") !== PUBLIC_PROJECT || url.searchParams.get("ownerId") !== OWNER || value.body) return invalid();
            } else if (value.kind !== "counts" || url.href !== `https://api.vercel.com/metrics/v1?teamId=${OWNER}` || !value.body) return invalid();
            return request(value.kind, url.href, value.body);
        },
    };
}
function sourceObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    return value as Record<string, unknown>;
}
function parse(text: string): Record<string, unknown> {
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("source_truncated");
    return sourceObject(JSON.parse(text));
}
function validateWindow(window: CollectionWindow): void {
    const start = Date.parse(timestamp(window.start)), end = Date.parse(timestamp(window.end));
    if (end - start !== 300000 || start % 300000 !== 0) return invalid();
}
function platformTimestamp(value: unknown): string {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return timestamp(new Date(value).toISOString());
    if (typeof value !== "string") return invalid();
    return timestamp(value.length === 20 ? value.replace(/Z$/, ".000Z") : value);
}
function projectLog(value: unknown): string | null {
    const row = sourceObject(value);
    if (row.projectId !== undefined && row.projectId !== PUBLIC_PROJECT) return invalid();
    // The authenticated API request is pinned to production. Do not accept an
    // explicitly contradictory environment; the CLI uses this same default.
    if (row.environment !== undefined && row.environment !== "production") return invalid();
    if (!["/api/metric", "/api/observability/maintenance"].includes(String(row.requestPath))) return null;
    if (typeof row.requestId !== "string" || !row.requestId.length || row.requestId.length > 256
        || typeof row.requestMethod !== "string" || !/^(GET|POST|HEAD|OPTIONS|PUT|PATCH|DELETE)$/.test(row.requestMethod)
        || typeof row.statusCode !== "number" || !Number.isSafeInteger(row.statusCode) || row.statusCode < 100 || row.statusCode > 599) return invalid();
    const logs = row.logs === undefined ? [] : array(row.logs, 256);
    if (logs.some(log => sourceObject(log).messageTruncated === true)) throw new Error("source_truncated");
    const envelope = { projectId: PUBLIC_PROJECT, environment: "production", requestPath: row.requestPath, logs };
    const approved = healthRequestMessages(envelope).map(operationRecord);
    // Serialize only the existing strict operational schema, never arbitrary
    // provider envelopes, diagnostic messages, headers or nested metadata.
    return JSON.stringify({ id: row.requestId, projectId: PUBLIC_PROJECT, environment: "production",
        requestPath: row.requestPath, requestMethod: row.requestMethod, responseStatusCode: row.statusCode,
        timestamp: Date.parse(platformTimestamp(row.timestamp)), logs: approved.map(record => ({ message: JSON.stringify(record) })) });
}
function counterPoint(value: unknown, series: boolean): Record<string, unknown> {
    const point = sourceObject(value);
    const dimensions = object(point.dimensions, GROUP), values = object(point.values, ["value"]);
    const projected = { requestPath: dimensions.requestPath, requestMethod: dimensions.requestMethod,
        httpStatus: dimensions.httpStatus, [COUNT_COLUMN]: count(values.value) };
    return series ? { timestamp: platformTimestamp(point.timestamp), ...projected } : projected;
}

export function vercelMonitoringProvider(read: VercelRead): CollectorProvider {
    return {
        async logs(window) {
            validateWindow(window);
            const output: string[] = [];
            let bytes = 0, requests = 0;
            for (let page = 0; page < 10; page++) {
                const query = new URLSearchParams({ projectId: PUBLIC_PROJECT, ownerId: OWNER, page: String(page),
                    startDate: String(Date.parse(window.start)), endDate: String(Date.parse(window.end)), environment: "production" });
                const text = await read({ kind: "logs", path: `/api/logs/request-logs?${query}` });
                bytes += Buffer.byteLength(text, "utf8");
                if (bytes > MAX_BYTES) throw new Error("source_truncated");
                const response = parse(text), rows = array(response.rows, 1000);
                if (typeof response.hasMoreRows !== "boolean") return invalid();
                requests += rows.length;
                if (requests >= 1000) throw new Error("source_truncated");
                for (const row of rows) { const value = projectLog(row); if (value !== null) output.push(value); }
                if (!response.hasMoreRows) return output.join("\n");
                if (!rows.length) throw new Error("source_unavailable");
            }
            throw new Error("source_truncated");
        },
        async counts(window) {
            validateWindow(window);
            const response = parse(await read({ kind: "counts", path: `/metrics/v1?teamId=${OWNER}`, body: {
                scope: { ownerId: OWNER, projectIds: [PUBLIC_PROJECT] },
                timeRange: { start: window.start, end: window.end }, bucketSeconds: 300,
                groupBy: GROUP, filter: FILTER,
                metrics: { value: { metric: "vercel.function_invocation.count", aggregation: "count" } }, outputs: ["value"],
                seriesSelection: { limit: 100, mode: "exact", rankBy: [{ metric: "value", direction: "desc" }] },
            } }));
            const summary = array(response.summary, 100), series = response.series === undefined ? [] : array(response.series, 100);
            if (summary.length >= 100 || series.length >= 100) throw new Error("source_truncated");
            const result = { query: { metric: "vercel.function_invocation.count", aggregation: "count", startTime: window.start,
                endTime: window.end, filter: FILTER, groupBy: GROUP, granularity: { minutes: 5 } },
                summary: summary.map(point => counterPoint(point, false)), data: series.map(point => counterPoint(point, true)) };
            invocationCount(result, window); // Reuse the authoritative grouped-counter validator.
            return result;
        },
    };
}
