import type { Query } from "./query";
import { databaseCount, member, object, timestamp } from "./reportingContract";
import { validateMonitoringEvidence, type MonitoringEvidence } from "./reportingHealth";
import { isoFormat } from "./aggregateQuery";

export function monitoringQuery(now: Date): Query {
    return { text: `SELECT to_char(observed_at AT TIME ZONE 'UTC', ${isoFormat}) AS observed_at, coverage,
        attempted,accepted,failed,unresolved,cron,
        to_char(retained_from AT TIME ZONE 'UTC', ${isoFormat}) AS retained_from,
        to_char(last_collected_at AT TIME ZONE 'UTC', ${isoFormat}) AS last_collected_at,
        missing_interval_count,failed_collection_count,maximum_delivery_seconds
        FROM observability.health_summary($1::timestamptz)`, parameter: [now.toISOString()] };
}
export function monitoringFromRow(value: unknown, now: Date): MonitoringEvidence {
    const row=object(value,["observed_at","coverage","attempted","accepted","failed","unresolved","cron","retained_from","last_collected_at","missing_interval_count","failed_collection_count","maximum_delivery_seconds"]);
    const observedAt=timestamp(row.observed_at), coverage=member(row.coverage,["complete","partial","unavailable"] as const);
    if(row.last_collected_at!==null && timestamp(row.last_collected_at)>now.toISOString()) throw new Error("future_monitoring");
    if(observedAt>now.toISOString() || now.getTime()-Date.parse(observedAt)>1800000) throw new Error("stale_monitoring");
    return validateMonitoringEvidence({ observedAt,coverage,runtimeLogs:coverage,attempted:databaseCount(row.attempted),accepted:databaseCount(row.accepted),failed:databaseCount(row.failed),unresolved:databaseCount(row.unresolved),cron:member(row.cron,["succeeded","failed","delayed","unknown"] as const),detail:{
        windowStart:new Date(Date.parse(observedAt)-86400000).toISOString(),windowEnd:observedAt,retainedFrom:timestamp(row.retained_from),
        lastCollectedAt:row.last_collected_at===null ? null : timestamp(row.last_collected_at),missingIntervalCount:databaseCount(row.missing_interval_count),failedCollectionCount:databaseCount(row.failed_collection_count),maximumDeliverySeconds:databaseCount(row.maximum_delivery_seconds),
    }},observedAt);
}
