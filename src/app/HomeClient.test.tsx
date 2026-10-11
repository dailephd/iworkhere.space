/** @vitest-environment jsdom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import HomeClient from "./HomeClient";

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: unknown }) => createElement("a", props, children as never) }));
it("renders one section for each populated category and preserves canonical order", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(HomeClient, {
        categoryItem: ["document", "text", "math", "converter", "time", "image", "developer"],
        toolItem: [
            { slug: "image-resizer", name: "Image Resizer", description: "Resize", category: "image" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math" },
            { slug: "length-converter", name: "Length Converter", description: "Convert", category: "converter" },
            { slug: "json-formatter", name: "JSON Formatter", description: "Format", category: "developer" },
            { slug: "slugify", name: "Slugify", description: "Slug", category: "text" },
            { slug: "merge-pdf", name: "Merge PDF", description: "Merge", category: "document" },
            { slug: "time-arithmetic", name: "Time Arithmetic", description: "Time", category: "time" },
        ],
    }));
    const islands = [...host.querySelectorAll('[data-surface="section-island"]')];
    expect(islands).toHaveLength(7);
    expect(islands.map(section => section.querySelector("h2")?.textContent)).toEqual([
        "Document tools", "Text tools", "Math tools", "Converters", "Time tools", "Image tools", "Developer tools",
    ]);
    expect(islands.every(section => section.className === islands[0].className)).toBe(true);
    expect(host.querySelector('a[href="/discover"]')?.textContent).toBe("All tools");
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
            { slug: "image-resizer", name: "Image Resizer", description: "Resize", category: "image" },
            { slug: "calculator", name: "Calculator", description: "Calculate", category: "math" },
        ],
    }));
    expect([...host.querySelectorAll('[data-surface="section-island"] h2')].map(node => node.textContent))
        .toEqual(["Image tools", "Math tools"]);
    expect(host.querySelectorAll('a[href="/tool/image-resizer"]')).toHaveLength(1);
    expect(host.querySelectorAll('a[href="/tool/calculator"]')).toHaveLength(1);
});
