import { describe, expect, it } from "vitest";
import { REPORT_CATEGORY, SUPPORT_LIMIT, type ReportRequest } from "./contract";
import type { SupportContextSource } from "./context";
import { codePointLength, normalizeText, parseReportRequest } from "./validation";

const source: SupportContextSource = {
    tool: [{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }, { id: "calculator", slug: "calculator", name: "Calculator" }],
    category: ["document", "math"],
};
const KEY = "5f1f2b0e-9a3c-4b8a-8d1e-0a1b2c3d4e5f";
function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const base: ReportRequest = {
        schemaVersion: 1, category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf",
        description: "The merged file is empty.", contactConsent: false, idempotencyKey: KEY, turnstileToken: "token-value",
    };
    return { ...base, ...overrides };
}
function failing(overrides: Record<string, unknown>) {
    const result = parseReportRequest(request(overrides), source);
    if (result.ok) throw new Error("expected validation to fail");
    return result.fieldError;
}

describe("exact-field contract", () => {
    it("accepts the baseline and separates the challenge token from the report", () => {
        const result = parseReportRequest(request(), source);
        expect(result).toMatchObject({ ok: true, idempotencyKey: KEY, turnstileToken: "token-value" });
        if (result.ok) {
            expect(result.report).toEqual({ category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf", description: "The merged file is empty.", expected: null, observed: null, email: null, contactConsent: false });
            expect(JSON.stringify(result.report)).not.toContain("token-value");
        }
    });
    it.each([null, [], "text", 7])("rejects a non-object body %j", body => {
        expect(parseReportRequest(body, source)).toEqual({ ok: false, fieldError: { request: "invalid" } });
    });
    it("rejects unknown top-level fields, including file-like and tracking fields", () => {
        expect(failing({ filename: "private.pdf" })).toEqual({ filename: "unknown_field" });
        expect(failing({ screenshot: "data:image/png;base64,AAAA", userAgent: "x" })).toEqual({ screenshot: "unknown_field", userAgent: "unknown_field" });
    });
    it.each(["schemaVersion", "category", "area", "pathname", "description", "contactConsent", "idempotencyKey", "turnstileToken"])("requires %s", key => {
        const body = request(); delete body[key];
        const result = parseReportRequest(body, source);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.fieldError[key]).toBe("required");
    });
    it("rejects an unsupported schema version and an invalid category", () => {
        expect(failing({ schemaVersion: 2 })).toEqual({ schemaVersion: "invalid" });
        expect(failing({ category: "spam" })).toEqual({ category: "invalid" });
    });
});

describe("tool identity and pathname", () => {
    it("accepts every registered tool and Site-wide or Other without a tool id", () => {
        expect(parseReportRequest(request({ toolId: "calculator", pathname: "/tool/calculator" }), source).ok).toBe(true);
        expect(parseReportRequest(request({ area: "site-wide", toolId: undefined, pathname: "/" }), source).ok).toBe(true);
        expect(parseReportRequest(request({ area: "other", toolId: undefined, pathname: "/discover" }), source).ok).toBe(true);
    });
    it("allows a user-corrected tool different from the page", () => {
        expect(parseReportRequest(request({ toolId: "calculator", pathname: "/tool/merge-pdf" }), source).ok).toBe(true);
    });
    it("never accepts an unregistered or missing tool for the tool area", () => {
        expect(failing({ toolId: "made-up-tool" })).toEqual({ toolId: "invalid" });
        expect(failing({ toolId: undefined })).toEqual({ toolId: "required" });
        expect(failing({ toolId: 7 })).toEqual({ toolId: "invalid" });
    });
    it("rejects a tool id on a non-tool area", () => {
        expect(failing({ area: "site-wide", toolId: "merge-pdf", pathname: "/" })).toEqual({ toolId: "invalid" });
    });
    it.each(["/tool/merge-pdf?x=1", "/tool/merge-pdf#frag", "//evil.example", "/tool/unknown", "/a/b", "https://example.com/", "", "/tool/merge-pdf/", `/${"a".repeat(300)}`])("rejects pathname %j", pathname => {
        expect(failing({ pathname })).toEqual({ pathname: "invalid" });
    });
    it("accepts allowlisted category pages", () => {
        expect(parseReportRequest(request({ area: "site-wide", toolId: undefined, pathname: "/category/document" }), source).ok).toBe(true);
        expect(failing({ area: "site-wide", toolId: undefined, pathname: "/category/unknown" })).toEqual({ pathname: "invalid" });
    });
});

describe("text bounds in Unicode code points", () => {
    it("accepts exactly the maximum and rejects one more for each narrative field", () => {
        expect(parseReportRequest(request({ description: "a".repeat(SUPPORT_LIMIT.description) }), source).ok).toBe(true);
        expect(failing({ description: "a".repeat(SUPPORT_LIMIT.description + 1) })).toEqual({ description: "too_long" });
        expect(parseReportRequest(request({ expected: "e".repeat(SUPPORT_LIMIT.expected), observed: "o".repeat(SUPPORT_LIMIT.observed) }), source).ok).toBe(true);
        expect(failing({ expected: "e".repeat(SUPPORT_LIMIT.expected + 1) })).toEqual({ expected: "too_long" });
        expect(failing({ observed: "o".repeat(SUPPORT_LIMIT.observed + 1) })).toEqual({ observed: "too_long" });
    });
    it("counts an astral character as one code point", () => {
        expect(codePointLength("😀")).toBe(1);
        expect(parseReportRequest(request({ description: "😀".repeat(SUPPORT_LIMIT.description) }), source).ok).toBe(true);
        expect(failing({ description: "😀".repeat(SUPPORT_LIMIT.description + 1) })).toEqual({ description: "too_long" });
    });
    it("normalizes to NFC, unifies line endings and trims", () => {
        const result = parseReportRequest(request({ description: "  café\r\nline  " }), source);
        expect(result.ok && result.report.description).toBe("café\nline");
    });
    it("requires a non-blank description and rejects control and malformed characters", () => {
        expect(failing({ description: "   " })).toEqual({ description: "required" });
        expect(failing({ description: "bad\u0000text" })).toEqual({ description: "invalid" });
        expect(failing({ description: "bell\u0007" })).toEqual({ description: "invalid" });
        expect(failing({ description: "lone\ud800surrogate" })).toEqual({ description: "invalid" });
        expect(failing({ description: 42 })).toEqual({ description: "invalid" });
        expect(normalizeText("tab\tallowed\nnewline", 100)).toEqual({ value: "tab\tallowed\nnewline" });
    });
});

describe("category-specific rules", () => {
    it.each(REPORT_CATEGORY)("accepts category %s with a minimal body", category => {
        const expected = category === "incorrect_result" ? "10" : undefined;
        expect(parseReportRequest(request({ category, expected }), source).ok).toBe(true);
    });
    it("requires expected behavior only for incorrect_result", () => {
        expect(failing({ category: "incorrect_result" })).toEqual({ expected: "required" });
        expect(failing({ category: "incorrect_result", expected: "   " })).toEqual({ expected: "required" });
        expect(parseReportRequest(request({ category: "tool_failure" }), source).ok).toBe(true);
        expect(parseReportRequest(request({ category: "suggestion", expected: "Add a dark mode", observed: "For night use" }), source).ok).toBe(true);
    });
    it("treats blank optional text as absent", () => {
        const result = parseReportRequest(request({ expected: "", observed: "  " }), source);
        expect(result.ok && result.report.expected).toBeNull();
        expect(result.ok && result.report.observed).toBeNull();
    });
});

describe("contact email and consent", () => {
    it("defaults to no contact: a missing email with no consent is valid", () => {
        const result = parseReportRequest(request(), source);
        expect(result.ok && result.report.email).toBeNull();
    });
    it("keeps a valid lower-cased email only with consent", () => {
        const result = parseReportRequest(request({ email: "  Reader@Example.COM ", contactConsent: true }), source);
        expect(result.ok && result.report.email).toBe("reader@example.com");
        expect(result.ok && result.report.contactConsent).toBe(true);
    });
    it("discards an address supplied without consent and never validates it", () => {
        const result = parseReportRequest(request({ email: "not an email", contactConsent: false }), source);
        expect(result.ok && result.report.email).toBeNull();
    });
    it("requires an address when consent is given and rejects malformed or oversize addresses", () => {
        expect(failing({ contactConsent: true })).toEqual({ email: "required" });
        expect(failing({ contactConsent: true, email: "nobody" })).toEqual({ email: "invalid" });
        expect(failing({ contactConsent: true, email: "a b@example.com" })).toEqual({ email: "invalid" });
        expect(failing({ contactConsent: true, email: `${"a".repeat(250)}@b.co` })).toEqual({ email: "too_long" });
        const boundary = `${"a".repeat(SUPPORT_LIMIT.email - 5)}@b.co`;
        expect(boundary).toHaveLength(SUPPORT_LIMIT.email);
        expect(parseReportRequest(request({ contactConsent: true, email: boundary }), source).ok).toBe(true);
    });
    it("rejects a non-boolean consent", () => {
        expect(failing({ contactConsent: "yes" })).toEqual({ contactConsent: "invalid" });
    });
});

describe("idempotency key and challenge token", () => {
    it.each(["", "not-a-uuid", "5F1F2B0E-9A3C-4B8A-8D1E-0A1B2C3D4E5F", "5f1f2b0e-9a3c-1b8a-8d1e-0a1b2c3d4e5f"])("rejects key %j", idempotencyKey => {
        expect(failing({ idempotencyKey })).toEqual({ idempotencyKey: "invalid" });
    });
    it("bounds the challenge token", () => {
        expect(failing({ turnstileToken: "" })).toEqual({ turnstileToken: "required" });
        expect(failing({ turnstileToken: "t".repeat(SUPPORT_LIMIT.token + 1) })).toEqual({ turnstileToken: "too_long" });
        expect(parseReportRequest(request({ turnstileToken: "t".repeat(SUPPORT_LIMIT.token) }), source).ok).toBe(true);
    });
});

describe("unselected form controls", () => {
    it("reports an empty category or area as required rather than invalid", () => {
        expect(failing({ category: "" })).toEqual({ category: "required" });
        expect(failing({ area: "", toolId: undefined })).toEqual({ area: "required" });
    });
});
