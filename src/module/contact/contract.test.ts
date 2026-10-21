import { describe, expect, it } from "vitest";
import { CONTACT_LIMIT, parseContactRequest, validateContactFields } from "./contract";

const valid = { senderEmail: "visitor@example.com", title: "A question", message: "Hello, I have a question." };

describe("validateContactFields", () => {
    it("trims every field and accepts a valid request", () => {
        const result = validateContactFields({ senderEmail: "  visitor@example.com ", title: "  A question  ", message: "\n  Hello, I have a question.  \n" });
        expect(result).toEqual({ ok: true, value: valid });
    });

    it("requires every field, reporting whitespace-only values as missing", () => {
        const result = validateContactFields({ senderEmail: "   ", title: "", message: "\n\t " });
        expect(result).toEqual({ ok: false, problem: { senderEmail: "required", title: "required", message: "required" } });
    });

    it.each(["visitor", "visitor@", "@example.com", "visitor@example", "a b@example.com", "a@@example.com"])("rejects the email %j", senderEmail => {
        expect(validateContactFields({ ...valid, senderEmail })).toEqual({ ok: false, problem: { senderEmail: "invalid" } });
    });

    it("rejects an email over 254 characters and one carrying control characters", () => {
        expect(validateContactFields({ ...valid, senderEmail: `${"a".repeat(250)}@example.com` })).toEqual({ ok: false, problem: { senderEmail: "invalid" } });
        expect(validateContactFields({ ...valid, senderEmail: "visitor@exa\u0007mple.com" })).toEqual({ ok: false, problem: { senderEmail: "invalid" } });
    });

    it("limits the title to 200 characters and rejects line breaks that could alter a mail header", () => {
        expect(validateContactFields({ ...valid, title: "t".repeat(CONTACT_LIMIT.titleLength) }).ok).toBe(true);
        expect(validateContactFields({ ...valid, title: "t".repeat(CONTACT_LIMIT.titleLength + 1) })).toEqual({ ok: false, problem: { title: "too_long" } });
        expect(validateContactFields({ ...valid, title: "Subject\r\nBcc: someone@example.com" })).toEqual({ ok: false, problem: { title: "invalid" } });
    });

    it("limits the message to 10-10,000 characters and allows ordinary whitespace", () => {
        expect(validateContactFields({ ...valid, message: "123456789" })).toEqual({ ok: false, problem: { message: "too_short" } });
        expect(validateContactFields({ ...valid, message: "1234567890" }).ok).toBe(true);
        expect(validateContactFields({ ...valid, message: "m".repeat(CONTACT_LIMIT.messageMax) }).ok).toBe(true);
        expect(validateContactFields({ ...valid, message: "m".repeat(CONTACT_LIMIT.messageMax + 1) })).toEqual({ ok: false, problem: { message: "too_long" } });
        expect(validateContactFields({ ...valid, message: "Line one\r\n\tLine two, indented" }).ok).toBe(true);
        expect(validateContactFields({ ...valid, message: "Hello\u0000there, friend" })).toEqual({ ok: false, problem: { message: "invalid" } });
    });
});

describe("parseContactRequest", () => {
    it("accepts the three fields with or without an empty honeypot", () => {
        expect(parseContactRequest(valid)).toEqual({ kind: "valid", value: valid });
        expect(parseContactRequest({ ...valid, companyWebsite: "" })).toEqual({ kind: "valid", value: valid });
        expect(parseContactRequest({ ...valid, companyWebsite: "   " })).toEqual({ kind: "valid", value: valid });
    });

    it.each([null, "text", 7, true, [], [valid]])("rejects a body that is not an object: %j", body => {
        expect(parseContactRequest(body)).toEqual({ kind: "invalid_request" });
    });

    it("rejects unexpected fields, including prototype-style keys", () => {
        expect(parseContactRequest({ ...valid, extra: "x" })).toEqual({ kind: "invalid_request" });
        expect(parseContactRequest(JSON.parse('{"senderEmail":"visitor@example.com","title":"t","message":"1234567890","__proto__x":1}'))).toEqual({ kind: "invalid_request" });
        expect(parseContactRequest({ ...valid, cc: "other@example.com" })).toEqual({ kind: "invalid_request" });
    });

    it("rejects non-string field values", () => {
        for (const field of ["senderEmail", "title", "message", "companyWebsite"]) {
            expect(parseContactRequest({ ...valid, [field]: 5 }), field).toEqual({ kind: "invalid_request" });
            expect(parseContactRequest({ ...valid, [field]: ["a"] }), field).toEqual({ kind: "invalid_request" });
        }
    });

    it("recognizes a filled honeypot before field validation, so a bot learns nothing", () => {
        expect(parseContactRequest({ senderEmail: "", title: "", message: "", companyWebsite: "http://spam.example" })).toEqual({ kind: "honeypot" });
        expect(parseContactRequest({ ...valid, companyWebsite: "x" })).toEqual({ kind: "honeypot" });
    });

    it("reports the first invalid field in form order", () => {
        expect(parseContactRequest({ senderEmail: "nope", title: "", message: "" })).toEqual({ kind: "invalid_field", field: "senderEmail", problem: "invalid" });
        expect(parseContactRequest({ ...valid, title: "" })).toEqual({ kind: "invalid_field", field: "title", problem: "required" });
        expect(parseContactRequest({ ...valid, message: "short" })).toEqual({ kind: "invalid_field", field: "message", problem: "too_short" });
        expect(parseContactRequest({})).toEqual({ kind: "invalid_field", field: "senderEmail", problem: "required" });
    });
});
