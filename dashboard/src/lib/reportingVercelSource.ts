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
export interface VercelReadCommand { args: string[]; input?: string }
export type VercelRead = (request: VercelReadRequest) => Promise<string>;

/** The high-level CLI commands discover user/team context before querying a
 * project. The fixed APIs below are the same APIs used by CLI62.2.0, without
 * those broader discovery calls. Bearer credentials remain in the environment. */
export function vercelReadCommand(request: VercelReadRequest): VercelReadCommand {
    return {
        args: ["api", request.path, "--non-interactive", ...(request.kind === "logs"
            ? ["--api", "https://vercel.com"] : ["--method", "POST", "--input", "-"])],
        ...(request.body ? { input: JSON.stringify(request.body) } : {}),
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
