/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));

import DiscoverPage, { metadata } from "./page";
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";
import { getToolCategoryDefinition, getToolCategoryLabel } from "@/module/tool/category";

function render(): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(DiscoverPage));
    return host;
}

describe("discover page content", () => {
    it("keeps one H1 and explains direct search versus browsing by category without the retired everyday category", () => {
        const host = render();
        expect(host.querySelectorAll("h1")).toHaveLength(1);
        expect(host.querySelector("h1")?.textContent).toBe("All tools");
        const text = host.querySelector("h1")!.parentElement!.textContent ?? "";
        expect(text).toContain("Search for a tool by name or task, or browse by category");
        expect(text).toContain(`shows all ${getAllTool().length} tools together`);
        expect(text).not.toMatch(/everyday/i);
        expect(text).not.toContain("Browse all available utility tool by category");
    });

    it("links every populated category from the authoritative owner with its own label and description", () => {
        const host = render();
        const section = host.querySelector('section[aria-labelledby="discover-category-title"]')!;
        const link = [...section.querySelectorAll("a")];
        expect(link.map(one => one.getAttribute("href"))).toEqual(getAvailableCategory().map(category => `/category/${category}`));
        for (const [index, category] of getAvailableCategory().entries()) {
            expect(link[index].textContent).toBe(getToolCategoryLabel(category));
            expect(link[index].parentElement?.textContent).toContain(getToolCategoryDefinition(category).description);
        }
        expect(link.map(one => one.getAttribute("href"))).not.toContain("/category/everyday");
    });

    it("keeps the complete registry-derived tool list, with the new content adding no tool links", () => {
        const host = render();
        const tool = [...host.querySelectorAll<HTMLAnchorElement>('a[href^="/tool/"]')].map(one => one.getAttribute("href"));
        expect([...tool].sort()).toEqual(getAllTool().map(one => `/tool/${one.slug}`).sort());
        expect(new Set(tool).size).toBe(getAllTool().length);
        expect(host.querySelector('input[type="search"], input[id*="search" i]')).not.toBeNull();
    });

    it("keeps the search examples tied to real registered tool text", () => {
        const haystack = getAllTool().map(one => `${one.name} ${one.description} ${(one.tag ?? []).join(" ")}`.toLowerCase());
        for (const word of ["merge", "compress", "resize", "convert"]) expect(haystack.some(text => text.includes(word)), word).toBe(true);
    });
});

describe("discover metadata", () => {
    it("uses the descriptive browser title with one suffix", () => {
        expect(metadata.title).toBe("All Tools - iworkhere");
    });

    it("lists the current populated categories and no retired wording", () => {
        const description = String(metadata.description);
        expect(description).toContain(`Search all ${getAllTool().length} browser tools`);
        for (const category of getAvailableCategory()) expect(description).toContain(getToolCategoryLabel(category));
        expect(description).not.toMatch(/everyday/i);
        expect(metadata.alternates?.canonical).toBe("https://iworkhere.space/discover");
    });
});
