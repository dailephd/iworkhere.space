import { describe, expect, it, vi } from "vitest";
import type { DeliveryPayload } from "./provider.server";
import { operatorMessage, receiptMessage, sendContactReceipt, sendOperatorEmail, type ResendConfig } from "./resend.server";

const payload: DeliveryPayload = {
    reportId: "SR-0123456789ABCDEF", kind: "operator_email", category: "privacy_security", area: "tool", toolId: "merge-pdf",
    pathname: "/tool/merge-pdf", receivedAt: "2026-10-19T12:00:00.000Z", contactEmail: null,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function config(fetcher: ReturnType<typeof vi.fn>, override: Partial<ResendConfig> = {}): ResendConfig {
    return { apiKey: "re_key", from: "Support <support@iworkhere.space>", operator: "ops@iworkhere.space", apiUrl: "https://resend.test", dashboardBase: "https://dash.example.com", fetch: fetcher as unknown as typeof fetch, ...override };
}

describe("operator notification", () => {
    it("contains the reference, category and secure triage link only", async () => {
        const fetcher = vi.fn().mockResolvedValue(json({ id: "abc123" }));
        const result = await sendOperatorEmail(payload, "job-1", config(fetcher));
        expect(result).toEqual({ ok: true, providerRef: "email:abc123" });
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("https://resend.test/emails");
        const body = JSON.parse(init.body);
        expect(body.to).toEqual(["ops@iworkhere.space"]);
        expect(body.from).toBe("Support <support@iworkhere.space>");
        expect(body.text).toContain("SR-0123456789ABCDEF");
        expect(body.text).toContain("privacy_security");
        expect(body.text).toContain("https://dash.example.com/support/SR-0123456789ABCDEF");
        expect(body.text).not.toContain("/tool/merge-pdf");
        expect(Object.keys(body).sort()).toEqual(["from", "subject", "text", "to"]);
    });
    it("uses the job id as the provider idempotency key and sends the key only as a header", async () => {
        const fetcher = vi.fn().mockResolvedValue(json({ id: "abc123" }));
        await sendOperatorEmail(payload, "job-42", config(fetcher));
        const init = fetcher.mock.calls[0][1];
        expect(init.headers["Idempotency-Key"]).toBe("support-job-42");
        expect(init.headers.Authorization).toBe("Bearer re_key");
        expect(init.body).not.toContain("re_key");
    });
    it("is built from reference, category and link only", () => {
        const message = operatorMessage({ ...payload, contactEmail: "private@example.com" }, "https://dash.example.com");
        expect(JSON.stringify(message)).not.toContain("private@example.com");
        expect(message.subject).toBe("[iworkhere.space] Support report SR-0123456789ABCDEF");
    });
});

describe("contact receipt", () => {
    const receipt: DeliveryPayload = { ...payload, kind: "contact_receipt", contactEmail: "reader@example.com" };
    it("goes only to the consenting contact and carries a reference with generic text", async () => {
        const fetcher = vi.fn().mockResolvedValue(json({ id: "r1" }));
        expect(await sendContactReceipt(receipt, "job-2", config(fetcher))).toEqual({ ok: true, providerRef: "email:r1" });
        const body = JSON.parse(fetcher.mock.calls[0][1].body);
        expect(body.to).toEqual(["reader@example.com"]);
        expect(body.text).toContain("SR-0123456789ABCDEF");
        expect(body.text).not.toMatch(/privacy_security|merge-pdf|dash\.example/);
        expect(receiptMessage(receipt).subject).toContain("SR-0123456789ABCDEF");
    });
    it("cannot be sent without a recipient", async () => {
        const fetcher = vi.fn();
        expect(await sendContactReceipt({ ...receipt, contactEmail: null }, "job-3", config(fetcher))).toEqual({ ok: false, code: "misconfigured", retryable: true });
        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe("fail-closed configuration and provider failures", () => {
    it.each([{ apiKey: undefined }, { apiKey: "" }, { from: undefined }, { operator: undefined }])("is misconfigured for %j without a request", async override => {
        const fetcher = vi.fn();
        expect(await sendOperatorEmail(payload, "job", config(fetcher, override))).toEqual({ ok: false, code: "misconfigured", retryable: true });
        expect(fetcher).not.toHaveBeenCalled();
    });
    it.each([[401, "auth", true], [429, "rate_limited", true], [500, "http_5xx", true], [422, "http_4xx", false]] as const)("classifies HTTP %i as %s", async (status, code, retryable) => {
        const fetcher = vi.fn().mockResolvedValue(json({ message: "provider detail with private@example.com" }, status));
        expect(await sendOperatorEmail(payload, "job", config(fetcher))).toEqual({ ok: false, code, retryable });
    });
    it("classifies network failures and unexpected success bodies without storing provider payloads", async () => {
        expect(await sendOperatorEmail(payload, "job", config(vi.fn().mockRejectedValue(new TypeError("fetch failed"))))).toEqual({ ok: false, code: "network", retryable: true });
        expect(await sendOperatorEmail(payload, "job", config(vi.fn().mockResolvedValue(json({}))))).toMatchObject({ ok: false, code: "unknown" });
        const timeout = Object.assign(new Error("timeout"), { name: "TimeoutError" });
        expect(await sendOperatorEmail(payload, "job", config(vi.fn().mockRejectedValue(timeout)))).toEqual({ ok: false, code: "timeout", retryable: true });
    });
});
