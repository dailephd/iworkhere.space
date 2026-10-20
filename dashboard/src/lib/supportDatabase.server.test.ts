import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardUnavailable } from "./database.server";
import { loadSupportDetail, loadSupportList } from "./supportDatabase.server";
import { SUPPORT_PAGE_SIZE } from "./supportQuery";

const { transaction, query, neonMock } = vi.hoisted(() => {
    const transaction = vi.fn();
    const query = vi.fn((text: string, parameter: string[]) => ({ text, parameter }));
    return { transaction, query, neonMock: vi.fn(() => ({ transaction, query })) };
});
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); transaction.mockReset(); });
const URL_FIXTURE = "postgresql://support_dashboard:fixture@example.invalid/db";
const listRow = (n: number) => ({ id: `SR-${String(n).padStart(16, "0")}`, category: "other", area: "site-wide", tool_id: null, pathname: "/", received_at: "2026-10-19T12:00:00.000Z", dead_job_count: 0, undelivered_job_count: "1", has_tracker: false });

describe("support list", () => {
    it("fails closed without the support credential and never falls back to the observability credential", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", undefined);
        vi.stubEnv("OBSERVABILITY_DASHBOARD_DATABASE_URL", "postgresql://obs:fixture@example.invalid/db");
        await expect(loadSupportList(1)).rejects.toMatchObject({ category: "configuration" });
        expect(neonMock).not.toHaveBeenCalled();
    });
    it("connects only with the support credential in one read-only repeatable-read snapshot", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        vi.stubEnv("OBSERVABILITY_DASHBOARD_DATABASE_URL", "postgresql://obs:fixture@example.invalid/db");
        transaction.mockResolvedValue([[listRow(1)], [{ undelivered_count: "1", retrying_count: 0, dead_count: "0", failing_count: 0, oldest_pending_at: "2026-10-19T12:00:00.000Z" }]]);
        const data = await loadSupportList(1);
        expect(neonMock).toHaveBeenCalledWith(URL_FIXTURE, expect.anything());
        expect(transaction).toHaveBeenCalledWith(expect.any(Array), { readOnly: true, isolationLevel: "RepeatableRead" });
        expect(query).toHaveBeenCalledTimes(2);
        expect(data.report[0]).toMatchObject({ id: "SR-0000000000000001", undelivered_job_count: 1 });
        expect(data.health).toMatchObject({ undelivered_count: 1, dead_count: 0, oldest_pending_at: "2026-10-19T12:00:00.000Z" });
        expect(data.hasNext).toBe(false);
    });
    it("detects another page from the extra row and trims it", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        transaction.mockResolvedValue([Array.from({ length: SUPPORT_PAGE_SIZE + 1 }, (_, index) => listRow(index + 1)), []]);
        const data = await loadSupportList(1);
        expect(data.report).toHaveLength(SUPPORT_PAGE_SIZE);
        expect(data.hasNext).toBe(true);
        expect(data.health).toEqual({ undelivered_count: 0, retrying_count: 0, dead_count: 0, failing_count: 0, oldest_pending_at: null });
    });
    it("withholds raw database diagnostics and credentials", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        transaction.mockRejectedValue(new Error(`permission denied for ${URL_FIXTURE} SELECT * FROM support.report`));
        const error = await loadSupportList(1).catch(caught => caught);
        expect(error).toBeInstanceOf(DashboardUnavailable);
        expect(error.category).toBe("database");
        expect(error.message).not.toMatch(/permission|SELECT|postgresql|fixture/);
    });
    it("rejects a corrupt aggregate instead of rendering it", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        transaction.mockResolvedValue([[{ ...listRow(1), dead_job_count: -1 }], []]);
        await expect(loadSupportList(1)).rejects.toBeInstanceOf(DashboardUnavailable);
    });
});

describe("support detail", () => {
    it("returns null for a malformed reference without any database access", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        for (const id of ["", "x", "SR-ILOU000000000000", "SR-0123456789ABCDEF'; DROP TABLE support.report; --"]) expect(await loadSupportDetail(id)).toBeNull();
        expect(neonMock).not.toHaveBeenCalled();
    });
    it("returns null for an unknown report and the full record for a known one", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", URL_FIXTURE);
        transaction.mockResolvedValueOnce([[], []]);
        expect(await loadSupportDetail("SR-0123456789ABCDEF")).toBeNull();
        transaction.mockResolvedValueOnce([[{ id: "SR-0123456789ABCDEF", category: "tool_failure", area: "tool", tool_id: "merge-pdf", pathname: "/tool/merge-pdf", received_at: "2026-10-19T12:00:00.000Z", description: "full text", expected: null, observed: null, contact_email: "reader@example.com", contact_consent: true, tracker_issue_url: null, narrative_purged_at: null, contact_purged_at: null }], [{ kind: "github_issue", status: "pending", attempt_count: "2", failure_code: "timeout", next_attempt_at: "2026-10-19T12:10:00.000Z", delivered_at: null, updated_at: "2026-10-19T12:05:00.000Z" }]]);
        const data = await loadSupportDetail("SR-0123456789ABCDEF");
        expect(data?.report).toMatchObject({ description: "full text", contact_email: "reader@example.com", contact_consent: true });
        expect(data?.job).toEqual([{ kind: "github_issue", status: "pending", attempt_count: 2, failure_code: "timeout", next_attempt_at: "2026-10-19T12:10:00.000Z", delivered_at: null, updated_at: "2026-10-19T12:05:00.000Z" }]);
        expect(transaction).toHaveBeenLastCalledWith(expect.any(Array), { readOnly: true, isolationLevel: "RepeatableRead" });
    });
    it("is unavailable without the support credential", async () => {
        vi.stubEnv("SUPPORT_DASHBOARD_DATABASE_URL", "");
        await expect(loadSupportDetail("SR-0123456789ABCDEF")).rejects.toMatchObject({ category: "configuration" });
    });
});
