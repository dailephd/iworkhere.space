import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContactEmail, defaultContactEmailConfig, escapeHtml, sendContactEmail, type ContactEmailClient, type ContactEmailConfig, type ContactEmailMessage } from "./sendContactEmail.server";

const config: ContactEmailConfig = {
    apiKey: "re_test_key_not_real",
    to: "operator-inbox@example.invalid",
    from: "contact@mail.example.invalid",
    fromName: "iworkhere.space",
    subjectPrefix: "[iworkhere.space contact]",
};
const payload = { senderEmail: "visitor@example.com", title: "A question", message: "Hello, I have a question." };
const NOW = new Date("2026-10-21T12:34:56.000Z");

function client(result: { error: unknown } | Error) {
    const send = vi.fn<(message: ContactEmailMessage) => Promise<{ error: unknown }>>(async () => {
        if (result instanceof Error) throw result;
        return result;
    });
    const createClient = vi.fn((apiKey: string): ContactEmailClient => { void apiKey; return { emails: { send } }; });
    return { send, createClient };
}

afterEach(() => vi.restoreAllMocks());

describe("defaultContactEmailConfig", () => {
    it("reads the server-side variables and applies safe defaults for the optional ones", () => {
        expect(defaultContactEmailConfig({ RESEND_API_KEY: " key ", CONTACT_TO_EMAIL: "to@example.invalid", CONTACT_FROM_EMAIL: "from@example.invalid" })).toEqual({
            apiKey: "key", to: "to@example.invalid", from: "from@example.invalid", fromName: "iworkhere.space", subjectPrefix: "[iworkhere.space contact]",
        });
        expect(defaultContactEmailConfig({ CONTACT_FROM_NAME: "Site", CONTACT_SUBJECT_PREFIX: "[c]" })).toMatchObject({ fromName: "Site", subjectPrefix: "[c]" });
    });

    it("treats empty and blank values as missing, and never invents a recipient", () => {
        const empty = defaultContactEmailConfig({ RESEND_API_KEY: "", CONTACT_TO_EMAIL: "  ", CONTACT_FROM_EMAIL: "" });
        expect(empty.apiKey).toBeUndefined();
        expect(empty.to).toBeUndefined();
        expect(empty.from).toBeUndefined();
    });
});

describe("buildContactEmail", () => {
    const message = buildContactEmail(payload, { from: config.from!, to: config.to!, fromName: config.fromName, subjectPrefix: config.subjectPrefix }, NOW);

    it("sends from the verified sender to the operator with the visitor as Reply-To", () => {
        expect(message.from).toBe("iworkhere.space <contact@mail.example.invalid>");
        expect(message.to).toEqual(["operator-inbox@example.invalid"]);
        expect(message.replyTo).toBe("visitor@example.com");
        expect(message.from).not.toContain("visitor@example.com");
    });

    it("prefixes the subject with the configured prefix and the validated title", () => {
        expect(message.subject).toBe("[iworkhere.space contact] A question");
    });

    it("carries email, title, message, timestamp and the iworkhere.space source in a plain-text body", () => {
        expect(message.text).toBe([
            "From: visitor@example.com",
            "Subject: A question",
            "Sent: 2026-10-21T12:34:56.000Z",
            "Source: iworkhere.space contact form",
            "",
            "Hello, I have a question.",
        ].join("\n"));
        expect(message.text).not.toContain("dailephd.com");
    });

    it("mirrors the same facts in HTML", () => {
        for (const text of ["visitor@example.com", "A question", "2026-10-21T12:34:56.000Z", "iworkhere.space contact form", "Hello, I have a question."]) expect(message.html).toContain(text);
        expect(message.html).not.toContain("dailephd.com");
    });

    it("escapes every visitor-authored value in the HTML body and leaves the text body verbatim", () => {
        const hostile = { senderEmail: "a\"b'<i>@example.com", title: "<script>alert(1)</script> & more", message: "<img src=x onerror=alert(1)>\n\"quoted\" & 'single'" };
        const built = buildContactEmail(hostile, { from: config.from!, to: config.to!, fromName: config.fromName, subjectPrefix: config.subjectPrefix }, NOW);
        expect(built.html).not.toContain("<script>");
        expect(built.html).not.toContain("<img");
        expect(built.html).not.toContain("<i>");
        expect(built.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more");
        expect(built.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(built.html).toContain("&quot;quoted&quot; &amp; &#39;single&#39;");
        expect(built.text).toContain("<img src=x onerror=alert(1)>");
    });
});

describe("escapeHtml", () => {
    it("escapes the five significant characters, ampersand first", () => {
        expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
        expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    });
});

describe("sendContactEmail", () => {
    it("calls the Resend client once with the API key and the built message when the provider accepts", async () => {
        const { send, createClient } = client({ error: null });
        const result = await sendContactEmail(payload, { config, createClient, now: () => NOW });
        expect(result).toEqual({ ok: true });
        expect(createClient).toHaveBeenCalledExactlyOnceWith("re_test_key_not_real");
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toMatchObject({ from: "iworkhere.space <contact@mail.example.invalid>", to: ["operator-inbox@example.invalid"], replyTo: "visitor@example.com", subject: "[iworkhere.space contact] A question" });
    });

    it.each([
        ["API key", { apiKey: undefined }],
        ["sender", { from: undefined }],
        ["recipient", { to: undefined }],
    ])("fails closed without calling the provider when the %s is missing", async (_name, override) => {
        const { send, createClient } = client({ error: null });
        const result = await sendContactEmail(payload, { config: { ...config, ...override }, createClient });
        expect(result).toEqual({ ok: false, reason: "not_configured" });
        expect(createClient).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it("reports a provider error object as a failure, never as success", async () => {
        const { send, createClient } = client({ error: { name: "validation_error", message: "visitor@example.com is not allowed" } });
        const result = await sendContactEmail(payload, { config, createClient });
        expect(result).toEqual({ ok: false, reason: "provider_error" });
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("reports a thrown provider exception as a failure without leaking it", async () => {
        const { createClient } = client(new Error("socket hang up for visitor@example.com"));
        const result = await sendContactEmail(payload, { config, createClient });
        expect(result).toEqual({ ok: false, reason: "provider_error" });
        expect(JSON.stringify(result)).not.toContain("visitor@example.com");
    });

    it("reports a provider that never answers as a failure after the timeout", async () => {
        const createClient = (): ContactEmailClient => ({ emails: { send: () => new Promise(() => {}) } });
        expect(await sendContactEmail(payload, { config, createClient, timeoutMs: 20 })).toEqual({ ok: false, reason: "provider_error" });
    });

    it("keeps visitor content and configuration out of all diagnostics", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        await sendContactEmail(payload, { config, createClient: client({ error: { message: "Hello, I have a question." } }).createClient });
        await sendContactEmail(payload, { config, createClient: client(new Error("boom visitor@example.com")).createClient });
        await sendContactEmail(payload, { config: { ...config, apiKey: undefined } });
        for (const spy of [log, warn, error, info]) expect(spy).not.toHaveBeenCalled();
    });
});
