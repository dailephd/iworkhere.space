/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));

import HomePage, { metadata } from "./page";
import { getAvailableCategory, getAllTool } from "@/module/tool/metadata";
import { getToolCategoryDefinition, getToolCategoryLabel } from "@/module/tool/category";

function render(): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomePage));
    return host;
}

function precedes(first: Element, second: Element): boolean {
    return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe("home page introduction", () => {
    it("has one H1 and at most one short factual supporting sentence", () => {
        const host = render();
        expect(host.querySelectorAll("h1")).toHaveLength(1);
        const hero = host.querySelector("[data-home-hero]")!;
        expect(hero.contains(host.querySelector("h1"))).toBe(true);
        expect(hero.querySelectorAll("p")).toHaveLength(1);
        expect(hero.textContent).not.toContain("Small tasks. Big difference.");
    });

    it("states browser-local file handling without overclaiming", () => {
        const text = render().querySelector("[data-home-hero]")!.textContent ?? "";
        expect(text).toContain("processed in your browser and are not uploaded");
        expect(text).not.toMatch(/works offline|everything works offline|collects no|no data|all files|any file|certif|always (?:smaller|lossless)/i);
    });

    it("shows no tool or category totals anywhere on the home page", () => {
        const host = render();
        const text = host.textContent ?? "";
        expect(text).not.toMatch(/\d+\s+browser tools/i);
        expect(text).not.toMatch(/\d+\s*\/\s*\d+\s*tools?/i);
        expect(text).not.toMatch(/\b\d+\s+(?:tools?|categories)\b/i);
        expect(text).not.toContain(String(getAllTool().length));
        expect(text).not.toContain(String(getAvailableCategory().length));
        expect(host.querySelector("[data-status-panel]")).toBeNull();
    });
});

describe("home page information order", () => {
    it("orders hero, search, category links, then the catalog", () => {
        const host = render();
        const hero = host.querySelector("[data-home-hero]")!;
        const search = host.querySelector("input#tool-search")!;
        const chips = host.querySelector("#home-categories-title")!;
        const firstCard = host.querySelector("a.catalog-card")!;
        expect(precedes(hero, search)).toBe(true);
        expect(precedes(search, chips)).toBe(true);
        expect(precedes(chips, firstCard)).toBe(true);
    });
});

describe("home page catalog", () => {
    it("lists every registered tool once as a whole-card link with its exact name and description", () => {
        const host = render();
        const card = [...host.querySelectorAll<HTMLAnchorElement>('a.catalog-card[href^="/tool/"]')];
        const registered = getAllTool();
        expect(registered).toHaveLength(18);
        expect(card).toHaveLength(registered.length);
        expect(new Set(card.map(one => one.getAttribute("href"))).size).toBe(registered.length);
        for (const tool of registered) {
            const one = card.find(value => value.getAttribute("href") === `/tool/${tool.slug}`)!;
            expect(one, tool.slug).toBeDefined();
            expect(one.querySelector("h3")?.textContent).toBe(tool.name);
            expect(one.querySelector("p")?.textContent).toBe(tool.description);
            expect(one.getAttribute("data-category")).toBe(tool.category);
            expect(one.querySelector("a")).toBeNull();
            expect(one.querySelector("svg")).toBeNull();
            expect(one.closest('[data-surface="section-island"]')).not.toBeNull();
        }
    });

    it("shows one board per populated category in canonical order with its canonical title and description", () => {
        const host = render();
        const board = [...host.querySelectorAll<HTMLElement>("[data-home-board]")];
        const category = getAvailableCategory();
        expect(board.map(one => one.getAttribute("data-home-board"))).toEqual(category);
        expect(host.querySelectorAll('[data-surface="section-island"]')).toHaveLength(category.length);
        const link = [...host.querySelectorAll("#home-categories-title ~ ul a")];
        expect(link.map(one => one.getAttribute("href"))).toEqual(category.map(id => `/category/${id}`));
        for (const [index, id] of category.entries()) {
            const definition = getToolCategoryDefinition(id);
            expect(board[index].querySelector("h2")?.textContent, id).toBe(definition.title);
            expect(board[index].textContent, id).toContain(definition.description);
            expect(link[index].textContent, id).toBe(getToolCategoryLabel(id));
            expect(link[index].textContent, id).toBe(definition.title);
        }
    });

    it("keeps the existing search field with an honest label and placeholder", () => {
        const input = render().querySelector<HTMLInputElement>('input[type="search"]')!;
        expect(input.getAttribute("placeholder")).toBe("Search tools or tasks");
        expect(input.getAttribute("placeholder")).not.toMatch(/describe|\bask\b|\bai\b|intelligent|semantic/i);
    });
});

describe("home page is catalog-only", () => {
    it("renders no featured task, workflow or guide cards and no guide links", () => {
        const host = render();
        const text = host.textContent ?? "";
        expect(host.querySelector("[data-featured-task-section]")).toBeNull();
        expect(host.querySelector("[data-featured-task]")).toBeNull();
        expect(host.querySelector("[data-workflow-section]")).toBeNull();
        expect(host.querySelector("[data-workflow]")).toBeNull();
        expect(host.querySelector(".home-support")).toBeNull();
        expect(text).not.toContain("Start with a common task");
        expect(text).not.toContain("Practical file workflows");
        expect(host.querySelectorAll('a[href^="/guide"], a[href^="/workflows"]')).toHaveLength(0);
        expect(host.querySelectorAll("a[href]")).toHaveLength(getAllTool().length + getAvailableCategory().length);
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
