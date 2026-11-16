import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observe, reportingReader } from "./observability.server";
import { reportingQuery } from "../../../dashboard/src/lib/reportingQuery";
import { loadReporting, type ReportingReadOption } from "../../../dashboard/src/lib/reportingDatabase.server";
import { rangePlan } from "../../../dashboard/src/lib/range";
import { reportingFixture, reportingNow as now } from "../../../dashboard/src/test/reportingFixture";
import { neonConfig } from "@neondatabase/serverless";
const { transaction, query, factory } = vi.hoisted(() => {
    const transaction = vi.fn(), query = vi.fn((text: string, parameter: unknown[]) => ({ text, parameter }));
    return { transaction, query, factory: vi.fn(() => ({ transaction, query })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: factory, neonConfig: {} }));
const request = { schemaVersion: 1, range: "24h" };
const url = "postgresql://observability_reporting:fixture@example.invalid/db";
const option: ReportingReadOption = { readOnly: true, isolationLevel: "RepeatableRead", statementTimeoutMs: 15000, maximumResultBytes: 131072, signal: new AbortController().signal };
function queries() { const q = reportingQuery(rangePlan("24h", now)); return [q.activity, q.vital, q.evidence]; }
beforeEach(() => {
    const fixture = reportingFixture(); transaction.mockResolvedValue([[{ timeout: "15000" }], fixture.activity, fixture.vital, fixture.evidence]);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
it("runs only canonical B1 parameters in a read-only repeatable snapshot with SQL timeout", async () => {
    const result = await loadReporting(request, reportingReader(url, request, now), now);
    expect(result.navigationCount).toBe(22); expect(result.toolOpenCount).toBe(14);
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ readOnly: true, isolationLevel: "RepeatableRead", fetchOptions: { signal: expect.any(AbortSignal) } }));
    expect(query.mock.calls[0]).toEqual(["SELECT set_config('statement_timeout', $1, true) AS timeout", ["15000"]]);
    expect(query.mock.calls.slice(1)).toEqual(queries().map(item => [item.text, item.parameter]));
    expect(JSON.stringify(query.mock.calls)).not.toMatch(/error_diagnostic|support|message|stack/);
});
it("rejects unexpected SQL and parameters before creating a driver", async () => {
    const q = queries(); q[0] = { text: "SELECT private", parameter: [] };
    await expect(reportingReader(url, request, now).transaction(q, option)).rejects.toThrow(); expect(factory).not.toHaveBeenCalled();
});
it.each([new Error("permission denied private SQL"), new Error("postgresql://private-password unavailable")])("withholds unavailable and missing-permission diagnostics", async error => {
    transaction.mockRejectedValueOnce(error);
    const result = await loadReporting(request, reportingReader(url, request, now), now).catch(error => error);
    expect(result.message).toBe("Reporting unavailable: database"); expect(result.cause).toBeUndefined();
});
it("rejects malformed/partial tuples and untrusted nested DB rows", async () => {
    transaction.mockResolvedValueOnce([[], []]);
    await expect(loadReporting(request, reportingReader(url, request, now), now)).rejects.toThrow();
    const fixture = reportingFixture(); (fixture.activity as Record<string, unknown>[])[0].safe = { support: ["private contact"] };
    transaction.mockResolvedValueOnce([[], fixture.activity, fixture.vital, fixture.evidence]);
    await expect(loadReporting(request, reportingReader(url, request, now), now)).rejects.toThrow("invalid_result");
});
it("fails closed on missing or broad dashboard credentials", async () => {
    vi.stubEnv("REPORTING_DATABASE_URL", undefined); await expect(observe(request)).rejects.toThrow("configuration");
    vi.stubEnv("REPORTING_DATABASE_URL", "postgresql://observability_dashboard:fixture@example.invalid/db"); await expect(observe(request)).rejects.toThrow("database");
    expect(factory).not.toHaveBeenCalled();
});
it("enforces B1 timeout and aborts rather than returning partial data", async () => {
    vi.useFakeTimers(); transaction.mockImplementationOnce(() => new Promise(() => {}));
    const pending = loadReporting(request, reportingReader(url, request, now), now);
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" }); await vi.advanceTimersByTimeAsync(15000); await assertion;
    expect(transaction.mock.calls[0][1].fetchOptions.signal.aborted).toBe(true);
});
it("bounds Neon transport bytes before driver decoding", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(131073))));
    try { await expect(neonConfig.fetchFunction("https://fixture.invalid/sql")).rejects.toThrow("size_limit"); }
    finally { vi.unstubAllGlobals(); }
});
it("reuses B1 health gap and unavailable-evidence classifications", async () => {
    const fixture = reportingFixture(); (fixture.evidence as Record<string, unknown>[])[0].missing_completed_days = "1";
    transaction.mockResolvedValueOnce([[], fixture.activity, fixture.vital, fixture.evidence]);
    const report = await loadReporting(request, reportingReader(url, request, now), now);
    expect(report.health.state).toBe("ROLLUP_STALLED"); expect(report.health.reason).toContain("current_day_incomplete"); expect(report.health.reason).toContain("runtime_logs_inaccessible");
    const ordinary = await loadReporting(request, reportingReader(url, request, now), now); expect(ordinary.health.state).toBe("INSUFFICIENT_EVIDENCE");
});
