import { afterEach, expect, it, vi } from "vitest";
import { loadReporting, type ReportingReader } from "./reportingDatabase.server";
import { reportingFixture, reportingNow as now } from "../test/reportingFixture";
import { ReportingUnavailable } from "./reportingContract";
const request = { schemaVersion: 1, range: "24h" };
afterEach(() => vi.useRealTimers());
it("executes only three fixed aggregate statements in a bounded read-only consistent snapshot", async () => {
    const fixture = reportingFixture();
    const transaction = vi.fn().mockResolvedValue([fixture.activity, fixture.vital, fixture.evidence]);
    const result = await loadReporting(request, { transaction }, now);
    expect(result.health.state).toBe("INSUFFICIENT_EVIDENCE");
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ readOnly: true, isolationLevel: "RepeatableRead", statementTimeoutMs: 15000, maximumResultBytes: 131072, signal: expect.any(AbortSignal) }));
    expect(transaction.mock.calls[0][0]).toHaveLength(3);
    expect(JSON.stringify(transaction.mock.calls[0][0])).not.toMatch(/error_diagnostic|support|message|stack/);
});
it("rejects invalid request before query execution", async () => {
    const transaction = vi.fn();
    await expect(loadReporting({ ...request, sql: "private" }, { transaction }, now)).rejects.toMatchObject({ code: "invalid_request" });
    expect(transaction).not.toHaveBeenCalled();
});
it("aborts at deadline and never publishes a partial result", async () => {
    vi.useFakeTimers();
    const transaction = vi.fn<ReportingReader["transaction"]>(() => new Promise(() => {}));
    const pending = loadReporting(request, { transaction }, now);
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(15000); await assertion;
    expect(transaction.mock.calls[0][1].signal.aborted).toBe(true);
});
it("suppresses untrusted driver exceptions and error results", async () => {
    const error = await loadReporting(request, { transaction: async () => { throw { message: "postgresql://secret", cause: { contact_email: "secret" } }; } }, now).catch(error => error);
    expect(error).toBeInstanceOf(ReportingUnavailable); expect(error.message).toBe("Reporting unavailable: database"); expect(error.cause).toBeUndefined();
    await expect(loadReporting(request, { transaction: async () => ({ summary: "support text" }) }, now)).rejects.toMatchObject({ code: "invalid_result" });
    await expect(loadReporting(request, { transaction: async () => [[], []] }, now)).rejects.toMatchObject({ code: "invalid_result" });
});
