import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { maintainObservability, persistMetric } from "./persistence.server";
const { sql, query } = vi.hoisted(() => ({ sql: vi.fn(), query: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => Object.assign(sql, { query }) }));
const metric = { type: "navigation" as const, timestamp: "2026-01-01T00:00:00Z", pathname: "/", navigationType: "initial" as const };
beforeEach(() => {
    vi.clearAllMocks(); sql.mockResolvedValue([]); query.mockResolvedValue([]);
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:password@example.invalid/db");
    vi.stubEnv("OBSERVABILITY_PERSISTENCE_ENABLED", "true");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function capture() {
    const sink = vi.spyOn(console, "info").mockImplementation(() => {});
    return { sink, records: () => sink.mock.calls.map(call => JSON.parse(String(call[0]))) };
}
it("records one attempt then success with only fixed fields and a per-operation ID", async () => {
    const { records } = capture(); await persistMetric(metric);
    const logs = records(); expect(logs.map(x => x.status)).toEqual(["attempt", "success"]);
    expect(Object.keys(logs[0]).sort()).toEqual(["source", "schemaVersion", "operation", "status", "attemptId", "startedAt", "timestamp"].sort());
    expect(logs[0]).toMatchObject({ source: "observability-health", schemaVersion: 1, operation: "ingestion" });
    expect(logs[1].attemptId).toBe(logs[0].attemptId); expect(logs[0].startedAt).toBe(logs[0].timestamp);
    expect(JSON.stringify(logs)).not.toMatch(/pathname|navigationType|password|postgresql|fixture|2026-01-01/);
    await persistMetric(metric); expect(records()[2].attemptId).not.toBe(logs[0].attemptId);
});
it("records failure even when database configuration is missing, without exception details", async () => {
    const { records } = capture(); vi.stubEnv("OBSERVABILITY_DATABASE_URL", undefined);
    await expect(persistMetric(metric)).rejects.toThrow(); expect(records().map(x => x.status)).toEqual(["attempt", "failure"]);
});
it("logs rejected writes without copying diagnostic contents into evidence", async () => {
    const { records } = capture(); const error = new Error("secret SQL headers cookies support private@example.invalid");
    sql.mockRejectedValueOnce(error); await expect(persistMetric(metric)).rejects.toBe(error);
    expect(records().map(x => x.status)).toEqual(["attempt", "failure"]);
    expect(JSON.stringify(records())).not.toMatch(/secret|SQL|headers|cookies|support|private@/);
});
it("success follows completion of both existing maintenance steps", async () => {
    const { records } = capture(); await maintainObservability();
    expect(records().map(x => [x.operation, x.status])).toEqual([["maintenance", "attempt"], ["maintenance", "success"]]);
    query.mockRejectedValueOnce(new Error("private diagnostics")); await expect(maintainObservability()).rejects.toThrow();
    expect(records().slice(2).map(x => x.status)).toEqual(["attempt", "failure"]);
});
it("does not change successful persistence if the runtime log sink throws", async () => {
    vi.spyOn(console, "info").mockImplementation(() => { throw new Error("sink failed"); });
    await expect(persistMetric(metric)).resolves.toBeUndefined(); expect(sql).toHaveBeenCalledTimes(1);
});
