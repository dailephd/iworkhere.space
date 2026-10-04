import { afterEach, expect, it, vi } from "vitest";
import { migrateObservability } from "./observabilityMigrate";

const { neonMock, query, transaction } = vi.hoisted(() => {
    const query = vi.fn((statement: string, parameter: unknown[]) => ({ statement, parameter }));
    const transaction = vi.fn().mockResolvedValue([]);
    return { query, transaction, neonMock: vi.fn(() => ({ query, transaction })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("requires explicit configuration without connecting", async () => {
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", undefined);
    await expect(migrateObservability()).rejects.toThrow("OBSERVABILITY_DATABASE_URL is required");
    expect(neonMock).not.toHaveBeenCalled();
});
it("applies migrations in order, each transaction preserving function bodies", async () => {
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    await migrateObservability();
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0][0][0].statement).toContain("CREATE SCHEMA");
    expect(transaction.mock.calls[1][0][0].statement).toContain("CREATE TABLE IF NOT EXISTS observability.error_diagnostic");
    expect(query.mock.calls.length).toBeGreaterThan(10);
    expect(query.mock.calls.every(call => call[1].length === 0)).toBe(true);
    expect(query.mock.calls.some(call => call[0].includes("CREATE OR REPLACE FUNCTION observability.maintain()") && call[0].includes("RETURN NEXT;"))).toBe(true);
    expect(query.mock.calls.map(call => call[0]).join("\n")).not.toMatch(/CREATE ROLE|GRANT CONNECT|CREATE TABLE public/);
});
it("withholds constructor/URL errors, including any secret carried by driver diagnostics", async () => {
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "fixture-secret-invalid-url");
    neonMock.mockImplementationOnce(() => { throw new Error("Invalid connection fixture-secret-invalid-url"); });
    const error = await migrateObservability().catch(error => error);
    expect(error.message).toContain("Observability migration failed");
    expect(error.message).not.toContain("fixture-secret-invalid-url");
});
it("withholds connection and schema errors", async () => {
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    transaction.mockRejectedValueOnce(new Error("SQL raw connection diagnostics"));
    await expect(migrateObservability()).rejects.toThrow("Database diagnostics are withheld");
});
