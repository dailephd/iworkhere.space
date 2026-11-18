import { afterEach, expect, it, vi } from "vitest";
import { readMonitoring } from "./monitoring.server";
const { transaction, query } = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn((text, parameter) => ({ text, parameter })) }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ transaction, query }) }));
const now = new Date("2026-11-17T12:20:00.000Z");
const row = { observed_at: now.toISOString(), coverage: "unavailable", attempted: "0", accepted: "0", failed: "0", unresolved: "0", cron: "unknown", retained_from: now.toISOString(), last_collected_at: null, missing_interval_count: "1", failed_collection_count: "0", maximum_delivery_seconds: "0" };
afterEach(() => vi.clearAllMocks());
it("executes only the approved aggregate function in a bounded read-only transaction", async () => {
    transaction.mockResolvedValue([[], [row]]);
    expect((await readMonitoring("postgresql://fixture.invalid/db", now))?.coverage).toBe("unavailable");
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ readOnly: true, isolationLevel: "RepeatableRead", fetchOptions: { signal: expect.any(AbortSignal) } }));
    expect(query.mock.calls[1][1]).toEqual([now.toISOString()]);
    expect(JSON.stringify(query.mock.calls)).not.toMatch(/attempt_id|support|diagnostic/);
});
it.each([[], [[], []], [[], [{ ...row, body: "private support" }]], [[], [{ ...row, attempted: Infinity }]]].map(result => ({ result })))("withholds malformed database summaries", async ({ result }) => {
    transaction.mockResolvedValue(result);
    expect(await readMonitoring("postgresql://fixture.invalid/db", now)).toBeNull();
});
it("does not serialize permission, timeout or credential diagnostics", async () => {
    transaction.mockRejectedValue(Error("private database URL token support"));
    expect(await readMonitoring("postgresql://fixture.invalid/db", now)).toBeNull();
});
