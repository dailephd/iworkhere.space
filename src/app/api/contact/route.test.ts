import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, dynamic, maxDuration, runtime } from "./route";

const { send, ResendMock } = vi.hoisted(() => {
    const send = vi.fn();
    return { send, ResendMock: vi.fn(function ResendMock() { return { emails: { send } }; }) };
});
vi.mock("resend", () => ({ Resend: ResendMock }));

const URL_ = "https://iworkhere.space/api/contact";
const body = (overrides: Record<string, unknown> = {}) => ({ senderEmail: "visitor@example.com", title: "A question", message: "Hello, I have a question.", companyWebsite: "", ...overrides });
const same = { "Content-Type": "application/json", Origin: "https://iworkhere.space", Host: "iworkhere.space" };
const request = (payload: unknown, headers: Record<string, string> = same) =>
    new Request(URL_, { method: "POST", headers, body: typeof payload === "string" ? payload : JSON.stringify(payload) });

function configure() {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_not_real");
    vi.stubEnv("CONTACT_TO_EMAIL", "operator-inbox@example.invalid");
    vi.stubEnv("CONTACT_FROM_EMAIL", "contact@mail.example.invalid");
}

beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    ResendMock.mockClear();
    configure();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function expectSafeError(response: Response, status: number, error: string) {
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const json = await response.json();
    expect(json).toMatchObject({ ok: false, error });
    const text = JSON.stringify(json);
    for (const secret of ["re_test_key_not_real", "operator-inbox@example.invalid", "contact@mail.example.invalid", "visitor@example.com", "RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) expect(text).not.toContain(secret);
    expect(send).not.toHaveBeenCalled();
}

describe("POST /api/contact", () => {
    it("is a dynamic Node.js route", () => {
        expect(runtime).toBe("nodejs");
        expect(dynamic).toBe("force-dynamic");
        expect(maxDuration).toBeGreaterThan(0);
    });

    it("sends one email through the Resend SDK and answers { ok: true } when the provider accepts", async () => {
        const response = await POST(request(body()));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
        expect(ResendMock).toHaveBeenCalledExactlyOnceWith("re_test_key_not_real");
        expect(send).toHaveBeenCalledTimes(1);
        const message = send.mock.calls[0][0];
        expect(message).toMatchObject({
            from: "iworkhere.space <contact@mail.example.invalid>",
            to: ["operator-inbox@example.invalid"],
            replyTo: "visitor@example.com",
            subject: "[iworkhere.space contact] A question",
        });
        expect(message.text).toContain("Hello, I have a question.");
        expect(message.text).toContain("Source: iworkhere.space contact form");
    });

    it("trims fields before sending", async () => {
        await POST(request(body({ senderEmail: "  visitor@example.com  ", title: "  A question  ", message: "  Hello, I have a question.  " })));
        expect(send.mock.calls[0][0]).toMatchObject({ replyTo: "visitor@example.com", subject: "[iworkhere.space contact] A question" });
    });

    it("accepts a request without the honeypot key", async () => {
        const { companyWebsite, ...rest } = body();
        void companyWebsite;
        expect((await POST(request(rest))).status).toBe(200);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("answers a filled honeypot with the normal success shape and sends nothing", async () => {
        const response = await POST(request(body({ companyWebsite: "http://spam.example" })));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
        expect(send).not.toHaveBeenCalled();
        expect(ResendMock).not.toHaveBeenCalled();
    });

    it("suppresses the honeypot even when the other fields are invalid", async () => {
        const response = await POST(request({ senderEmail: "", title: "", message: "", companyWebsite: "x" }));
        expect(await response.json()).toEqual({ ok: true });
        expect(send).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
        await expectSafeError(await POST(request("{nope")), 400, "invalid_request");
    });

    it("rejects an incorrect content type", async () => {
        await expectSafeError(await POST(request(body(), { ...same, "Content-Type": "text/plain" })), 400, "invalid_request");
        await expectSafeError(await POST(request("senderEmail=a", { ...same, "Content-Type": "application/x-www-form-urlencoded" })), 400, "invalid_request");
    });

    it.each([[null], ["string"], [[]], [5]])("rejects a JSON body that is not an object: %j", async value => {
        await expectSafeError(await POST(request(JSON.stringify(value))), 400, "invalid_request");
    });

    it("rejects unexpected fields", async () => {
        await expectSafeError(await POST(request(body({ cc: "other@example.com" }))), 400, "invalid_request");
        await expectSafeError(await POST(request(body({ toolId: "merge-pdf" }))), 400, "invalid_request");
    });

    it.each([
        ["senderEmail", { senderEmail: "" }],
        ["senderEmail", { senderEmail: "not-an-email" }],
        ["title", { title: "   " }],
        ["title", { title: "t".repeat(201) }],
        ["title", { title: "line\nbreak" }],
        ["message", { message: "short" }],
        ["message", { message: "m".repeat(10_001) }],
    ])("names the invalid %s field without echoing its value", async (field, override) => {
        const response = await POST(request(body(override)));
        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json).toEqual({ ok: false, error: "invalid_field", field });
        expect(send).not.toHaveBeenCalled();
    });

    it("rejects a field of the wrong type", async () => {
        await expectSafeError(await POST(request(body({ message: 12345678901 }))), 400, "invalid_request");
    });

    it("rejects an oversized body with 413, by declared length and by streamed length", async () => {
        const big = JSON.stringify(body({ message: "m".repeat(70_000) }));
        await expectSafeError(await POST(request(big, { ...same, "Content-Length": String(big.length) })), 413, "too_large");
        await expectSafeError(await POST(request(big)), 413, "too_large");
    });

    it("rejects a missing Origin with 403", async () => {
        await expectSafeError(await POST(request(body(), { "Content-Type": "application/json", Host: "iworkhere.space" })), 403, "forbidden");
    });

    it("rejects a foreign Origin and cross-site fetch metadata with 403", async () => {
        await expectSafeError(await POST(request(body(), { ...same, Origin: "https://evil.example" })), 403, "forbidden");
        await expectSafeError(await POST(request(body(), { ...same, "Sec-Fetch-Site": "cross-site" })), 403, "forbidden");
    });

    it("checks the Origin before reading the body", async () => {
        const big = JSON.stringify(body({ message: "m".repeat(70_000) }));
        await expectSafeError(await POST(request(big, { "Content-Type": "application/json", Origin: "https://evil.example", Host: "iworkhere.space" })), 403, "forbidden");
    });

    it.each(["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"])("fails closed with a generic 503 when %s is missing", async name => {
        vi.stubEnv(name, "");
        await expectSafeError(await POST(request(body())), 503, "unavailable");
        expect(ResendMock).not.toHaveBeenCalled();
    });

    it("never reports success when the provider returns an error", async () => {
        send.mockResolvedValue({ data: null, error: { name: "invalid_from_address", message: "The contact@mail.example.invalid domain is not verified" } });
        const response = await POST(request(body()));
        expect(response.status).toBe(502);
        const json = await response.json();
        expect(json).toEqual({ ok: false, error: "delivery_failed" });
        expect(JSON.stringify(json)).not.toContain("verified");
        expect(JSON.stringify(json)).not.toContain("mail.example.invalid");
    });

    it("never reports success when the provider throws", async () => {
        send.mockRejectedValue(new Error("ECONNRESET sending for visitor@example.com"));
        const response = await POST(request(body()));
        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ ok: false, error: "delivery_failed" });
    });

    it("writes nothing to the console for success, provider failure or configuration failure", async () => {
        const spies = (["log", "info", "warn", "error", "debug"] as const).map(name => vi.spyOn(console, name).mockImplementation(() => {}));
        await POST(request(body()));
        send.mockResolvedValue({ data: null, error: { message: "Hello, I have a question." } });
        await POST(request(body()));
        vi.stubEnv("RESEND_API_KEY", "");
        await POST(request(body()));
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });

    it("does not touch the support report system or any network", async () => {
        const fetcher = vi.fn();
        vi.stubGlobal("fetch", fetcher);
        await POST(request(body()));
        expect(fetcher).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
