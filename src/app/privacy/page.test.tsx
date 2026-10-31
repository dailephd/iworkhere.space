import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

describe("public privacy policy", () => {
    it("uses the canonical page metadata and a semantic heading hierarchy", () => {
        expect(metadata.title).toBe("Privacy Policy - iworkhere");
        expect(metadata.description).toContain("diagnostics");
        expect(metadata.alternates).toEqual({ canonical: "https://iworkhere.space/privacy" });
        const html = renderToStaticMarkup(<PrivacyPage />);
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain(">Privacy Policy</h1>");
        expect(html.match(/<h2\b/g)).toHaveLength(8);
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

    it("discloses voluntary problem reports, their separation, providers and pending retention", () => {
        const html = renderToStaticMarkup(<PrivacyPage />);
        for (const text of ["Problem reports and suggestions", "voluntary report", "tick the box", "We do not ask for files, screenshots, tool inputs or results", "not to the measurement and diagnostic services", "stored separately in our Neon database", "private tracker entry in GitHub", "Resend", "Cloudflare Turnstile", "180 days", "90 days after our last correspondence", "not yet a completed deletion practice"]) expect(html).toContain(text);
        expect(html).toContain('href="https://www.cloudflare.com/privacypolicy/"');
        expect(html).toContain('href="https://resend.com/legal/privacy-policy"');
    });
    it("discloses Contact Us as a voluntary, non-anonymous email path separate from reports and telemetry", () => {
        const html = renderToStaticMarkup(<PrivacyPage />);
        for (const text of ["Contact Us messages", "email address, a title and your message", "not anonymous", "Resend, an email delivery provider", "operator’s email inbox", "reply address", "not stored in the problem-report database", "not opened as GitHub issues", "not sent to our analytics or logs", "the message you write leaves your device", "have not set a deletion schedule", "retention targets for problem reports do not apply", "cannot guarantee deletion"]) expect(html).toContain(text);
    });
    it("discloses that the offline cache excludes query-bearing requests and no longer claims URL parameters are cached", () => {
        const html = renderToStaticMarkup(<PrivacyPage />);
        expect(html).toContain("Last updated: October 27, 2026");
        expect(html).toContain("only page addresses without URL parameters");
        expect(html).toContain("excludes requests that include query strings");
        expect(html).not.toContain("cached page addresses can include URL parameters");
        expect(html).toContain("URLs may be kept in browser history, sent when a page is requested, or disclosed when you share a link");
    });
});
describe("privacy in-page navigation (AUD-034)", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    const nav = html.match(/<nav aria-label="On this page"[\s\S]*?<\/nav>/)![0];
    const target = [...nav.matchAll(/href="#([^"]+)"/g)].map((one) => one[1]);

    it("lists every H2 section once, in page order, in a labelled navigation landmark", () => {
        const heading = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([^<]+)<\/h2>/g)].map((one) => ({ id: one[1], title: one[2] }));
        expect(heading).toHaveLength(8);
        expect(target).toEqual(heading.map((one) => one.id));
        expect(new Set(target).size).toBe(target.length);
        for (const one of heading) expect(nav).toContain(`>${one.title}</a>`);
        expect(html.match(/<nav\b/g)).toHaveLength(1);
    });

    it("gives every target a stable id, fixed-header clearance and focusability, and keeps all policy paragraphs and links", () => {
        for (const id of target) {
            expect(html.match(new RegExp(`id="${id}"`, "g")), id).toHaveLength(1);
            const open = html.match(new RegExp(`<h2 id="${id}"[^>]*>`))![0];
            expect(open).toContain('tabindex="-1"');
            expect(open).toContain("scroll-mt-24");
        }
        expect(html).toContain("Last updated: October 27, 2026");
        expect(html.match(/<section\b/g)).toHaveLength(8);
        expect(html.match(/<p\b/g)!.length).toBe(25 + 1); // 25 original policy paragraphs at HEAD plus the "On this page" label
        for (const url of ["https://www.cloudflare.com/privacypolicy/", "https://resend.com/legal/privacy-policy", "https://vercel.com/legal/privacy-policy", "https://neon.com/privacy-policy", "https://adssettings.google.com/", "https://www.aboutads.info/"]) expect(html).toContain(`href="${url}"`);
    });
});