/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));

import HomePage from "./page";
import DiscoverPage from "./discover/page";
import GuideHubPage from "./guide/page";
import CategoryPage from "./category/[category]/page";

const globalCss = readFileSync("src/app/global.css", "utf8");
const themeCss = readFileSync("src/style/theme.css", "utf8");

function host(html: string): HTMLElement {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el;
}

describe("shared design roles are consumed by every route family", () => {
    it("renders the shared card and section classes on the homepage, Discover and a category, and the finder choice controls on the guide hub", async () => {
        const category = await CategoryPage({ params: Promise.resolve({ category: "document" }) });
        const page = {
            home: host(renderToStaticMarkup(createElement(HomePage))),
            discover: host(renderToStaticMarkup(createElement(DiscoverPage))),
            category: host(renderToStaticMarkup(category)),
        };
        const guide = host(renderToStaticMarkup(createElement(GuideHubPage)));
        for (const [name, el] of Object.entries(page)) {
            const card = [...el.querySelectorAll(".home-card, .ds-card")];
            expect(card.length, name).toBeGreaterThan(0);
            // Cards are painted by the shared role classes, not by the older bg-surface token.
            expect(card.filter(one => one.classList.contains("bg-surface")), name).toHaveLength(0);
            expect(el.querySelectorAll("li.bg-surface, li.bg-card-bg"), name).toHaveLength(0);
        }
        expect(page.discover.querySelectorAll(".ds-board .ds-section a.ds-card")).toHaveLength(7);
        expect(page.category.querySelectorAll(".ds-board .ds-section a.ds-card").length).toBeGreaterThan(0);
        // The finder uses the tool interior roles for its choices, distinct from catalog cards.
        expect(guide.querySelectorAll("[data-guide-finder] button.tool-action-secondary").length).toBeGreaterThan(0);
        expect(guide.querySelectorAll(".home-card, .ds-card")).toHaveLength(0);
    });

    it("keeps featured and workflow previews to a title and one sentence", () => {
        const el = host(renderToStaticMarkup(createElement(HomePage)));
        for (const card of el.querySelectorAll("[data-featured-task], [data-workflow]")) {
            expect(card.querySelectorAll("h3")).toHaveLength(1);
            expect(card.querySelectorAll("p")).toHaveLength(1);
        }
    });

    it("defines the shared roles once and derives every route from them", () => {
        for (const role of ["--home-ground", "--home-board-neutral", "--home-card-bg", "--home-card-border", "--home-card-fg", "--home-card-muted", "--home-support-panel-bg", "--home-support-panel-border"]) {
            expect(themeCss, role).toContain(`${role}:`);
        }
        expect(globalCss).toMatch(/\.ds-card\s*\{[^}]*var\(--home-card-bg\)/);
        expect(globalCss).toMatch(/\.ds-surface\s*\{[^}]*var\(--home-support-panel-bg\)/);
        expect(globalCss).toMatch(/body, div\.bg-background\s*\{\s*background-color:\s*var\(--home-ground\)/);
    });

    it("gives every dark palette its own approved hero pair and lifts dark cards above their boards", () => {
        for (const palette of ["original", "mineral", "oxblood", "signal", "cobalt", "amber"]) {
            expect(themeCss, palette).toContain(`:root[data-palette="${palette}"][data-theme="dark"] { --home-hero-bg:`);
        }
        expect(themeCss).toContain(':root[data-theme="onedark"] { --home-hero-bg: #2f2540;');
        expect(themeCss).toMatch(/--home-card-bg:\s*color-mix\(in srgb, color-mix\(in srgb, var\(--home-card-base\) 88%, white 12%\)/);
    });
});
