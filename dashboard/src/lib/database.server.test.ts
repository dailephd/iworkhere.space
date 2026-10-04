import { afterEach, expect, it, vi } from "vitest";
import { DashboardUnavailable, loadDashboard } from "./database.server";
import { rangePlan } from "./range";

const { transaction, query, neonMock } = vi.hoisted(() => {
    const transaction = vi.fn().mockResolvedValue([[], [], [], [{ last_raw_received: null, last_rollup_day: null }], []]);
    const query = vi.fn(() => ({}));
    return { transaction, query, neonMock: vi.fn(() => ({ transaction, query })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const plan = rangePlan("24h", new Date("2026-10-01T12:00:00Z"));
it("fails closed on missing database configuration before creating a connection", async () => {
    vi.stubEnv("OBSERVABILITY_DASHBOARD_DATABASE_URL", undefined);
    await expect(loadDashboard(plan)).rejects.toMatchObject({ category: "configuration" });
    expect(neonMock).not.toHaveBeenCalled();
});
it("reads all aggregates in one read-only repeatable-read snapshot", async () => {
    vi.stubEnv("OBSERVABILITY_DASHBOARD_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    expect(await loadDashboard(plan)).toMatchObject({ activity: [], vital: [], failure: [] });
    expect(transaction).toHaveBeenCalledWith(expect.any(Array), { readOnly: true, isolationLevel: "RepeatableRead" });
    expect(query).toHaveBeenCalledTimes(5);
});
it("withholds raw database diagnostics and credentials on failure", async () => {
    vi.stubEnv("OBSERVABILITY_DASHBOARD_DATABASE_URL", "postgresql://private:password@example.invalid/db");
    transaction.mockRejectedValueOnce(new Error("raw SQL private connection failure"));
    const error = await loadDashboard(plan).catch(error => error);
    expect(error).toBeInstanceOf(DashboardUnavailable);
    expect(error.category).toBe("database");
    expect(error.message).not.toMatch(/private|password|SQL|postgresql/);
});
