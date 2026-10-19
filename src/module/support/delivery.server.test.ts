import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizedCronRequest, handleDeliveryRequest, runDelivery, type DeliveryDependency } from "./delivery.server";
import type { SupportSql } from "./persistence.server";
import type { ProviderSet } from "./provider.server";

interface FakeJob { id: string; token: string; reportId: string; kind: string; contactEmail?: string | null }

/** Records the parameterized calls the worker makes against the database functions. */
function fakeSql(jobs: FakeJob[], options: { payloadMissing?: string[]; failStatus?: string } = {}) {
    const calls: Array<{ fn: string; params: unknown[] }> = [];
    const sql: SupportSql = {
        query: vi.fn(async (text: string, params: unknown[]) => {
            const fn = /support\.(\w+)/.exec(text)![1];
            calls.push({ fn, params });
            if (fn === "claim_jobs") return jobs.map(job => ({ job_id: job.id, lease_token: job.token }));
            if (fn === "job_payload") {
                const job = jobs.find(item => item.id === params[0]);
                if (!job || options.payloadMissing?.includes(job.id)) return [];
                return [{ report_id: job.reportId, kind: job.kind, category: "tool_failure", area: "tool", tool_id: "merge-pdf", pathname: "/tool/merge-pdf", received_at: new Date("2026-10-19T12:00:00Z"), contact_email: job.contactEmail ?? null }];
            }
            if (fn === "fail_job") return [{ status: options.failStatus ?? "pending" }];
            return [];
        }),
    };
    return { sql, calls, of: (fn: string) => calls.filter(call => call.fn === fn) };
}
function providers(overrides: Partial<ProviderSet> = {}): ProviderSet {
    return {
        githubIssue: vi.fn().mockResolvedValue({ ok: true, providerRef: "issue:9", issueNumber: 9, issueUrl: "https://github.com/o/r/issues/9" }),
        operatorEmail: vi.fn().mockResolvedValue({ ok: true, providerRef: "email:op" }),
        contactReceipt: vi.fn().mockResolvedValue({ ok: true, providerRef: "email:rc" }),
        ...overrides,
    };
}
const threeJobs: FakeJob[] = [
    { id: "j1", token: "t1", reportId: "SR-0123456789ABCDEF", kind: "github_issue" },
    { id: "j2", token: "t2", reportId: "SR-0123456789ABCDEF", kind: "operator_email" },
    { id: "j3", token: "t3", reportId: "SR-0123456789ABCDEF", kind: "contact_receipt", contactEmail: "reader@example.com" },
];
let errorLog: ReturnType<typeof vi.spyOn>;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("runDelivery", () => {
    it("delivers each job kind through its own provider and records provider references", async () => {
        errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        const queue = fakeSql(threeJobs);
        const provider = providers();
        const summary = await runDelivery({ sql: queue.sql, provider });
        expect(summary).toEqual({ claimed: 3, delivered: 3, retried: 0, dead: 0, purged: false });
        expect(provider.githubIssue).toHaveBeenCalledTimes(1);
        expect(provider.operatorEmail).toHaveBeenCalledWith(expect.objectContaining({ reportId: "SR-0123456789ABCDEF" }), "j2");
        expect(provider.contactReceipt).toHaveBeenCalledWith(expect.objectContaining({ contactEmail: "reader@example.com" }), "j3");
        expect(queue.of("complete_job").map(call => call.params)).toEqual([
            ["j1", "t1", "issue:9", 9, "https://github.com/o/r/issues/9"], ["j2", "t2", "email:op", null, null], ["j3", "t3", "email:rc", null, null],
        ]);
        expect(errorLog).not.toHaveBeenCalled();
    });
    it("fails and retries jobs independently: an email failure does not block the issue", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const queue = fakeSql(threeJobs);
        const provider = providers({ operatorEmail: vi.fn().mockResolvedValue({ ok: false, code: "http_5xx", retryable: true }) });
        const summary = await runDelivery({ sql: queue.sql, provider });
        expect(summary).toMatchObject({ delivered: 2, retried: 1, dead: 0 });
        expect(queue.of("complete_job").map(call => call.params[0])).toEqual(["j1", "j3"]);
        expect(queue.of("fail_job").map(call => call.params)).toEqual([["j2", "t2", "http_5xx", true]]);
    });
    it("counts dead-lettered failures when the database reports the final attempt", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const queue = fakeSql(threeJobs.slice(0, 1), { failStatus: "dead" });
        const provider = providers({ githubIssue: vi.fn().mockResolvedValue({ ok: false, code: "auth", retryable: false }) });
        expect(await runDelivery({ sql: queue.sql, provider })).toMatchObject({ delivered: 0, retried: 0, dead: 1 });
        expect(queue.of("fail_job")[0].params).toEqual(["j1", "t1", "auth", false]);
    });
    it("converts an unexpected provider exception into a retryable failure without leaking it", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const queue = fakeSql(threeJobs.slice(0, 1));
        const provider = providers({ githubIssue: vi.fn().mockRejectedValue(new Error("boom reader@example.com secret-token")) });
        const summary = await runDelivery({ sql: queue.sql, provider });
        expect(summary.retried).toBe(1);
        expect(queue.of("fail_job")[0].params).toEqual(["j1", "t1", "unknown", true]);
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/reader@example|secret-token|boom/);
    });
    it("dead-letters a job whose lease payload is gone without calling any provider", async () => {
        const queue = fakeSql(threeJobs.slice(0, 1), { payloadMissing: ["j1"] });
        const provider = providers();
        expect(await runDelivery({ sql: queue.sql, provider })).toMatchObject({ claimed: 1, delivered: 0, dead: 1 });
        expect(provider.githubIssue).not.toHaveBeenCalled();
        expect(queue.of("fail_job")[0].params).toEqual(["j1", "t1", "payload_missing", false]);
    });
    it("does nothing when no job is due", async () => {
        const queue = fakeSql([]);
        const provider = providers();
        expect(await runDelivery({ sql: queue.sql, provider })).toEqual({ claimed: 0, delivered: 0, retried: 0, dead: 0, purged: false });
        expect(provider.githubIssue).not.toHaveBeenCalled();
    });
    it("claims a bounded batch", async () => {
        const queue = fakeSql([]);
        await runDelivery({ sql: queue.sql, provider: providers() });
        await runDelivery({ sql: queue.sql, provider: providers(), batch: 3 });
        expect(queue.of("claim_jobs").map(call => call.params)).toEqual([[5], [3]]);
    });
    it("stops starting new jobs after the time budget and leaves them leased for recovery", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        let clock = 0;
        const queue = fakeSql(threeJobs);
        const provider = providers({ githubIssue: vi.fn(async () => { clock += 50_000; return { ok: true as const, providerRef: "issue:1" }; }) });
        const summary = await runDelivery({ sql: queue.sql, provider, now: () => clock, budgetMs: 40_000 });
        expect(summary.delivered).toBe(1);
        expect(provider.operatorEmail).not.toHaveBeenCalled();
        expect(provider.contactReceipt).not.toHaveBeenCalled();
    });
    it("purges expired data only when retention is explicitly enabled", async () => {
        const off = fakeSql([]);
        expect((await runDelivery({ sql: off.sql, provider: providers() })).purged).toBe(false);
        expect(off.of("purge_expired")).toHaveLength(0);
        const on = fakeSql([]);
        expect((await runDelivery({ sql: on.sql, provider: providers(), retentionEnabled: true })).purged).toBe(true);
        expect(on.of("purge_expired")).toHaveLength(1);
    });
    it("propagates a database outage so the route can answer 503", async () => {
        const sql: SupportSql = { query: vi.fn().mockRejectedValue(new Error("db down")) };
        await expect(runDelivery({ sql, provider: providers() })).rejects.toThrow("db down");
    });
});

describe("worker authorization", () => {
    const dependency = vi.fn<() => DeliveryDependency>();
    const request = (authorization?: string) => new Request("https://iworkhere.space/api/support/deliver", { headers: authorization ? { authorization } : {} });
    it.each([[undefined], ["Bearer wrong-secret"], ["bearer cron-secret"], ["Bearer cron-secre"], ["Bearer cron-secret-extra"], ["cron-secret"]])("rejects %j without doing any work", async authorization => {
        vi.stubEnv("CRON_SECRET", "cron-secret");
        dependency.mockClear();
        const response = await handleDeliveryRequest(request(authorization), dependency);
        expect(response.status).toBe(401);
        expect(dependency).not.toHaveBeenCalled();
    });
    it("never authorizes when the secret is unset or empty", async () => {
        for (const secret of [undefined, ""]) {
            vi.stubEnv("CRON_SECRET", secret);
            expect(authorizedCronRequest(request("Bearer "))).toBe(false);
            expect(authorizedCronRequest(request("Bearer undefined"))).toBe(false);
            expect(authorizedCronRequest(request(undefined))).toBe(false);
        }
        expect(dependency).not.toHaveBeenCalled();
    });
    it("runs the delivery for the correct secret and reports counts only", async () => {
        vi.stubEnv("CRON_SECRET", "cron-secret");
        const queue = fakeSql(threeJobs.slice(0, 1));
        const response = await handleDeliveryRequest(request("Bearer cron-secret"), () => ({ sql: queue.sql, provider: providers() }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ claimed: 1, delivered: 1, retried: 0, dead: 0, purged: false });
    });
    it("answers 503 with an empty body when the database or worker credential is unavailable", async () => {
        vi.stubEnv("CRON_SECRET", "cron-secret");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const response = await handleDeliveryRequest(request("Bearer cron-secret"), () => { throw new Error("postgres://user:pw@host/db"); });
        expect(response.status).toBe(503);
        expect(await response.text()).toBe("");
        expect(JSON.stringify(log.mock.calls)).not.toContain("postgres://");
    });
});
