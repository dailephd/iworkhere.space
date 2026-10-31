/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import HomeClient from "./HomeClient";
import { getToolCategoryDefinition } from "@/module/tool/category";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));
it("renders one section for each populated category and preserves canonical order", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["document", "text", "math", "converter", "time", "image", "developer"],
        toolItem: [
            { slug: "image-resizer", name: "Image Resizer", description: "Resize", category: "image", categoryLabel: "Image Tools" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math", categoryLabel: "Math Tools" },
            { slug: "length-converter", name: "Length Converter", description: "Convert", category: "converter", categoryLabel: "Converters" },
            { slug: "json-formatter", name: "JSON Formatter", description: "Format", category: "developer", categoryLabel: "Developer Tools" },
            { slug: "slugify", name: "Slugify", description: "Slug", category: "text", categoryLabel: "Text Tools" },
            { slug: "merge-pdf", name: "Merge PDF", description: "Merge", category: "document", categoryLabel: "PDF Tools" },
            { slug: "time-arithmetic", name: "Time Arithmetic", description: "Time", category: "time", categoryLabel: "Time Tools" },
        ],
    }));
    const islands = [...host.querySelectorAll('[data-surface="section-island"]')];
    expect(islands).toHaveLength(7);
    expect(islands.map(section => section.querySelector("h2")?.textContent)).toEqual([
        "PDF Tools", "Text Tools", "Math Tools", "Converters", "Time Tools", "Image Tools", "Developer Tools",
    ]);
    expect(islands.every(section => section.className === islands[0].className)).toBe(true);
    expect(host.querySelector('a[href="/discover"]')).toBeNull();
    const slugs = ["merge-pdf", "slugify", "calculator", "length-converter", "time-arithmetic", "image-resizer", "json-formatter"];
    for (const [index, slug] of slugs.entries()) {
        expect(islands[index].querySelector('a[href="/tool/' + slug + '"]')).not.toBeNull();
        expect(islands[index].querySelectorAll('a[href^="/tool/"]')).toHaveLength(1);
    }
    expect(host.querySelectorAll('a[href^="/tool/"]')).toHaveLength(slugs.length);
});

it("does not render empty categories or duplicate tool cards", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["document", "image", "math"],
        toolItem: [
            { slug: "image-resizer", name: "Image Resizer", description: "Resize", category: "image", categoryLabel: "Image Tools" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math", categoryLabel: "Math Tools" },
        ],
    }));
    expect([...host.querySelectorAll('[data-surface="section-island"] h2')].map(node => node.textContent))
        .toEqual(["Image Tools", "Math Tools"]);
    expect(host.querySelectorAll('a[href="/tool/image-resizer"]')).toHaveLength(1);
    expect(host.querySelectorAll('a[href="/tool/calculator"]')).toHaveLength(1);
});

it("shows each canonical category description and scopes the board by category", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["document", "math"],
        toolItem: [
            { slug: "merge-pdf", name: "Merge PDF", description: "Merge", category: "document", categoryLabel: "PDF Tools" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math", categoryLabel: "Math Tools" },
        ],
    }));
    const board = [...host.querySelectorAll("[data-home-board]")];
    expect(board.map(one => one.getAttribute("data-category"))).toEqual(["document", "math"]);
    expect(board[0].textContent).toContain(getToolCategoryDefinition("document").description);
    expect(board[1].textContent).toContain(getToolCategoryDefinition("math").description);
});

it("renders a tool without any per-tool presentation entry as a readable whole-card link", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["developer"],
        toolItem: [{ slug: "future-tool", name: "Future Tool", description: "A later tool", category: "developer", categoryLabel: "Developer Tools" }],
    }));
    const card = host.querySelector('a[href="/tool/future-tool"]')!;
    expect(card.querySelector("svg")).toBeNull();
    expect(card.getAttribute("data-category")).toBe("developer");
    expect(card.textContent).toContain("Developer Tools");
    expect(card.textContent).toContain("Future Tool");
    expect(card.textContent).toContain("A later tool");
});

it("renders children after the whole catalog and shows no count text", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["math"],
        toolItem: [{ slug: "calculator", name: "Calculator", description: "Calculate", category: "math", categoryLabel: "Math Tools" }],
    }, createElement("p", { id: "after-catalog" }, "Secondary")));
    const card = host.querySelector("a.catalog-card")!;
    const after = host.querySelector("#after-catalog")!;
    expect(card.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.textContent).not.toMatch(/\d+\s+(?:tools?|categories)/i);
});
// ---- Search integration (Prompt 8): one result presentation, canonical labels, live status, single tag control ----
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ToolSearch, { type ToolSearchItem } from "@/component/common/ToolSearch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const searchItem: ToolSearchItem[] = [
    { slug: "image-resizer", name: "Image Resizer", description: "Resize JPEG, PNG and WebP images.", category: "image", categoryLabel: "Image Tools", tag: ["image", "resize"] },
    { slug: "image-compressor", name: "Image Compressor", description: "Compress JPEG, PNG and WebP images.", category: "image", categoryLabel: "Image Tools", tag: ["image", "compress"] },
    { slug: "time-arithmetic", name: "Time Arithmetic", description: "Add and subtract durations written as HH:MM.", category: "time", categoryLabel: "Time Tools", tag: ["time"] },
];

function mount(node: React.ReactElement): { host: HTMLElement; root: Root } {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(node); });
    return { host, root };
}

function type(host: HTMLElement, value: string): void {
    const input = host.querySelector("#tool-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

function status(host: HTMLElement): string {
    return host.querySelector('[role="status"]')?.textContent ?? "";
}

it("replaces the Home catalog with ONE filtered result list while searching and restores it when cleared", () => {
    const { host, root } = mount(createElement(HomeClient, {
        categoryItem: ["image", "time"],
        toolItem: searchItem,
    }));
    expect(host.querySelectorAll("[data-home-board]")).toHaveLength(2);
    expect(host.querySelectorAll('a[href^="/tool/"]')).toHaveLength(3);
    expect(host.querySelector(".ds-results")).toBeNull();
    expect(status(host)).toBe("");

    type(host, "resize image");
    expect(host.querySelectorAll("[data-home-board]")).toHaveLength(0);
    expect(host.querySelector("#home-categories-title")).toBeNull();
    expect(host.querySelectorAll(".ds-results")).toHaveLength(1);
    expect([...host.querySelectorAll('a[href^="/tool/"]')].map(one => one.getAttribute("href"))).toEqual(["/tool/image-resizer"]);
    expect(status(host)).toBe("1 tool found");
    expect(host.querySelector(".ds-results")!.textContent).toContain("Image Tools");
    expect(host.querySelector(".ds-results")!.textContent).not.toContain("image ");

    type(host, "");
    expect(host.querySelectorAll("[data-home-board]")).toHaveLength(2);
    expect(host.querySelector(".ds-results")).toBeNull();
    act(() => root.unmount());
});

it("announces plural and zero results in one polite atomic status region", () => {
    const { host, root } = mount(createElement(ToolSearch, { item: searchItem }));
    const region = host.querySelector('[role="status"]')!;
    expect(host.querySelectorAll('[role="status"], [role="alert"]')).toHaveLength(1);
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(status(host)).toBe("3 tools found");
    type(host, "image");
    expect(status(host)).toBe("2 tools found");
    type(host, "zzzz");
    expect(status(host)).toBe("No tools found. Try a different name or task.");
    expect(host.querySelectorAll("li")).toHaveLength(0);
    act(() => root.unmount());
});

it("labels the search input and shows canonical category labels, never raw ids", () => {
    const { host, root } = mount(createElement(ToolSearch, { item: searchItem }));
    const label = host.querySelector('label[for="tool-search"]');
    expect(label?.textContent).toBe("Search");
    expect((host.querySelector("#tool-search") as HTMLInputElement).placeholder).toBe("Search tools or tasks");
    const badge = [...host.querySelectorAll("li a div div")].map(one => one.textContent);
    expect(badge).toContain("Image Tools");
    expect(badge).toContain("Time Tools");
    expect(badge).not.toContain("image");
    expect(host.querySelector(".line-clamp-2")).toBeNull();
    act(() => root.unmount());
});

it("offers exactly one labelled tag control instead of per-tag buttons", () => {
    const { host, root } = mount(createElement(ToolSearch, { item: searchItem, showTagFilters: true }));
    const select = host.querySelector("#tool-tag-filter") as HTMLSelectElement;
    expect(host.querySelector('label[for="tool-tag-filter"]')?.textContent).toBe("Filter by tag");
    expect([...select.options].map(one => one.textContent)).toEqual(["All tags", "compress", "image", "resize", "time"]);
    expect(host.querySelectorAll("button")).toHaveLength(0);
    act(() => {
        select.value = "time";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(status(host)).toBe("1 tool found");
    type(host, "image");
    expect(status(host)).toBe("No tools found. Try a different name or task.");
    act(() => root.unmount());
});
