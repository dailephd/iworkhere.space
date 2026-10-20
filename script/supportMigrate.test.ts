import { readdirSync, readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { migrateSupport } from "./supportMigrate";

const { neonMock, query, transaction } = vi.hoisted(() => {
    const query = vi.fn((statement: string, parameter: unknown[]) => ({ statement, parameter }));
    const transaction = vi.fn().mockResolvedValue([]);
    return { query, transaction, neonMock: vi.fn(() => ({ query, transaction })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("requires explicit configuration without connecting", async () => {
    vi.stubEnv("SUPPORT_MIGRATION_DATABASE_URL", undefined);
    await expect(migrateSupport()).rejects.toThrow("SUPPORT_MIGRATION_DATABASE_URL is required");
    expect(neonMock).not.toHaveBeenCalled();
});
it("never reuses the observability or runtime credentials", async () => {
    vi.stubEnv("SUPPORT_MIGRATION_DATABASE_URL", undefined);
    vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    vi.stubEnv("SUPPORT_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    await expect(migrateSupport()).rejects.toThrow("SUPPORT_MIGRATION_DATABASE_URL is required");
    expect(neonMock).not.toHaveBeenCalled();
});
it("applies the support schema in one transaction per file and keeps function bodies intact", async () => {
    vi.stubEnv("SUPPORT_MIGRATION_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    await migrateSupport();
    expect(transaction).toHaveBeenCalledTimes(readdirSync("database/support").filter(name => /^\d{3}-.*\.sql$/.test(name)).length);
    expect(transaction.mock.calls[0][0][0].statement).toContain("CREATE SCHEMA IF NOT EXISTS support");
    expect(query.mock.calls.every(call => call[1].length === 0)).toBe(true);
    const text = query.mock.calls.map(call => call[0]).join("\n");
    expect(text).toContain("CREATE OR REPLACE FUNCTION support.submit_report");
    expect(text).toContain("FOR UPDATE SKIP LOCKED");
    expect(text).not.toMatch(/CREATE ROLE|GRANT CONNECT|observability\./);
});
it("withholds connection and schema errors", async () => {
    vi.stubEnv("SUPPORT_MIGRATION_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
    transaction.mockRejectedValueOnce(new Error("SQL raw connection diagnostics"));
    const error = await migrateSupport().catch(caught => caught);
    expect(error.message).toContain("Database diagnostics are withheld");
    expect(error.message).not.toContain("raw connection");
});
it("keeps the support SQL independent from the observability schema", () => {
    for (const name of readdirSync("database/support").filter(file => file.endsWith(".sql"))) {
        const text = readFileSync(`database/support/${name}`, "utf8");
        expect(text, name).not.toMatch(/observability\.(?!dashboard)/);
        expect(text, name).not.toMatch(/ALTER TABLE observability|DROP .*observability/i);
    }
});
