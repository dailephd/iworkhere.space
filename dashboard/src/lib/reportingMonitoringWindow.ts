import { createHash } from "node:crypto";
import { array, invalid, object, timestamp } from "./reportingContract";
import { collectReportingMonitoring, operationRecord, type OperationRecord } from "./reportingMonitoring";
import { healthRequestRows, healthRequestMessages } from "./reportingMonitoringSource";

export interface DurableOperation extends OperationRecord { httpStatus: number }
export interface CollectionWindow { start: string; end: string }
export interface WindowResult {
    outcome: "complete" | "partial";
    reason: "none" | "source_truncated" | "source_unreconciled" | "source_unavailable" | "invalid_record";
    requestCount: number;
    independentRequestCount: number | null;
    independentFailureCount: number;
    independentMaintenanceFailureCount: number;
    fingerprint: string;
    records: DurableOperation[];
}
export function collectionWindow(now: Date): CollectionWindow[] {
    const end = Math.floor(now.getTime() / 300000) * 300000 - 300000;
    return [2, 1, 0].map(i => ({ start: new Date(end - (i + 1) * 300000).toISOString(), end: new Date(end - i * 300000).toISOString() }));
}
/** Independent counter response, not application logs. Reject unknown shapes;
 * no permissive fallback to zero when the provider is unavailable. */
export function invocationCount(value: unknown, window: CollectionWindow): Map<string, number> {
    const row = object(value, Object.hasOwn(value as object, "orderBy") ? ["query", "summary", "data", "orderBy", "orderDirection"] : ["query", "summary", "data"]);
    if (!row.query || typeof row.query !== "object") return invalid();
    const query = row.query as Record<string, unknown>;
    if (query.metric !== "vercel.function_invocation.count" || query.aggregation !== "count"
        || query.startTime !== window.start || query.endTime !== window.end || typeof query.filter !== "string"
        || query.filter.replace(/["\s]/g, "") !== "(route:/api/metricORroute:/api/observability/maintenance)AND(environment:production)"
        || JSON.stringify(query.groupBy)!==JSON.stringify(["requestPath","requestMethod","httpStatus"])
        || JSON.stringify(query.granularity)!==JSON.stringify({minutes:5})) return invalid();
    const result = new Map<string, number>();
    const data = array(row.summary, 100);
    if (data.length >= 100) throw new Error("source_truncated");
    array(row.data, 100);
    // Verified CLI 62.2.0 grouped counter schema. No identity dimensions.
    for (const value of data) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
        const point = value as Record<string, unknown>;
        object(point, ["requestPath", "requestMethod", "httpStatus", "vercel_function_invocation_count_count"]);
        const path = point.requestPath, method = point.requestMethod, status = Number(point.httpStatus), amount = point.vercel_function_invocation_count_count;
        if (!["/api/metric", "/api/observability/maintenance"].includes(String(path)) || typeof method !== "string"
            || !/^(GET|POST|HEAD|OPTIONS|PUT|PATCH|DELETE)$/.test(method) || !Number.isSafeInteger(status) || status < 100 || status > 599
            || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) return invalid();
        const key = `${path}|${method}|${status}`; result.set(key, (result.get(key) ?? 0) + amount);
    }
    return result;
}
export function reconcileWindow(window: CollectionWindow, observedAt: string, logs: string, counts: Map<string, number>): WindowResult {
    const start = Date.parse(timestamp(window.start)), end = Date.parse(timestamp(window.end));
    const observed = Date.parse(timestamp(observedAt));
    if (end - start !== 300000 || end > observed - 60000 || start < observed - 3600000) return invalid();
    const rows = healthRequestRows(logs), actual = new Map<string, number>(), records = new Map<string, DurableOperation>();
    let complete = rows.length < 1000;
    const requests = new Map<string,string>();
    for (const row of rows) {
        if (row.projectId !== "prj_OZIQho0P485NwArPlWTQuYfSQtNI" || row.environment !== "production") return invalid();
        if (!["/api/metric", "/api/observability/maintenance"].includes(String(row.requestPath))) continue;
        const at = typeof row.timestamp === "number" ? row.timestamp : Date.parse(timestamp(row.timestamp));
        if (!Number.isFinite(at)) return invalid();
        if (at < start || at >= end) continue;
        const status = Number(row.responseStatusCode), key = `${row.requestPath}|${row.requestMethod}|${status}`;
        if (typeof row.id !== "string" || row.id.length > 256 || !Number.isSafeInteger(status) || status < 100 || status > 599) { complete = false; continue; }
        const list = healthRequestMessages(row).map(operationRecord);
        const signature=JSON.stringify([row.requestPath,row.requestMethod,status,at,list]);
        if (requests.has(row.id)) { if(requests.get(row.id)!==signature) return invalid(); continue; }
        requests.set(row.id,signature);
        actual.set(key, (actual.get(key) ?? 0) + 1);
        const expectedMethod = row.requestPath === "/api/metric" ? "POST" : "GET";
        const operationStatus = [204, 503, 500, 502, 504].includes(status);
        // A rejected ingestion request is still observed traffic. Without an
        // operation outcome it must not establish a verified idle interval.
        if (row.requestMethod === expectedMethod && (row.requestPath === "/api/metric"
            ? !operationStatus : status < 400 && status !== 204 || status >= 500 && !operationStatus)) complete = false;
        if (!operationStatus) continue;
        const identity = new Set(list.map(r => r.attemptId));
        if (identity.size !== 1 || !list.some(r => r.status === "attempt")) { complete = false; continue; }
        const operation = row.requestPath === "/api/metric" ? "ingestion" : "maintenance";
        if ((status === 204 && !list.some(r => r.status === "success")) || (status === 503 && !list.some(r => r.status === "failure"))) complete = false;
        for (const record of list) {
            if (record.status === "success" && status !== 204 || record.status === "failure" && status !== 503) return invalid();
            if (record.operation !== operation || Date.parse(record.startedAt) < start || Date.parse(record.startedAt) >= end || Date.parse(record.timestamp) >= observed) return invalid();
            const projected = { source: record.source, schemaVersion: record.schemaVersion, operation: record.operation, status: record.status,
                attemptId: record.attemptId, startedAt: record.startedAt, timestamp: record.timestamp, httpStatus: status };
            const id = record.attemptId + record.status;
            if (records.has(id) && JSON.stringify(records.get(id)) !== JSON.stringify(projected)) return invalid();
            records.set(id, projected);
        }
    }
    const allKeys = new Set([...actual.keys(), ...counts.keys()]);
    if ([...allKeys].some(k => (actual.get(k) ?? 0) !== (counts.get(k) ?? 0))) complete = false;
    const ordered = [...records.values()].sort((a,b) => (a.attemptId+a.status).localeCompare(b.attemptId+b.status));
    // Reuse existing chronology/contradiction validation, without claiming full
    // daily coverage from this five-minute source window.
    collectReportingMonitoring(observedAt, { from: window.start, until: observedAt, instrumentedFrom: window.start, complete: false }, ordered.map(({ httpStatus: _status, ...record }) => { void _status; return record; }));
    const independentRequestCount=[...counts.values()].reduce((a,b)=>a+b,0);
    if(!Number.isSafeInteger(independentRequestCount) || independentRequestCount>1000000) throw new Error("source_truncated");
    const fingerprint = createHash("sha256").update(JSON.stringify([ordered, [...actual].sort(),[...counts].sort()])).digest("hex");
    return { outcome: complete ? "complete" : "partial", reason: complete ? "none" : rows.length >= 1000 ? "source_truncated" : "source_unreconciled", requestCount: requests.size,
        independentRequestCount,independentFailureCount:counts.get("/api/metric|POST|503")??0,independentMaintenanceFailureCount:counts.get("/api/observability/maintenance|GET|503")??0,fingerprint, records: ordered };
}
