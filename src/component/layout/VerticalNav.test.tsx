/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: unknown }) =>
        createElement("a", { href, ...props }, children as never),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

import { VerticalNav } from "./VerticalNav";
import { defaultNavItem } from "@/app/navData";

describe("VerticalNav", () => {
    it("keeps existing destinations and marks the current route", () => {
        const html = renderToStaticMarkup(
            createElement(VerticalNav, {
                item: defaultNavItem,
                ariaLabel: "Primary navigation",
            }),
        );
        expect(html).toContain('aria-label="Primary navigation"');
        expect(html).toContain('href="/"');
        expect(html).toContain('href="/discover"');
        expect(html).toContain('aria-current="page"');
        expect(html).toContain("Home");
        expect(html).toContain("Discover");
    });
});
