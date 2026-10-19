import { describe, expect, it, vi } from "vitest";
import { createPrivateIssue, issueBody, issueMarker, type GithubConfig } from "./github.server";
import type { DeliveryPayload } from "./provider.server";

const payload: DeliveryPayload = {
    reportId: "SR-0123456789ABCDEF", kind: "github_issue", category: "tool_failure", area: "tool", toolId: "merge-pdf",
    pathname: "/tool/merge-pdf", receivedAt: "2026-10-19T12:00:00.000Z", contactEmail: null,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

interface FakeIssue { number: number; html_url: string; body: string; pull_request?: unknown }
/** Stateful GitHub double: optional create timeout after the issue was actually created. */
function fakeGithub(options: { isPrivate?: boolean; existing?: FakeIssue[]; timeoutAfterCreate?: boolean; status?: Partial<Record<"repo" | "list" | "create", number>> } = {}) {
    const issues: FakeIssue[] = [...(options.existing ?? [])];
    const calls: Array<{ method: string; path: string; body?: string }> = [];
    let timeoutOnce = options.timeoutAfterCreate ?? false;
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        calls.push({ method, path: url.pathname + url.search, body: init?.body as string | undefined });
        if (url.pathname === "/repos/owner/private-support" && method === "GET") return options.status?.repo ? json({}, options.status.repo) : json({ private: options.isPrivate ?? true });
        if (url.pathname === "/repos/owner/private-support/issues" && method === "GET") return options.status?.list ? json([], options.status.list) : json(issues.slice((Number(url.searchParams.get("page")) - 1) * 100, Number(url.searchParams.get("page")) * 100));
        if (url.pathname === "/repos/owner/private-support/issues" && method === "POST") {
            if (options.status?.create) return json({}, options.status.create);
            const number = issues.length + 1;
            issues.push({ number, html_url: `https://github.com/owner/private-support/issues/${number}`, body: JSON.parse(init!.body as string).body });
            if (timeoutOnce) { timeoutOnce = false; throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" }); }
            return json(issues[issues.length - 1], 201);
        }
        return json({}, 404);
    });
    const config: GithubConfig = { token: "gh-token", repository: "owner/private-support", apiUrl: "https://api.github.test", dashboardBase: "https://dash.example.com", fetch: fetcher as unknown as typeof fetch };
    return { fetcher, calls, issues, config };
}
const creates = (calls: Array<{ method: string }>) => calls.filter(call => call.method === "POST").length;

describe("private issue creation", () => {
    it("creates one issue containing only reference, category, area, route, time and dashboard link", async () => {
        const github = fakeGithub();
        const result = await createPrivateIssue(payload, github.config);
        expect(result).toEqual({ ok: true, providerRef: "issue:1", issueNumber: 1, issueUrl: "https://github.com/owner/private-support/issues/1" });
        const created = JSON.parse(github.calls.find(call => call.method === "POST")!.body!);
        expect(created.title).toBe("[Support] SR-0123456789ABCDEF tool_failure");
        expect(created.body).toBe(issueBody(payload, "https://dash.example.com"));
        expect(created.body).toContain("Triage: https://dash.example.com/support/SR-0123456789ABCDEF");
        expect(created.body).toContain(issueMarker(payload.reportId));
        expect(Object.keys(created).sort()).toEqual(["body", "labels", "title"]);
    });
    it("sends the token only as an authorization header", async () => {
        const github = fakeGithub();
        await createPrivateIssue(payload, github.config);
        for (const [, init] of github.fetcher.mock.calls) {
            expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer gh-token");
            expect(String(init!.body ?? "")).not.toContain("gh-token");
        }
        expect(github.calls.map(call => call.path).join(" ")).not.toContain("gh-token");
    });
    it("reconciles an existing issue instead of creating a duplicate", async () => {
        const github = fakeGithub({ existing: [{ number: 41, html_url: "https://github.com/owner/private-support/issues/41", body: `Report\n${issueMarker(payload.reportId)}` }] });
        const result = await createPrivateIssue(payload, github.config);
        expect(result).toMatchObject({ ok: true, issueNumber: 41 });
        expect(creates(github.calls)).toBe(0);
    });
    it("does not open a second issue after a timeout that actually created the first", async () => {
        const github = fakeGithub({ timeoutAfterCreate: true });
        const first = await createPrivateIssue(payload, github.config);
        expect(first).toEqual({ ok: false, code: "timeout", retryable: true });
        expect(github.issues).toHaveLength(1);
        const second = await createPrivateIssue(payload, github.config);
        expect(second).toMatchObject({ ok: true, issueNumber: 1 });
        expect(github.issues).toHaveLength(1);
        expect(creates(github.calls)).toBe(1);
    });
    it("ignores pull requests and other reports' markers, including prefix lookalikes", async () => {
        const github = fakeGithub({ existing: [
            { number: 1, html_url: "https://github.com/owner/private-support/issues/1", body: issueMarker("SR-0123456789ABCDEG") },
            { number: 2, html_url: "https://github.com/owner/private-support/pull/2", body: issueMarker(payload.reportId), pull_request: {} },
            { number: 3, html_url: "https://github.com/owner/private-support/issues/3", body: "no marker here" },
        ] });
        const result = await createPrivateIssue(payload, github.config);
        expect(result).toMatchObject({ ok: true, issueNumber: 4 });
        expect(creates(github.calls)).toBe(1);
    });
    it("scans additional pages before deciding to create", async () => {
        const filler = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, html_url: `https://github.com/owner/private-support/issues/${index + 1}`, body: "other" }));
        const target = { number: 101, html_url: "https://github.com/owner/private-support/issues/101", body: issueMarker(payload.reportId) };
        const github = fakeGithub({ existing: [...filler, target] });
        expect(await createPrivateIssue(payload, github.config)).toMatchObject({ ok: true, issueNumber: 101 });
        expect(github.calls.filter(call => call.path.includes("page="))).toHaveLength(2);
        expect(creates(github.calls)).toBe(0);
    });
});

describe("fail-closed configuration", () => {
    it("refuses a public repository and never creates", async () => {
        const github = fakeGithub({ isPrivate: false });
        expect(await createPrivateIssue(payload, github.config)).toEqual({ ok: false, code: "not_private", retryable: true });
        expect(creates(github.calls)).toBe(0);
    });
    it.each(["dailephd/iworkhere.space", "DailePhD/IWorkHere.Space"])("refuses the public application repository %s without any request", async repository => {
        const github = fakeGithub();
        expect(await createPrivateIssue(payload, { ...github.config, repository })).toMatchObject({ ok: false, code: "not_private" });
        expect(github.fetcher).not.toHaveBeenCalled();
    });
    it.each([{ token: undefined }, { token: "" }, { repository: undefined }, { repository: "not a repo" }])("is misconfigured for %j without any request", async override => {
        const github = fakeGithub();
        expect(await createPrivateIssue(payload, { ...github.config, ...override })).toEqual({ ok: false, code: "misconfigured", retryable: true });
        expect(github.fetcher).not.toHaveBeenCalled();
    });
    it("shows an explicit placeholder when the dashboard link is unconfigured or insecure", () => {
        expect(issueBody(payload, undefined)).toContain("Triage: dashboard link not configured");
        expect(issueBody(payload, "http://dash.example.com")).toContain("Triage: dashboard link not configured");
    });
});

describe("provider failures", () => {
    it.each([
        [{ repo: 401 }, "auth", true], [{ repo: 403 }, "auth", true], [{ list: 429 }, "rate_limited", true], [{ list: 500 }, "http_5xx", true],
        [{ create: 422 }, "http_4xx", false], [{ create: 503 }, "http_5xx", true], [{ create: 408 }, "timeout", true],
    ] as const)("classifies %j as %s", async (status, code, retryable) => {
        expect(await createPrivateIssue(payload, fakeGithub({ status }).config)).toEqual({ ok: false, code, retryable });
    });
    it("classifies network failures", async () => {
        const github = fakeGithub();
        const config = { ...github.config, fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof fetch };
        expect(await createPrivateIssue(payload, config)).toEqual({ ok: false, code: "network", retryable: true });
    });
    it("rejects an issue response with an unexpected URL", async () => {
        const github = fakeGithub();
        const config = { ...github.config, fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
            if (init?.method === "POST") return json({ number: 5, html_url: "https://evil.example/x" }, 201);
            return github.fetcher(input, init);
        }) as unknown as typeof fetch };
        expect(await createPrivateIssue(payload, config)).toMatchObject({ ok: false, code: "unknown" });
    });
});
