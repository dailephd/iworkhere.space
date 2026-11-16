import { describe, expect, it } from "vitest";
import { assessReportingHealth, type DatabaseEvidence, type MonitoringEvidence } from "./reportingHealth";
const observedAt = "2026-10-01T12:00:00.000Z";
const evidence = (): DatabaseEvidence => ({ observedAt, retainedFrom: "2026-07-04T00:00:00.000Z", recentEventCount: 100, missingCompletedDays: 0, mismatchedCompletedDays: 0, pendingGraceDays: 0, lastRawReceived: "2026-10-01T11:00:00.000Z", lastRollupDay: "2026-09-30" });
const monitor = (): MonitoringEvidence => ({ observedAt, coverage: "complete", runtimeLogs: "complete", attempted: 100, accepted: 100, failed: 0, unresolved: 0, cron: "succeeded" });
describe("evidence-based health", () => {
    it("requires positive ingestion, rollup reconciliation and complete independent coverage", () => expect(assessReportingHealth(observedAt, evidence(), monitor()).state).toBe("HEALTHY_WITH_EVIDENCE"));
    it("finds interior missing days despite a fresh maximum", () => {
        const result = assessReportingHealth(observedAt, { ...evidence(), missingCompletedDays: 1 }, monitor());
        expect(result.state).toBe("ROLLUP_STALLED"); expect(result.reason).toContain("rollup_gaps");
    });
    it("classifies raw/daily count mismatch as rollup unhealthy", () => expect(assessReportingHealth(observedAt, { ...evidence(), mismatchedCompletedDays: 1 }, monitor()).state).toBe("ROLLUP_STALLED"));
    it("does not turn no recorded activity into outage or proven no traffic", () => {
        const result = assessReportingHealth(observedAt, { ...evidence(), recentEventCount: 0, lastRawReceived: null }, null);
        expect(result.state).toBe("INSUFFICIENT_EVIDENCE"); expect(result.reason).toContain("no_recorded_activity");
    });
    it("needs complete zero-attempt monitoring to establish no recent traffic", () => expect(assessReportingHealth(observedAt, { ...evidence(), recentEventCount: 0, lastRawReceived: null }, { ...monitor(), attempted: 0, accepted: 0 }).state).toBe("NO_RECENT_TRAFFIC"));
    it("recognizes observed failed and overdue ingestion attempts", () => {
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), accepted: 99, failed: 1 }).state).toBe("INGESTION_STALLED");
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), accepted: 99, unresolved: 1 }).state).toBe("INGESTION_STALLED");
    });
    it("recognizes failed cron and combined failures independently", () => {
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), cron: "failed" }).state).toBe("ROLLUP_STALLED");
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), cron: "failed", failed: 1, accepted: 99 }).state).toBe("INGESTION_AND_ROLLUP_UNHEALTHY");
    });
    it("does not treat incomplete current day as missing rollup", () => {
        const result = assessReportingHealth(observedAt, evidence(), monitor());
        expect(result.state).toBe("HEALTHY_WITH_EVIDENCE"); expect(result.reason).toContain("current_day_incomplete");
    });
    it("distinguishes schedule delay and grace from proven stall", () => {
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), cron: "delayed" }).state).toBe("INSUFFICIENT_EVIDENCE");
        const result = assessReportingHealth(observedAt, { ...evidence(), pendingGraceDays: 1 }, monitor());
        expect(result.state).toBe("INSUFFICIENT_EVIDENCE"); expect(result.reason).toContain("schedule_grace");
    });
    it("discloses retention limits even when retained-day evidence is healthy", () => expect(assessReportingHealth(observedAt, evidence(), monitor()).reason).toContain("raw_retention_limits_history"));
    it.each(["partial", "unavailable"] as const)("keeps %s runtime logs from proving health", runtimeLogs => expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), runtimeLogs }).state).toBe("INSUFFICIENT_EVIDENCE"));
    it("does not claim ingestion health from database or UI availability", () => expect(assessReportingHealth(observedAt, evidence()).state).toBe("INSUFFICIENT_EVIDENCE"));
    it("handles inaccessible database and unknown external state explicitly", () => {
        const result = assessReportingHealth(observedAt, null);
        expect(result.state).toBe("INSUFFICIENT_EVIDENCE"); expect(result.evidence).toBeNull(); expect(result.reason).toContain("database_unavailable");
        expect(assessReportingHealth(observedAt, evidence(), { ...monitor(), cron: "unknown" }).state).toBe("INSUFFICIENT_EVIDENCE");
    });
    it("rejects stale, contradictory and malformed evidence", () => {
        expect(() => assessReportingHealth(observedAt, { ...evidence(), observedAt: "2026-09-30T12:00:00.000Z" }, monitor())).toThrow();
        expect(() => assessReportingHealth(observedAt, evidence(), { ...monitor(), attempted: 1 })).toThrow();
        expect(() => assessReportingHealth(observedAt, { ...evidence(), missingCompletedDays: NaN }, monitor())).toThrow();
        expect(() => assessReportingHealth(observedAt, { ...evidence(), lastRollupDay: "2026-10-01" }, monitor())).toThrow();
        expect(() => assessReportingHealth(observedAt, evidence(), { ...monitor(), private: "secret" } as MonitoringEvidence)).toThrow();
    });
});

it("does not call accepted attempts healthy when they exceed recorded-window events", () => {
    const result = assessReportingHealth(observedAt, { ...evidence(), recentEventCount: 1 }, monitor());
    expect(result.state).toBe("INSUFFICIENT_EVIDENCE"); expect(result.reason).toContain("ingestion_count_unreconciled");
});
