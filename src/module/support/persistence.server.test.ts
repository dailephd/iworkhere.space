import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizedReport } from "./contract";
import { defaultIntakeSql, intakeConfigured, newReportId, reportDigest, submitReport, SupportUnavailableError, type SupportSql } from "./persistence.server";

const report: NormalizedReport = {
    category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf", description: "d", expected: null, observed: null, email: null, contactConsent: false,
};
const KEY = "5f1f2b0e-9a3c-4b8a-8d1e-0a1b2c3d4e5f";
const sqlReturning = (rows: Record<string, unknown>[]): SupportSql & { query: ReturnType<typeof vi.fn> } => ({ query: vi.fn().mockResolvedValue(rows) });
afterEach(() => { vi.unstubAllEnvs(); });

describe("newReportId", () => {
    it("matches the database format and is unique", () => {
        const ids = new Set(Array.from({ length: 500 }, () => newReportId()));
        expect(ids.size).toBe(500);
        for (const id of ids) expect(id).toMatch(/^SR-[0-9A-HJKMNP-TV-Z]{16}$/);
    });
    it("encodes 80 bits deterministically", () => {
        expect(newReportId(Buffer.alloc(10, 0))).toBe("SR-0000000000000000");
        expect(newReportId(Buffer.alloc(10, 255))).toBe("SR-ZZZZZZZZZZZZZZZZ");
    });
});

describe("reportDigest", () => {
    it("is a stable sha-256 of content and ignores nothing that changes content", () => {
        expect(reportDigest(report)).toMatch(/^[0-9a-f]{64}$/);
        expect(reportDigest(report)).toBe(reportDigest({ ...report }));
        expect(reportDigest({ ...report, description: "e" })).not.toBe(reportDigest(report));
        expect(reportDigest({ ...report, email: "a@b.co", contactConsent: true })).not.toBe(reportDigest(report));
    });
});

describe("submitReport", () => {
    it("calls the atomic function once with parameters, never interpolating values into SQL", async () => {
        const sql = sqlReturning([{ outcome: "created", report_id: "SR-0123456789ABCDEF", received_at: new Date("2026-10-19T12:00:00Z") }]);
        const hostile = { ...report, description: "'; DROP TABLE support.report; --" };
        const outcome = await submitReport(hostile, KEY, { sql, newId: () => "SR-0123456789ABCDEF", limit: 7 });
        expect(outcome).toEqual({ kind: "created", reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" });
        expect(sql.query).toHaveBeenCalledTimes(1);
        const [text, params] = sql.query.mock.calls[0];
        expect(text).toContain("support.submit_report");
        expect(text).not.toContain("DROP TABLE");
        expect(params).toContain("'; DROP TABLE support.report; --");
        expect(params).toContain(KEY);
        expect(params).toHaveLength(13);
        expect(params[12]).toBe(7);
    });
    it("reports replays, conflicts and the intake ceiling", async () => {
        expect(await submitReport(report, KEY, { sql: sqlReturning([{ outcome: "replayed", report_id: "SR-0123456789ABCDEF", received_at: "2026-10-19T12:00:00Z" }]) })).toEqual({ kind: "replayed", reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" });
        expect(await submitReport(report, KEY, { sql: sqlReturning([{ outcome: "conflict", report_id: "SR-0123456789ABCDEF" }]) })).toEqual({ kind: "conflict" });
        expect(await submitReport(report, KEY, { sql: sqlReturning([{ outcome: "rate_limited", report_id: null }]) })).toEqual({ kind: "rate_limited" });
    });
    it("never returns a receipt for an empty or malformed database answer", async () => {
        for (const rows of [[], [{ outcome: "created", report_id: null, received_at: null }], [{ outcome: "created", report_id: "bad", received_at: "2026-10-19T12:00:00Z" }], [{ outcome: "created", report_id: "SR-0123456789ABCDEF", received_at: null }], [{ outcome: "weird" }]]) {
            await expect(submitReport(report, KEY, { sql: sqlReturning(rows) })).rejects.toBeInstanceOf(SupportUnavailableError);
        }
    });
    it("hides driver errors behind a typed unavailable error", async () => {
        const sql: SupportSql = { query: vi.fn().mockRejectedValue(new Error("connection refused postgres://user:pw@host/db")) };
        const error = await submitReport(report, KEY, { sql }).catch(caught => caught);
        expect(error).toBeInstanceOf(SupportUnavailableError);
        expect(error.message).not.toContain("postgres://");
    });
    it("is unavailable when no database is configured", async () => {
        vi.stubEnv("SUPPORT_DATABASE_URL", "");
        expect(intakeConfigured()).toBe(false);
        expect(() => defaultIntakeSql()).toThrow(SupportUnavailableError);
        await expect(submitReport(report, KEY)).rejects.toBeInstanceOf(SupportUnavailableError);
    });
    it("reads only the dedicated intake credential", () => {
        vi.stubEnv("SUPPORT_DATABASE_URL", "");
        vi.stubEnv("OBSERVABILITY_DATABASE_URL", "postgresql://fixture:fixture@example.invalid/db");
        expect(intakeConfigured()).toBe(false);
    });
});
