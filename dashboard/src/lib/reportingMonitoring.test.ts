import { expect, it } from "vitest";
import { collectReportingMonitoring, type MonitoringCoverage } from "./reportingMonitoring";
import { assessReportingHealth, type DatabaseEvidence } from "./reportingHealth";
const now = "2026-11-17T12:00:00.000Z";
const coverage = (): MonitoringCoverage => ({ from: "2026-11-16T12:00:00.000Z", until: now, instrumentedFrom: "2026-11-01T00:00:00.000Z", complete: true });
function record(status: "attempt" | "success" | "failure", operation = "ingestion", ordinal = 1, startedAt = "2026-11-17T10:00:00.000Z") {
    return { source: "observability-health", schemaVersion: 1, operation, status, attemptId: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`, startedAt, timestamp: status === "attempt" ? startedAt : new Date(Date.parse(startedAt) + 1000).toISOString() };
}
const successful = () => [record("attempt"), record("success"), record("attempt", "maintenance", 2, "2026-11-17T02:16:00.000Z"), record("success", "maintenance", 2, "2026-11-17T02:16:00.000Z")];
it("reconciles complete independent evidence and strips operation identifiers", () => {
    const result = collectReportingMonitoring(now, coverage(), successful());
    expect(result).toEqual({ observedAt: now, coverage: "complete", runtimeLogs: "complete", attempted: 1, accepted: 1, failed: 0, unresolved: 0, cron: "succeeded" });
    expect(JSON.stringify(result)).not.toMatch(/attemptId|00000000|startedAt/);
    const evidence: DatabaseEvidence = { observedAt: now, retainedFrom: "2026-08-20T00:00:00.000Z", recentEventCount: 1, missingCompletedDays: 0, mismatchedCompletedDays: 0, pendingGraceDays: 0, lastRawReceived: "2026-11-17T10:00:00.500Z", lastRollupDay: "2026-11-16" };
    expect(assessReportingHealth(now, evidence, result).state).toBe("HEALTHY_WITH_EVIDENCE");
});
it("deduplicates exact retries and tolerates reverse delivery order", () => expect(collectReportingMonitoring(now, coverage(), [...successful().reverse(), ...successful()]).accepted).toBe(1));
it("does not invent complete coverage from one hour, new instrumentation or a truncated query", () => {
    for (const c of [{ ...coverage(), from: "2026-11-17T11:00:00.000Z" }, { ...coverage(), instrumentedFrom: "2026-11-17T00:00:00.000Z" }, { ...coverage(), complete: false }]) expect(collectReportingMonitoring(now, c, successful()).runtimeLogs).toBe("partial");
    expect(collectReportingMonitoring(now, null, []).coverage).toBe("unavailable");
});
it("counts failed writes and timed-out attempts independently of stored events", () => {
    expect(collectReportingMonitoring(now, coverage(), [record("attempt"), record("failure")])).toMatchObject({ failed: 1, accepted: 0 });
    expect(collectReportingMonitoring(now, coverage(), [record("attempt")]).unresolved).toBe(1);
    expect(collectReportingMonitoring(now, coverage(), [record("attempt", "ingestion", 1, "2026-11-17T11:59:59.000Z")])).toMatchObject({ attempted: 1, accepted: 0, unresolved: 0 });
});
it("recognizes failed, unfinished and absent scheduled execution without using max rollup dates", () => {
    expect(collectReportingMonitoring(now, coverage(), [record("attempt", "maintenance"), record("failure", "maintenance")]).cron).toBe("failed");
    expect(collectReportingMonitoring(now, coverage(), [record("attempt", "maintenance")]).cron).toBe("failed");
    expect(collectReportingMonitoring(now, coverage(), []).cron).toBe("delayed");
    expect(collectReportingMonitoring(now, { ...coverage(), complete: false }, []).cron).toBe("unknown");
});
it("does not infer stalled operations from absent outcomes in an incomplete query", () => {
    const partial = { ...coverage(), complete: false };
    expect(collectReportingMonitoring(now, partial, [record("attempt"), record("attempt", "maintenance", 2)])).toMatchObject({ unresolved: 0, cron: "unknown", coverage: "partial" });
    expect(collectReportingMonitoring(now, partial, [record("attempt"), record("failure")])).toMatchObject({ failed: 1 });
    const recentComplete = { ...coverage(), from: "2026-11-17T09:00:00.000Z" };
    expect(collectReportingMonitoring(now, recentComplete, [record("attempt")])).toMatchObject({ unresolved: 1, coverage: "partial" });
});
it("does not call an outcome without its attempt complete evidence or hide an observed failure", () => {
    expect(collectReportingMonitoring(now, coverage(), [record("success")])).toMatchObject({ coverage: "partial", attempted: 1, accepted: 1 });
    expect(collectReportingMonitoring(now, coverage(), [record("failure")])).toMatchObject({ coverage: "partial", attempted: 1, failed: 1 });
});
it("does not count outcomes for attempts before the rolling window", () => expect(collectReportingMonitoring(now, coverage(), [record("success", "ingestion", 1, "2026-11-16T11:59:59.500Z")]).attempted).toBe(0));
it("rejects conflicting outcomes and correlation reuse", () => {
    expect(() => collectReportingMonitoring(now, coverage(), [record("attempt"), record("success"), record("failure")])).toThrow();
    expect(() => collectReportingMonitoring(now, coverage(), [record("attempt"), record("success", "maintenance")])).toThrow();
});
it.each(["message", "support", "safe", "stack", "headers"])("rejects private/unknown %s properties before projection", key => expect(() => collectReportingMonitoring(now, coverage(), [{ ...record("attempt"), [key]: { nested: ["private"] } }])).toThrow());
it.each([{ schemaVersion: 2 }, { attemptId: "/private/file" }, { status: "diagnostic" }, { timestamp: now }, { startedAt: NaN }, { source: "support-report" }, { operation: "SQL" }])("rejects invalid operational values %j", extra => expect(() => collectReportingMonitoring(now, coverage(), [{ ...record("attempt"), ...extra }])).toThrow());
it("rejects invalid coverage, oversized arrays and impossible chronology", () => {
    expect(() => collectReportingMonitoring(now, { ...coverage(), until: "2026-11-17T11:00:00.000Z" }, [])).toThrow();
    expect(() => collectReportingMonitoring(now, { ...coverage(), complete: "true" as unknown as boolean }, [])).toThrow();
    expect(() => collectReportingMonitoring(now, coverage(), Array(20001).fill(record("attempt")))).toThrow();
    expect(() => collectReportingMonitoring(now, coverage(), [{ ...record("success"), timestamp: "2026-11-17T09:00:00.000Z" }])).toThrow();
});
