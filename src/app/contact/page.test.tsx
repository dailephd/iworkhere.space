import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactPage, { metadata } from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("contact page", () => {
    const html = renderToStaticMarkup(<ContactPage />);

    it("uses the canonical page metadata", () => {
        expect(metadata.title).toBe("Contact Us - iworkhere");
        expect(metadata.alternates).toEqual({ canonical: "https://iworkhere.space/contact" });
        expect(metadata.openGraph).toMatchObject({ url: "https://iworkhere.space/contact" });
        expect(typeof metadata.description).toBe("string");
    });

    it("has exactly one H1, Contact Us, and the form in a labelled section", () => {
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain(">Contact Us</h1>");
        expect(html).toContain('aria-labelledby="contact-form-heading"');
        expect(html.match(/<form\b/g)).toHaveLength(1);
        expect(html).toContain('aria-label="Contact form"');
        expect(html).toContain(">Submit</button>");
        expect(html).toContain(">Clear message</button>");
    });

    it("explains the channel and separates it from optional issue reporting without a dead link", () => {
        // Reporting is off by default here, so the page must not send visitors to an invisible footer control (AUD-033).
        for (const text of ["Resend", "site operator", "use the form below and name the tool", "requires JavaScript", "do not promise a reply"]) expect(html).toContain(text);
        expect(html).not.toContain("Report Issues");
        expect(html).not.toContain("separate system");
        expect(html).not.toContain('href="#report"');
        // The only buttons are the form's own Submit and Clear message; there is no report trigger.
        expect(html.match(/<button\b/g)).toHaveLength(2);
        expect(html).not.toContain("aria-haspopup");
        expect(html).not.toContain("Report a problem or suggestion");
    });

    it("names the footer Report Issues control only when issue reporting is enabled, and keeps the form either way", () => {
        vi.stubEnv("NEXT_PUBLIC_SUPPORT_ENABLED", "true");
        const enabled = renderToStaticMarkup(<ContactPage />);
        vi.stubEnv("NEXT_PUBLIC_SUPPORT_ENABLED", "false");
        const disabled = renderToStaticMarkup(<ContactPage />);
        expect(enabled).toContain("Report Issues control in the footer");
        expect(enabled).toContain("separate system");
        expect(disabled).not.toContain("Report Issues");
        expect(disabled).toContain("use the form below and name the tool");
        for (const markup of [enabled, disabled]) {
            expect(markup).toContain("<form");
            expect(markup.match(/<button\b/g)).toHaveLength(2);
        }
    });

    it("links to the Privacy Policy and the About page, and discloses no address", () => {
        expect(html).toContain('href="/privacy"');
        expect(html).toContain('href="/about"');
        expect(html).not.toMatch(/mailto:/);
        expect(html).not.toMatch(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
        expect(html).not.toMatch(/Advertisement|adsbygoogle/);
    });

    it("never posts visitor text to a URL when the form is submitted without JavaScript", () => {
        const form = html.match(/<form\b[^>]*>/)![0];
        expect(form).toContain('method="post"');
        expect(form).toContain('action="/api/contact"');
        const inputs = html.match(/<(input|textarea)\b[^>]*>/g)!;
        expect(inputs.length).toBeGreaterThanOrEqual(4);
        for (const input of inputs) expect(input, input).not.toMatch(/\bname="/);
    });
});
