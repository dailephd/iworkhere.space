import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_LIMIT } from "./contract";
import type { SupportContextSource } from "./context";
import { handleReportRequest, type SubmissionDependency } from "./submission.server";

const source: SupportContextSource = { tool: [{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }], category: ["document"] };
const KEY = "5f1f2b0e-9a3c-4b8a-8d1e-0a1b2c3d4e5f";
const SENTINEL = "SENTINEL-narrative-private-text";
const body = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 1, category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf", description: SENTINEL,
    contactConsent: false, idempotencyKey: KEY, turnstileToken: "secret-challenge-token", ...overrides,
});
function post(payload: unknown, headers: Record<string, string> = {}, raw?: string): Request {
    return new Request("https://iworkhere.space/api/support/report", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: raw ?? JSON.stringify(payload),
    });
}
function dependency(overrides: Partial<SubmissionDependency> = {}): SubmissionDependency & { submit: ReturnType<typeof vi.fn>; challenge: ReturnType<typeof vi.fn> } {
    return {
        source,
        challenge: vi.fn().mockResolvedValue("ok"),
        submit: vi.fn().mockResolvedValue({ kind: "created", reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" }),
        ...overrides,
    } as SubmissionDependency & { submit: ReturnType<typeof vi.fn>; challenge: ReturnType<typeof vi.fn> };
}
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorLog = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("successful intake", () => {
    it("returns 201 with only the versioned receipt and no-store caching", async () => {
        const dep = dependency();
        const response = await handleReportRequest(post(body()), dep);
        expect(response.status).toBe(201);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toEqual({ schemaVersion: 1, reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" });
        expect(dep.submit).toHaveBeenCalledTimes(1);
        expect(dep.challenge).toHaveBeenCalledWith("secret-challenge-token");
    });
    it("hands persistence the normalized report and the idempotency key, never the challenge token", async () => {
        const dep = dependency();
        await handleReportRequest(post(body({ email: "A@B.CO", contactConsent: true })), dep);
        const [report, key] = dep.submit.mock.calls[0];
        expect(key).toBe(KEY);
        expect(report).toMatchObject({ email: "a@b.co", contactConsent: true, description: SENTINEL });
        expect(JSON.stringify(dep.submit.mock.calls)).not.toContain("secret-challenge-token");
    });
    it("returns the original receipt for a replayed key", async () => {
        const dep = dependency({ submit: vi.fn().mockResolvedValue({ kind: "replayed", reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" }) });
        const response = await handleReportRequest(post(body()), dep);
        expect(response.status).toBe(201);
        expect((await response.json()).reportId).toBe("SR-0123456789ABCDEF");
    });
});

describe("request rejection", () => {
    it("rejects cross-site requests before reading the body", async () => {
        const dep = dependency();
        for (const headers of [{ "sec-fetch-site": "cross-site" }, { origin: "https://evil.example" }] as Array<Record<string, string>>) {
            const response = await handleReportRequest(post(body(), headers), dep);
            expect(response.status).toBe(403);
            expect(await response.json()).toEqual({ error: "forbidden_origin" });
        }
        expect(dep.challenge).not.toHaveBeenCalled();
    });
    it("compares the origin host with the addressed or forwarded host, not the derived request URL", async () => {
        const dep = dependency();
        const via = (headers: Record<string, string>) => handleReportRequest(post(body(), headers), dep);
        expect((await via({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" })).status).toBe(201);
        expect((await via({ origin: "https://iworkhere.space", "x-forwarded-host": "iworkhere.space, proxy.internal", host: "internal:3000" })).status).toBe(201);
        expect((await via({ origin: "https://evil.example", host: "iworkhere.space" })).status).toBe(403);
        expect((await via({ origin: "not a url", host: "iworkhere.space" })).status).toBe(403);
        expect((await via({ origin: "https://iworkhere.space.evil.example", host: "iworkhere.space" })).status).toBe(403);
    });
    it("accepts same-origin browser headers", async () => {
        const response = await handleReportRequest(post(body(), { "sec-fetch-site": "same-origin", origin: "https://iworkhere.space" }), dependency());
        expect(response.status).toBe(201);
    });
    it("rejects a declared or streamed body above 16 KiB with 413", async () => {
        const dep = dependency();
        const declared = await handleReportRequest(post(body(), { "content-length": String(SUPPORT_LIMIT.bodyBytes + 1) }), dep);
        expect(declared.status).toBe(413);
        const streamed = await handleReportRequest(post(null, {}, JSON.stringify(body({ description: "x".repeat(SUPPORT_LIMIT.bodyBytes) }))), dep);
        expect(streamed.status).toBe(413);
        expect(await streamed.json()).toEqual({ error: "payload_too_large" });
        expect(dep.submit).not.toHaveBeenCalled();
    });
    it("accepts a body of exactly 16 KiB and rejects one byte more", async () => {
        const json = JSON.stringify(body());
        const exact = json + " ".repeat(SUPPORT_LIMIT.bodyBytes - new TextEncoder().encode(json).length);
        expect(new TextEncoder().encode(exact).length).toBe(SUPPORT_LIMIT.bodyBytes);
        expect((await handleReportRequest(post(null, {}, exact), dependency())).status).toBe(201);
        expect((await handleReportRequest(post(null, {}, exact + " "), dependency())).status).toBe(413);
    });
    it.each([
        ["malformed JSON", "{"],
        ["an empty body", ""],
        ["a JSON scalar", "7"],
    ])("rejects %s with 400", async (_label, raw) => {
        const response = await handleReportRequest(post(null, {}, raw), dependency());
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("invalid_request");
    });
    it("requires a JSON content type", async () => {
        const request = new Request("https://iworkhere.space/api/support/report", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body()) });
        expect((await handleReportRequest(request, dependency())).status).toBe(400);
    });
    it("returns field codes only, never echoing submitted values", async () => {
        const response = await handleReportRequest(post(body({ category: "nope", filename: "private.pdf", description: SENTINEL })), dependency());
        const text = await response.text();
        expect(response.status).toBe(400);
        expect(JSON.parse(text)).toEqual({ error: "invalid_request", fieldError: { filename: "unknown_field", category: "invalid" } });
        expect(text).not.toContain(SENTINEL);
        expect(text).not.toContain("private.pdf");
    });
    it("does not verify the challenge or persist an invalid request", async () => {
        const dep = dependency();
        await handleReportRequest(post(body({ toolId: "unregistered" })), dep);
        expect(dep.challenge).not.toHaveBeenCalled();
        expect(dep.submit).not.toHaveBeenCalled();
    });
});

describe("abuse controls", () => {
    it("treats a rejected challenge as bot abuse with 429 and never persists", async () => {
        const dep = dependency({ challenge: vi.fn().mockResolvedValue("rejected") });
        const response = await handleReportRequest(post(body()), dep);
        expect(response.status).toBe(429);
        expect(await response.json()).toEqual({ error: "challenge_failed" });
        expect(dep.submit).not.toHaveBeenCalled();
    });
    it("fails closed with 503 when the challenge provider or secret is unavailable", async () => {
        const dep = dependency({ challenge: vi.fn().mockResolvedValue("unavailable") });
        const response = await handleReportRequest(post(body()), dep);
        expect(response.status).toBe(503);
        expect(dep.submit).not.toHaveBeenCalled();
    });
    it("maps the intake ceiling to 429 and a key reused with different content to 409", async () => {
        const limited = await handleReportRequest(post(body()), dependency({ submit: vi.fn().mockResolvedValue({ kind: "rate_limited" }) }));
        expect(limited.status).toBe(429);
        expect(await limited.json()).toEqual({ error: "rate_limited" });
        const conflict = await handleReportRequest(post(body()), dependency({ submit: vi.fn().mockResolvedValue({ kind: "conflict" }) }));
        expect(conflict.status).toBe(409);
    });
});

describe("persistence failure", () => {
    it("returns a safe 503 with no report id and no raw diagnostics anywhere", async () => {
        const dep = dependency({ submit: vi.fn().mockRejectedValue(new Error(`relation "support.report" does not exist; SELECT secret FROM x; ${SENTINEL}`)) });
        const response = await handleReportRequest(post(body({ email: "reader@example.com", contactConsent: true })), dep);
        const text = await response.text();
        expect(response.status).toBe(503);
        expect(JSON.parse(text)).toEqual({ error: "unavailable" });
        const logged = JSON.stringify(errorLog.mock.calls);
        for (const secret of [SENTINEL, "reader@example.com", "secret-challenge-token", "support.report", "SELECT"]) {
            expect(text).not.toContain(secret);
            expect(logged).not.toContain(secret);
        }
        expect(JSON.parse(errorLog.mock.calls[0][0] as string)).toEqual({ source: "support-operation", operation: "intake", status: "failed", code: "unavailable" });
    });
});
