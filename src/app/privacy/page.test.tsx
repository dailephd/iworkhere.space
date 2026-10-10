import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

describe("public privacy policy", () => {
    it("uses the canonical page metadata and a semantic heading hierarchy", () => {
        expect(metadata.title).toBe("Privacy Policy — iworkhere.space");
        expect(metadata.description).toContain("diagnostics");
        expect(metadata.alternates).toEqual({ canonical: "https://iworkhere.space/privacy" });
        const html = renderToStaticMarkup(<PrivacyPage />);
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain(">Privacy Policy</h1>");
        expect(html.match(/<h2\b/g)).toHaveLength(6);
        expect(html).not.toContain("<h3");
    });

    it("discloses conditional advertising cookies, prior visits, personalization and choices", () => {
        const html = renderToStaticMarkup(<PrivacyPage />);
        for (const text of ["currently disabled", "Third-party vendors, including Google", "advertising cookies", "prior visits", "personalize ads", "does not itself collect consent", "Google-certified"]) expect(html).toContain(text);
        expect(html).toContain('href="https://adssettings.google.com/"');
        expect(html).toContain('href="https://www.aboutads.info/"');
    });

    it("describes the bounded telemetry, diagnostic, storage and URL-sharing contracts", () => {
        const html = renderToStaticMarkup(<PrivacyPage />);
        for (const text of ["/api/metric", "/api/log", "user-agent", "stack traces", "Neon", "90 days", "30 days", "indefinitely", "Vercel Web Analytics", "query strings and fragments", "including IP addresses", "recently used tool names", "calculator", "URL query parameters", "unaggregated records"]) expect(html).toContain(text);
        expect(html).not.toContain("No data is collected");
        expect(html).not.toContain("IP addresses are never processed");
    });
});
