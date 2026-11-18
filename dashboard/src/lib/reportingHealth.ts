import { array, count, invalid, member, nullableTimestamp, object, timestamp } from "./reportingContract";

export const HEALTH_STATE = ["HEALTHY_WITH_EVIDENCE", "NO_RECENT_TRAFFIC", "INGESTION_STALLED", "ROLLUP_STALLED", "INGESTION_AND_ROLLUP_UNHEALTHY", "INSUFFICIENT_EVIDENCE"] as const;
export const HEALTH_REASON = ["database_unavailable", "monitoring_missing", "runtime_logs_inaccessible", "ingestion_failures", "rollup_gaps", "rollup_mismatch", "cron_failed", "cron_delayed", "current_day_incomplete", "raw_retention_limits_history", "no_recorded_activity", "no_observed_attempts", "positive_ingestion_and_rollup_evidence", "schedule_grace", "ingestion_count_unreconciled", "collection_intervals_missing", "collector_failures_observed", "evidence_delivery_delayed", "operational_retention_limits_coverage"] as const;
export interface DatabaseEvidence {
    observedAt: string;
    retainedFrom: string;
    recentEventCount: number;
    missingCompletedDays: number;
    mismatchedCompletedDays: number;
    pendingGraceDays: number;
    lastRawReceived: string | null;
    lastRollupDay: string | null;
}
/** Trusted monitoring summary for the preceding rolling 24h, as of observedAt.
 * Unresolved means valid attempts whose write deadline has passed, not in-flight work.
 * Later adapters must establish these counts independently from DB maxima. */
export interface MonitoringDetail {
    windowStart: string; windowEnd: string; retainedFrom: string; lastCollectedAt: string | null;
    missingIntervalCount: number; failedCollectionCount: number; maximumDeliverySeconds: number;
}
export interface MonitoringEvidence {
    detail?: MonitoringDetail;
    observedAt: string;
    coverage: "complete" | "partial" | "unavailable";
    runtimeLogs: "complete" | "partial" | "unavailable";
    attempted: number;
    accepted: number;
    failed: number;
    unresolved: number;
    cron: "succeeded" | "failed" | "delayed" | "unknown";
}
export interface ReportingHealth {
    monitoring?: MonitoringDetail;
    state: typeof HEALTH_STATE[number];
    observedAt: string;
    evidence: DatabaseEvidence | null;
    monitoringCoverage: MonitoringEvidence["coverage"];
    runtimeLogCoverage: MonitoringEvidence["runtimeLogs"];
    reason: typeof HEALTH_REASON[number][];
}
export function validateDatabaseEvidence(value: unknown): DatabaseEvidence {
    const row = object(value, ["observedAt", "retainedFrom", "recentEventCount", "missingCompletedDays", "mismatchedCompletedDays", "pendingGraceDays", "lastRawReceived", "lastRollupDay"]);
    timestamp(row.observedAt); timestamp(row.retainedFrom);
    if (String(row.retainedFrom) > String(row.observedAt)) return invalid();
    for (const name of ["recentEventCount", "missingCompletedDays", "mismatchedCompletedDays", "pendingGraceDays"]) count(row[name]);
    nullableTimestamp(row.lastRawReceived);
    if (row.lastRawReceived !== null && String(row.lastRawReceived) >= String(row.observedAt)) return invalid();
    if (Number(row.recentEventCount) > 0 && (row.lastRawReceived === null || Date.parse(String(row.lastRawReceived)) < Date.parse(String(row.observedAt)) - 86_400_000)) return invalid();
    if (row.lastRollupDay !== null) {
        if (typeof row.lastRollupDay !== "string" || row.lastRollupDay.length !== 10) return invalid();
        timestamp(row.lastRollupDay + "T00:00:00.000Z");
        if (row.lastRollupDay >= String(row.observedAt).slice(0, 10)) return invalid();
    }
    return value as DatabaseEvidence;
}
export function validateMonitoringDetail(value: unknown, observedAt: string): MonitoringDetail {
    const row=object(value,["windowStart","windowEnd","retainedFrom","lastCollectedAt","missingIntervalCount","failedCollectionCount","maximumDeliverySeconds"]);
    if(timestamp(row.windowEnd)!==observedAt || timestamp(row.windowStart)!==new Date(Date.parse(observedAt)-86400000).toISOString()) return invalid();
    timestamp(row.retainedFrom); nullableTimestamp(row.lastCollectedAt);
    for(const name of ["missingIntervalCount","failedCollectionCount","maximumDeliverySeconds"]) count(row[name]);
    return value as MonitoringDetail;
}
export function validateMonitoringEvidence(monitoring: MonitoringEvidence, observedAt: string): MonitoringEvidence {
    object(monitoring, ["observedAt", "coverage", "runtimeLogs", "attempted", "accepted", "failed", "unresolved", "cron", ...(monitoring.detail === undefined ? [] : ["detail"])]);
    if (timestamp(monitoring.observedAt) !== observedAt) return invalid();
    member(monitoring.coverage, ["complete", "partial", "unavailable"]); member(monitoring.runtimeLogs, ["complete", "partial", "unavailable"]);
    member(monitoring.cron, ["succeeded", "failed", "delayed", "unknown"]);
    for (const amount of [monitoring.attempted, monitoring.accepted, monitoring.failed, monitoring.unresolved]) count(amount);
    if (count(monitoring.accepted + monitoring.failed + monitoring.unresolved) > monitoring.attempted) return invalid();

    if(monitoring.detail) { const detail=validateMonitoringDetail(monitoring.detail,observedAt);
        if(monitoring.coverage==="complete" && (detail.missingIntervalCount>0 || detail.retainedFrom>detail.windowStart)) return invalid(); }
    return monitoring;
}
export function assessReportingHealth(observedAt: string, evidence: DatabaseEvidence | null, monitoring: MonitoringEvidence | null = null): ReportingHealth {
    timestamp(observedAt);
    if (evidence) { validateDatabaseEvidence(evidence); if (evidence.observedAt !== observedAt) return invalid(); }
    if (monitoring) validateMonitoringEvidence(monitoring, observedAt);
    const reason: ReportingHealth["reason"] = ["current_day_incomplete", "raw_retention_limits_history"];
    if (!evidence) reason.push("database_unavailable");
    if (!monitoring || monitoring.coverage !== "complete") reason.push("monitoring_missing");
    if (!monitoring || monitoring.runtimeLogs !== "complete") reason.push("runtime_logs_inaccessible");
    if (evidence?.recentEventCount === 0) reason.push("no_recorded_activity");
    if (evidence?.pendingGraceDays) reason.push("schedule_grace");
    const ingestionBad = !!monitoring && (monitoring.failed > 0 || monitoring.unresolved > 0);
    const rollupBad = !!evidence && (evidence.missingCompletedDays > 0 || evidence.mismatchedCompletedDays > 0) || monitoring?.cron === "failed";
    if (ingestionBad) reason.push("ingestion_failures");
    if (evidence?.missingCompletedDays) reason.push("rollup_gaps");
    if (evidence?.mismatchedCompletedDays) reason.push("rollup_mismatch");
    if (monitoring?.cron === "failed") reason.push("cron_failed");
    if (monitoring?.cron === "delayed") reason.push("cron_delayed");
    if (evidence && monitoring && monitoring.accepted > evidence.recentEventCount) reason.push("ingestion_count_unreconciled");
    if(monitoring?.detail) {
        if(monitoring.detail.missingIntervalCount) reason.push("collection_intervals_missing");
        if(monitoring.detail.failedCollectionCount) reason.push("collector_failures_observed");
        if(monitoring.detail.maximumDeliverySeconds) reason.push("evidence_delivery_delayed");
        if(monitoring.detail.retainedFrom>monitoring.detail.windowStart) reason.push("operational_retention_limits_coverage");
    }
    let state: ReportingHealth["state"] = "INSUFFICIENT_EVIDENCE";
    if (ingestionBad && rollupBad) state = "INGESTION_AND_ROLLUP_UNHEALTHY";
    else if (ingestionBad) state = "INGESTION_STALLED";
    else if (rollupBad) state = "ROLLUP_STALLED";
    else if (evidence && monitoring?.coverage === "complete" && monitoring.runtimeLogs === "complete"
        && monitoring.cron === "succeeded" && evidence.pendingGraceDays === 0) {
        if (monitoring.attempted === 0 && evidence.recentEventCount === 0) {
            state = "NO_RECENT_TRAFFIC"; reason.push("no_observed_attempts");
        } else if (monitoring.accepted > 0 && monitoring.accepted === monitoring.attempted && evidence.recentEventCount >= monitoring.accepted) {
            state = "HEALTHY_WITH_EVIDENCE"; reason.push("positive_ingestion_and_rollup_evidence");
        }
    }
    return { state, observedAt, evidence, monitoringCoverage: monitoring?.coverage ?? "unavailable", runtimeLogCoverage: monitoring?.runtimeLogs ?? "unavailable", reason, ...(monitoring?.detail ? { monitoring: validateMonitoringDetail(monitoring.detail, observedAt) } : {}) };
}
export function validateReportingHealth(value: unknown): ReportingHealth {
    const extra = value && typeof value === "object" && Object.hasOwn(value, "monitoring") ? ["monitoring"] : [];
    const row = object(value, ["state", "observedAt", "evidence", "monitoringCoverage", "runtimeLogCoverage", "reason", ...extra]);
    if(extra.length) {
        const detail=validateMonitoringDetail(row.monitoring, timestamp(row.observedAt));
        if(row.monitoringCoverage==="complete" && (detail.missingIntervalCount>0 || detail.retainedFrom>detail.windowStart)) return invalid();
    }
    member(row.state, HEALTH_STATE); timestamp(row.observedAt);
    if (row.evidence !== null) { const evidence = validateDatabaseEvidence(row.evidence); if (evidence.observedAt !== row.observedAt) return invalid(); }
    member(row.monitoringCoverage, ["complete", "partial", "unavailable"]); member(row.runtimeLogCoverage, ["complete", "partial", "unavailable"]);
    const reason = array(row.reason, HEALTH_REASON.length); reason.forEach(item => member(item, HEALTH_REASON));
    if (new Set(reason).size !== reason.length) return invalid();
    const evidence = row.evidence as DatabaseEvidence | null;
    if ((row.state === "HEALTHY_WITH_EVIDENCE" || row.state === "NO_RECENT_TRAFFIC") &&
        (!evidence || row.monitoringCoverage !== "complete" || row.runtimeLogCoverage !== "complete" || evidence.missingCompletedDays > 0 || evidence.mismatchedCompletedDays > 0 || evidence.pendingGraceDays > 0)) return invalid();
    if (row.state === "HEALTHY_WITH_EVIDENCE" && (!evidence?.recentEventCount || !reason.includes("positive_ingestion_and_rollup_evidence"))) return invalid();
    if (row.state === "NO_RECENT_TRAFFIC" && (evidence?.recentEventCount !== 0 || !reason.includes("no_observed_attempts"))) return invalid();
    return value as ReportingHealth;
}
