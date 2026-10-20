import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportRequest } from "./contract";
import { postReport } from "./submission.client";

const request: ReportRequest = {
    schemaVersion: 1, category: "other", area: "site-wide", pathname: "/", description: "d", contactConsent: false,
    idempotencyKey: "5f1f2b0e-9a3c-4b8a-8d1e-0a1b2c3d4e5f", turnstileToken: "t",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const receipt = { schemaVersion: 1, reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" };
afterEach(() => vi.unstubAllGlobals());

describe("postReport", () => {
    it("posts JSON to the same-origin endpoint without credentials, referrer or caching", async () => {
        const fetcher = vi.fn().mockResolvedValue(json(201, receipt));
        await postReport(request, fetcher);
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("/api/support/report");
        expect(init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", headers: { "Content-Type": "application/json" } });
        expect(JSON.parse(init.body)).toEqual(request);
    });
    it("returns a receipt only for a 201 with a well-formed durable receipt", async () => {
        expect(await postReport(request, vi.fn().mockResolvedValue(json(201, receipt)))).toEqual({ kind: "receipt", receipt });
        for (const body of [null, {}, { ...receipt, reportId: "bad" }, { ...receipt, schemaVersion: 2 }, { ...receipt, receivedAt: 5 }, "text"]) {
            expect(await postReport(request, vi.fn().mockResolvedValue(json(201, body)))).toEqual({ kind: "failure", failure: "unexpected" });
        }
        expect(await postReport(request, vi.fn().mockResolvedValue(new Response("<html>", { status: 201 })))).toEqual({ kind: "failure", failure: "unexpected" });
    });
    it("never reports success for a non-201 status, even with a receipt-shaped body", async () => {
        for (const status of [200, 202, 301, 500]) {
            const outcome = await postReport(request, vi.fn().mockResolvedValue(json(status, receipt)));
            expect(outcome.kind, String(status)).toBe("failure");
        }
    });
    it.each([
        [400, { error: "invalid_request", fieldError: { description: "required" } }, "invalid"],
        [409, { error: "idempotency_conflict" }, "conflict"],
        [413, { error: "payload_too_large" }, "too_large"],
        [429, { error: "rate_limited" }, "rate_limited"],
        [429, { error: "challenge_failed" }, "challenge_failed"],
        [403, { error: "forbidden_origin" }, "unexpected"],
        [503, { error: "unavailable" }, "unavailable"],
    ])("maps HTTP %i %j to %s", async (status, body, failure) => {
        const outcome = await postReport(request, vi.fn().mockResolvedValue(json(status, body)));
        expect(outcome).toMatchObject({ kind: "failure", failure });
    });
    it("carries field errors for validation failures and tolerates a missing or odd body", async () => {
        expect(await postReport(request, vi.fn().mockResolvedValue(json(400, { fieldError: { email: "invalid" } })))).toEqual({ kind: "failure", failure: "invalid", fieldError: { email: "invalid" } });
        expect(await postReport(request, vi.fn().mockResolvedValue(new Response("", { status: 400 })))).toEqual({ kind: "failure", failure: "invalid", fieldError: undefined });
        expect(await postReport(request, vi.fn().mockResolvedValue(new Response("", { status: 503 })))).toEqual({ kind: "failure", failure: "unavailable" });
    });
    it("reports offline versus network failures truthfully", async () => {
        vi.stubGlobal("navigator", { onLine: false });
        expect(await postReport(request, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toEqual({ kind: "failure", failure: "offline" });
        vi.stubGlobal("navigator", { onLine: true });
        expect(await postReport(request, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toEqual({ kind: "failure", failure: "network" });
    });
});
