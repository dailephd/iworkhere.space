/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));

import HomePage, { metadata } from "./page";
import { getAvailableCategory, getAllTool } from "@/module/tool/metadata";
import { getAllValueExample, getFeaturedValueExample } from "@/module/tool/valueExamples";
import { getToolCategoryLabel } from "@/module/tool/category";

const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
const ADDED = ["merge-pdf", "split-pdf", "image-compressor", "heic-converter"];

function render(): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomePage));
    return host;
}

describe("home page task-first content", () => {
    it("keeps one H1 and replaces the generic introduction with a truthful capability statement", () => {
        const host = render();
        expect(host.querySelectorAll("h1")).toHaveLength(1);
        const text = host.querySelector("h1")!.parentElement!.textContent ?? "";
        expect(text).toContain(`${getAllTool().length} browser tools`);
        for (const word of ["PDFs", "images", "text", "unit conversion", "calculation", "time values", "JSON"]) expect(text).toContain(word);
        expect(text).toContain("processed in your browser and are not uploaded");
        expect(text).toContain("each tool page lists its limits");
        expect(text).toContain("Not every conversion is lossless");
        expect(text).toContain("not every file gets smaller");
        expect(text).not.toMatch(/works offline|everything works offline|collects no|no data|all files|any file|certif|always (?:smaller|lossless)/i);
        expect(text).not.toContain("everyday");
    });

    it("features exactly the five verified tasks, each linked once to its registered tool", () => {
        const host = render();
        const item = [...host.querySelectorAll<HTMLElement>("[data-featured-task]")];
        expect(item.map(one => one.getAttribute("data-featured-task"))).toEqual(FEATURED);
        // Nine tools have worked examples, but only the five original tasks are presented on the home page.
        expect(getAllValueExample().map(example => example.toolId)).toEqual([...FEATURED, ...ADDED]);
        expect(getFeaturedValueExample().map(example => example.toolId)).toEqual(FEATURED);
        for (const slug of ADDED) expect(host.querySelector(`[data-featured-task="${slug}"]`), slug).toBeNull();
        for (const [index, one] of item.entries()) {
            const tool = getAllTool().find(value => value.slug === FEATURED[index])!;
            const example = getFeaturedValueExample()[index];
            const link = one.querySelectorAll("a");
            expect(link).toHaveLength(1);
            expect(link[0].getAttribute("href")).toBe(`/tool/${tool.slug}`);
            expect(link[0].textContent).toBe(tool.name);
            expect(one.textContent).toContain(example.task);
            expect(one.textContent).toContain(example.whyThisTool);
            expect(one.textContent).toContain(example.limitation[0]);
            expect(one.querySelector("h3")?.contains(link[0])).toBe(true);
        }
    });

    it("makes no usage-ranking claim about the featured tasks", () => {
        const section = render().querySelector("[data-featured-task-section]")!;
        expect(section.textContent).toContain("Five common jobs");
        expect(section.textContent).not.toMatch(/most popular|trending|recommended for you|top rated|most downloaded|bestsell/i);
    });

    it("does not register featured links as catalog cards, so all tool cards still appear exactly once", () => {
        const host = render();
        expect(host.querySelectorAll("[data-featured-task] .catalog-card, [data-featured-task].catalog-card")).toHaveLength(0);
        const card = [...host.querySelectorAll<HTMLAnchorElement>('a.catalog-card[href^="/tool/"]')];
        const registered = getAllTool().map(tool => `/tool/${tool.slug}`);
        expect(card).toHaveLength(registered.length);
        expect([...card.map(one => one.getAttribute("href"))].sort()).toEqual([...registered].sort());
        expect(new Set(card.map(one => one.getAttribute("href"))).size).toBe(registered.length);
        for (const one of card) expect(one.closest('[data-surface="section-island"]')).not.toBeNull();
        expect(host.querySelectorAll("[data-featured-task] a")).toHaveLength(FEATURED.length);
    });

    it("keeps search, the category chips and one section island for each populated category", () => {
        const host = render();
        expect(host.querySelector('input[type="search"], input[id*="search" i], [role="search"]')).not.toBeNull();
        const island = [...host.querySelectorAll('[data-surface="section-island"]')];
        expect(island).toHaveLength(getAvailableCategory().length);
        for (const category of getAvailableCategory()) {
            const chip = host.querySelector(`a[data-category="${category}"][href="/category/${category}"]`);
            expect(chip?.textContent, category).toBe(getToolCategoryLabel(category));
        }
        expect(host.querySelector('a[href="/discover"]')?.textContent).toBe("All tools");
    });

    it("places the task section before search and the category sections", () => {
        const html = renderToStaticMarkup(createElement(HomePage));
        expect(html.indexOf("data-featured-task-section")).toBeLessThan(html.indexOf('data-surface="section-island"'));
        expect(html.indexOf("data-featured-task-section")).toBeLessThan(html.indexOf("home-categories-title"));
    });
});

describe("home page metadata", () => {
    it("uses the descriptive browser title with one suffix", () => {
        expect(metadata.title).toBe("Browser Tools for PDFs, Images and Text - iworkhere");
    });

    it("describes the real utilities and keeps the canonical home URL", () => {
        expect(metadata.description).toContain("PDFs, images, text, unit conversion, calculation, time values and developer tasks");
        expect(metadata.description).not.toMatch(/everyday|offline/i);
        expect(metadata.alternates?.canonical).toBe("https://iworkhere.space/");
    });
});
