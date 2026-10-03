import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("AppShell", () => {
    it("omits absent banner regions and preserves the main landmark and skip target", () => {
        const html = renderToStaticMarkup(
            createElement(AppShell, null, createElement("h1", null, "Workspace")),
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
        expect(html).not.toContain("MainScroll");
        expect(html.indexOf("Workspace")).toBeLessThan(
            html.indexOf("© 2026 iworkhere.space created by dailephd LLC"),
        );
    });

    it("renders supplied banner regions and adapts the desktop grid", () => {
        const html = renderToStaticMarkup(
            <AppShell
                headerBannerSlot={<span>Header slot content</span>}
                leftBannerSlot={<span>Left slot content</span>}
                rightBannerSlot={<span>Right slot content</span>}
                navItem={[{ id: "discover", label: "All tools", href: "/discover" }]}
            >
                <h1>Workspace</h1>
            </AppShell>,
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
});
