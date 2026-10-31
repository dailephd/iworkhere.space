import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Footer } from "./Footer";

const REPORT = "Report Issues — report a problem or suggestion";

it("preserves the copyright and exposes keyboard-accessible About, Contact Us and Privacy Policy links", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain("© 2026 iworkhere.space created by dailephd LLC");
    expect(html.match(/href="\/privacy"/g)).toHaveLength(1);
    expect(html.match(/href="\/contact"/g)).toHaveLength(1);
    expect(html.match(/href="\/about"/g)).toHaveLength(1);
    expect(html).toContain(">About</a>");
    expect(html).toContain(">Contact Us</a>");
    expect(html).toContain(">Privacy Policy</a>");
    expect(html).toContain("focus-visible:outline");
    expect(html).not.toContain("tabindex=\"-1\"");
});

it("renders the actions in the order About, Contact Us, report action, Privacy Policy inside one group", () => {
    const html = renderToStaticMarkup(<Footer action={<button type="button">{REPORT}</button>} />);
    expect(html.match(/data-footer-actions/g)).toHaveLength(1);
    expect(html.match(/Report Issues/g)).toHaveLength(1);
    const about = html.indexOf(">About</a>");
    const contact = html.indexOf("Contact Us");
    const report = html.indexOf(REPORT);
    const privacy = html.indexOf("Privacy Policy");
    expect(about).toBeGreaterThan(html.indexOf("data-footer-actions"));
    expect(about).toBeLessThan(contact);
    expect(contact).toBeLessThan(report);
    expect(report).toBeLessThan(privacy);
    expect(html.indexOf("data-footer-actions")).toBeLessThan(contact);
    // The group is a horizontal row (not a column), and the copyright stays outside it.
    expect(html).toMatch(/data-footer-actions[^>]*class="[^"]*flex flex-wrap/);
    expect(html).not.toMatch(/data-footer-actions[^>]*class="[^"]*flex-col/);
    expect(html.indexOf("© 2026")).toBeLessThan(html.indexOf("data-footer-actions"));
});

it("omits the report row without leaving a dead action when none is supplied", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Report");
    expect(html.indexOf(">About</a>")).toBeLessThan(html.indexOf("Contact Us"));
    expect(html.indexOf("Contact Us")).toBeLessThan(html.indexOf("Privacy Policy"));
});

it("gives Contact Us and Privacy Policy quiet styling with no permanent underline and a visible focus ring", () => {
    const html = renderToStaticMarkup(<Footer />);
    for (const label of ["About", "Contact Us", "Privacy Policy"]) {
        const anchor = html.match(new RegExp(`<a [^>]*>\s*${label}\s*</a>`))![0];
        expect(anchor).not.toMatch(/(^|[\s"])underline(\s|")/);
        expect(anchor).toContain("hover:underline");
        expect(anchor).toContain("focus-visible:outline-2");
        expect(anchor).toContain("focus-visible:outline-[var(--focus-ring)]");
        expect(anchor).not.toContain("data-footer-detail");
    }
});

it("renders all footer details normally without collapse-specific markers", () => {
    const html = renderToStaticMarkup(<Footer action={<button type="button" data-testid="report">{REPORT}</button>} />);
    expect(html).not.toContain("data-footer-detail");
    expect(html).toMatch(/<button[^>]*data-testid="report"/);
    expect(html).not.toMatch(/<button[^>]*data-footer-detail/);
});

it("renders one footer-owned region without a second semantic footer", () => {
    expect(renderToStaticMarkup(<Footer />)).not.toContain("<footer");
});
