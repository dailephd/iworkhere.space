import { array, invalid, member, object, timestamp } from "./reportingContract";
import type { MonitoringEvidence } from "./reportingHealth";

export interface MonitoringCoverage {
    from: string;
    until: string;
    instrumentedFrom: string;
    complete: boolean;
}
export interface OperationRecord {
    source: "observability-health";
    schemaVersion: 1;
    operation: "ingestion" | "maintenance";
    status: "attempt" | "success" | "failure";
    attemptId: string;
    startedAt: string;
    timestamp: string;
}
interface OperationAttempt {
    operation: OperationRecord["operation"];
    startedAt: string;
    attempt: boolean;
    outcome: OperationRecord | null;
}
export function operationRecord(value: unknown): OperationRecord {
    const row = object(value, ["source", "schemaVersion", "operation", "status", "attemptId", "startedAt", "timestamp"]);
    if (row.source !== "observability-health" || row.schemaVersion !== 1) return invalid();
    member(row.operation, ["ingestion", "maintenance"]); member(row.status, ["attempt", "success", "failure"]);
    if (typeof row.attemptId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(row.attemptId)) return invalid();
    timestamp(row.startedAt); timestamp(row.timestamp);
    if (String(row.startedAt) > String(row.timestamp)) return invalid();
    if (row.status === "attempt" && row.startedAt !== row.timestamp) return invalid();
    return value as OperationRecord;
}
/** Trusted operator/provider adapter input only, never caller-supplied MCP data.
 * `complete` requires independently verified unsampled, untruncated coverage;
 * observing a latest log or zero errors cannot establish it. IDs stay local. */
export function collectReportingMonitoring(observedAt: string, coverageValue: MonitoringCoverage | null, value: unknown): MonitoringEvidence {
    const end = Date.parse(timestamp(observedAt)), start = end - 86_400_000;
    const records = array(value, 20000).map(operationRecord);
    if (!coverageValue && records.length !== 0) return invalid();
    let complete = false;
    if (coverageValue) {
        const coverage = object(coverageValue, ["from", "until", "instrumentedFrom", "complete"]);
        const from = Date.parse(timestamp(coverage.from)), until = Date.parse(timestamp(coverage.until));
        const instrumentedFrom = Date.parse(timestamp(coverage.instrumentedFrom));
        if (until !== end || from > until || instrumentedFrom > end || typeof coverage.complete !== "boolean") return invalid();
        complete = coverage.complete && from <= start && instrumentedFrom <= start;
    }
    const attempts = new Map<string, OperationAttempt>();
    for (const record of records) {
        const started = Date.parse(record.startedAt), at = Date.parse(record.timestamp);
        if (at >= end) return invalid();
        if (started < start) continue; // A terminal record for an earlier attempt is not a new attempt.
        const entry = attempts.get(record.attemptId) ?? { operation: record.operation, startedAt: record.startedAt, attempt: false, outcome: null };
        if (entry.operation !== record.operation || entry.startedAt !== record.startedAt) return invalid();
        if (record.status === "attempt") entry.attempt = true;
        else {
            if (entry.outcome && (entry.outcome.status !== record.status || entry.outcome.timestamp !== record.timestamp)) return invalid();
            entry.outcome = record;
        }
        attempts.set(record.attemptId, entry);
    }
    let attempted = 0, accepted = 0, failed = 0, unresolved = 0;
    let cron: MonitoringEvidence["cron"] = "unknown";
    const due = new Date(observedAt); due.setUTCHours(2, 15, 0, 0);
    if (end < due.getTime() + 3_600_000) due.setUTCDate(due.getUTCDate() - 1);
    let latestMaintenance: OperationAttempt | null = null;
    function deadlineObserved(entry: OperationAttempt): boolean {
        // A partial/truncated query cannot prove a terminal record is absent.
        // A trusted adapter must account for eligible provider requests as well
        // as lifecycle messages before asserting query completeness.
        return coverageValue?.complete === true && entry.attempt
            && Date.parse(coverageValue.from) <= Date.parse(entry.startedAt)
            && Date.parse(coverageValue.instrumentedFrom) <= Date.parse(entry.startedAt);
    }
    for (const entry of attempts.values()) {
        // Terminal records independently prove an operation occurred, but a lost
        // start record prevents a claim of complete lifecycle-log coverage.
        if (!entry.attempt) complete = false;
        if (entry.operation === "maintenance") {
            if (Date.parse(entry.startedAt) >= due.getTime() && (!latestMaintenance || entry.startedAt > latestMaintenance.startedAt)) latestMaintenance = entry;
            continue;
        }
        attempted++;
        if (entry.outcome?.status === "success") accepted++;
        else if (entry.outcome?.status === "failure") failed++;
        // Driver deadline is 10s; allow another 5s for terminal-log delivery.
        else if (deadlineObserved(entry) && end - Date.parse(entry.startedAt) >= 15000) unresolved++;
    }
    if (latestMaintenance?.outcome) cron = latestMaintenance.outcome.status === "success" ? "succeeded" : "failed";
    else if (latestMaintenance && deadlineObserved(latestMaintenance) && end - Date.parse(latestMaintenance.startedAt) >= 75000) cron = "failed";
    else if (complete && !latestMaintenance && due.getTime() >= start) cron = "delayed";
    const available = coverageValue ? complete ? "complete" : "partial" : "unavailable";
    return { observedAt, coverage: available, runtimeLogs: available, attempted, accepted, failed, unresolved, cron };
}
