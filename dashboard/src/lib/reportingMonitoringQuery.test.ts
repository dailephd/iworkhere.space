import { expect, it } from "vitest";
import { monitoringFromRow, monitoringQuery } from "./reportingMonitoringQuery";
import { assessReportingHealth } from "./reportingHealth";
const now = new Date("2026-11-17T12:20:00.000Z");
const row = () => ({ observed_at: "2026-11-17T12:05:00.000Z", coverage: "partial", attempted: "2", accepted: "1", failed: "1", unresolved: "0", cron: "unknown", retained_from: "2026-11-17T00:00:00.000Z", last_collected_at: now.toISOString(), missing_interval_count: "1", failed_collection_count: "0", maximum_delivery_seconds: "900" });
it("projects only aggregate evidence at an explicit bounded observation time", () => {
    const result = monitoringFromRow(row(), now);
    expect(result.detail?.windowStart).toBe("2026-11-16T12:05:00.000Z");
    expect(assessReportingHealth(result.observedAt, null, result).state).toBe("INGESTION_STALLED");
    expect(monitoringQuery(now).parameter).toEqual([now.toISOString()]);
    expect(monitoringQuery(now).text).not.toMatch(/health_operation|attempt_id|support|diagnostic/);
});
it.each([{ private: { support: "contact" } }, { attempted: NaN }, { accepted: "3" }, { failed: -1 }, { observed_at: "2026-11-17T11:00:00.000Z" }, { last_collected_at: "2026-11-18T00:00:00.000Z" }, { coverage: "complete" }, { cron: "private" }])("rejects unsafe, stale, inconsistent or private summaries", value => {
    expect(() => monitoringFromRow({ ...row(), ...value }, now)).toThrow();
});
it("preserves insufficient evidence for partial coverage without demonstrated failures", () => {
    const evidence = monitoringFromRow({ ...row(), failed: "0", attempted: "1" }, now);
    expect(assessReportingHealth(evidence.observedAt, null, evidence).state).toBe("INSUFFICIENT_EVIDENCE");
});
