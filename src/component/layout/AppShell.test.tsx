import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import { ThemeProvider } from "@/component/common/ThemeProvider";


vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("AppShell", () => {
    it("omits absent banner regions and preserves the main landmark and skip target", () => {
        const html = renderToStaticMarkup(
            createElement(ThemeProvider, null, createElement(AppShell, null, createElement("h1", null, "Workspace"))),
        );
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html).not.toContain("Header banner");
        expect(html).not.toContain("Left advertising area");
        expect(html).not.toContain("Right advertising area");
        expect(html).not.toContain("border-b border-border bg-surface-alt px-5 py-2 sm:px-6");
        expect(html).toContain("lg:grid-cols-[minmax(0,1fr)]");
        expect(html).toContain('href="#main-content"');
        expect(html).toContain('id="main-content"');
        expect(html).toContain("Skip to main content");
        expect(html).toContain("© 2026 iworkhere.space created by dailephd LLC");
        expect(html).toContain('href="/privacy"');
        expect(html).not.toContain("MainScroll");
        expect(html.indexOf("Workspace")).toBeLessThan(
            html.indexOf("© 2026 iworkhere.space created by dailephd LLC"),
        );
    });

    it("renders supplied banner regions and adapts the desktop grid", () => {
        const html = renderToStaticMarkup(
            <ThemeProvider><AppShell
                headerBannerSlot={<span>Header slot content</span>}
                leftBannerSlot={<span>Left slot content</span>}
                rightBannerSlot={<span>Right slot content</span>}
                navItem={[{ id: "discover", label: "All tools", href: "/discover" }]}
            >
                <h1>Workspace</h1>
            </AppShell></ThemeProvider>,
        );

        expect(html).toContain("Header slot content");
        expect(html).toContain("border-b border-border bg-surface-alt px-5 py-2 sm:px-6");
        expect(html).toContain('aria-label="Left advertising area"');
        expect(html).toContain("Left slot content");
        expect(html).toContain('aria-label="Right advertising area"');
        expect(html).toContain("Right slot content");
        expect(html).toContain("xl:grid-cols-[112px_minmax(0,1fr)_176px]");
        expect(html).toContain("py-4 xl:block");
        expect(html).toContain('aria-label="Primary navigation"');
        expect(html).toContain('href="/discover"');
    });

    it("places the footer action slot inside the single footer landmark and keeps every other region unchanged", () => {
        const html = renderToStaticMarkup(
            <ThemeProvider><AppShell footerActionSlot={<button type="button">Footer action</button>}><h1>Workspace</h1></AppShell></ThemeProvider>,
        );
        expect(html.match(/<footer\b/g)).toHaveLength(1);
        expect(html.match(/<main\b/g)).toHaveLength(1);
        const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
        expect(footer).toContain("Footer action");
        expect(footer).toContain('href="/privacy"');
        expect(footer).toContain('href="/contact"');
        expect(footer).not.toContain("Hide footer");
        expect(footer).not.toContain("Show footer");
        expect(footer).not.toContain("data-footer-toggle");
        expect(html.indexOf("Footer action")).toBeGreaterThan(html.indexOf("Workspace"));
        expect(html).toContain("Skip to main content");
        expect(html).not.toContain("Left advertising area");
    });

    it("renders no action when the slot is absent", () => {
        const html = renderToStaticMarkup(<ThemeProvider><AppShell><h1>Workspace</h1></AppShell></ThemeProvider>);
        expect(html).not.toContain("Footer action");
        expect(html).not.toContain("Report a problem or suggestion");
    });

    it("renders one header landmark and one primary navigation around the viewport control", () => {
        const html = renderToStaticMarkup(
            <ThemeProvider><AppShell navItem={[{ id: "discover", label: "All tools", href: "/discover" }]}><h1>Workspace</h1></AppShell></ThemeProvider>,
        );
        expect(html.match(/<header\b/g)).toHaveLength(1);
        expect(html.match(/<nav\b/g)).toHaveLength(1);
        expect(html).not.toContain("Show navigation");
        expect(html).not.toContain("Hide navigation");
        expect(html).toContain("data-site-header");
    });

    it("keeps the footer banner in document flow before the single ordinary-flow footer", () => {
        const html = renderToStaticMarkup(
            <ThemeProvider><AppShell footerBannerSlot={<span>Footer slot content</span>} footerActionSlot={<button type="button">Footer action</button>}><h1>Workspace</h1></AppShell></ThemeProvider>,
        );
        expect(html.match(/<footer\b/g)).toHaveLength(1);
        const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
        expect(footer).not.toContain("Footer slot content");
        expect(footer).not.toMatch(/fixed|sticky/);
        expect(footer).toContain("Footer action");
        const banner = html.slice(html.indexOf("border-t border-border bg-surface-alt px-5 py-3"), html.indexOf("Footer slot content"));
        expect(banner).not.toContain("fixed");
        expect(html.indexOf("Workspace")).toBeLessThan(html.indexOf("Footer slot content"));
        expect(html.indexOf("Footer slot content")).toBeLessThan(html.indexOf("<footer"));
        expect(html).not.toContain("data-footer-spacer");
        expect(html).not.toContain("footer-clearance");
    });

    it("stacks the header, a growing content region and the footer so short pages end at the viewport bottom", () => {
        const html = renderToStaticMarkup(<ThemeProvider><AppShell><h1>Workspace</h1></AppShell></ThemeProvider>);
        expect(html).toContain("flex min-h-screen w-full flex-col supports-[height:100dvh]:min-h-dvh");
        expect(html).toMatch(/<div class="grid min-w-0 flex-1 /);
        expect(html.indexOf("<main")).toBeLessThan(html.indexOf("<footer"));
        const footerTag = html.slice(html.indexOf("<footer"), html.indexOf(">", html.indexOf("<footer")));
        expect(footerTag).toContain("shrink-0");
        expect(footerTag).not.toMatch(/(fixed|sticky|absolute)/);
    });
});
