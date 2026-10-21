import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/component/layout/AppShell";
import { ThemeProvider } from "@/component/common/ThemeProvider";
import { tool_category_definition_list } from "@/module/tool/category";
import { tool_definition_list } from "@/module/tool/registry";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: unknown }) =>
        createElement("a", { href, ...props }, children as never),
}));

import CategoryPage, { generateMetadata } from "./page";

describe("category route", () => {
    it("renders Image Resizer through the existing image category", async () => {
        const content = await CategoryPage({ params: Promise.resolve({ category: "image" }) });
        const html = renderToStaticMarkup(content);
        expect(html).toContain("Image &amp; Media Tool");
        expect(html).toContain('href="/tool/image-resizer"');
        expect(html).toContain("Image Resizer");
        expect(html).toContain('href="/tool/image-compressor"');
        expect(html).toContain("Image Compressor");
        expect(html).toContain('href="/tool/image-converter"');
        expect(html).toContain("JPG / PNG / WebP Converter");
        expect(html).not.toContain("No tool available");
    });
    it("renders existing category tools inside the shell's single main landmark", async () => {
        const categoryContent = await CategoryPage({
            params: Promise.resolve({ category: "text" }),
        });
        const html = renderToStaticMarkup(
            createElement(ThemeProvider, null, createElement(AppShell, null, categoryContent)),
        );
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html).toContain("Text &amp; Code Tool");
        expect(html).toContain('href="/tool/slugify"');
        expect(html).toContain('id="main-content"');
    });
    it("renders the developer category with the JSON Formatter / Validator", async () => {
        const content = await CategoryPage({ params: Promise.resolve({ category: "developer" }) });
        const html = renderToStaticMarkup(content);
        expect(html).toContain("Developer Tool");
        expect(html).toContain("Format, validate, transform, and inspect developer data.");
        expect(html).toContain('href="/tool/json-formatter"');
        expect(html).toContain("JSON Formatter / Validator");
        expect(html).not.toContain("No tool available");
    });
    it("keeps the exact title of each unchanged pre-v0.4 category", async () => {
        const titles = { document: "Document Tool", image: "Image &amp; Media Tool", text: "Text &amp; Code Tool", math: "Math &amp; Calculator Tool", time: "Time &amp; Date Tool" };
        for (const [category, title] of Object.entries(titles)) {
            const html = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ category }) }));
            expect(html).toContain(`>${title}</h1>`);
        }
    });
    it("calls notFound for an unknown category and returns no metadata for it", async () => {
        await expect(CategoryPage({ params: Promise.resolve({ category: "unknown" }) })).rejects.toThrow();
        expect(await generateMetadata({ params: Promise.resolve({ category: "unknown" }) })).toEqual({});
    });
    it("builds canonical metadata for developer from the category owner", async () => {
        const metadata = await generateMetadata({ params: Promise.resolve({ category: "developer" }) });
        expect(metadata.title).toBe("Developer Tool — iworkhere.space");
        expect(metadata.description).toBe("Format, validate, transform, and inspect developer data.");
    });
});

it("redirects the historical category permanently for page and metadata requests", async () => {
    const params = Promise.resolve({ category: "everyday" });
    for (const operation of [CategoryPage, generateMetadata]) {
        await expect(operation({ params })).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/category/converter;308;" });
    }
});

it("renders only the two converters and emits converter canonical metadata", async () => {
    const params = Promise.resolve({ category: "converter" });
    const html = renderToStaticMarkup(await CategoryPage({ params }));
    expect(html).toContain(">Converters</h1>");
    expect(html).toContain('href="/tool/length-converter"');
    expect(html).toContain('href="/tool/weight-converter"');
    expect(html).not.toContain("qr-code-generator");
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe("Converters — iworkhere.space");
    expect(metadata.alternates?.canonical).toBe("https://iworkhere.space/category/converter");
});

describe("category task guidance", () => {
    const render = async (category: string) => renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ category }) }));
    const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;");

    it("renders identity, then task guidance, then registered tools, with one H1 and no tool links inside the guidance", async () => {
        for (const definition of tool_category_definition_list) {
            const html = await render(definition.id);
            const tools = tool_definition_list.filter(tool => tool.category === definition.id);
            expect(html.match(/<h1\b/g), definition.id).toHaveLength(1);
            const guidance = html.indexOf('id="category-guidance-title"'), available = html.indexOf('id="category-tool-title"');
            expect(html.indexOf("</h1>"), definition.id).toBeLessThan(guidance);
            expect(guidance, definition.id).toBeLessThan(available);
            expect(html).toContain(escaped(definition.guidance.task));
            expect(html).toContain(escaped(definition.guidance.limitation));
            for (const tool of tools) {
                expect(html.match(new RegExp(`href="/tool/${tool.slug}"`, "g")), `${definition.id}/${tool.slug} card`).toHaveLength(1);
            }
            expect(html.match(/href="\/tool\//g), definition.id).toHaveLength(tools.length);
            expect(html.slice(guidance, available)).not.toContain("<a ");
            for (const choice of definition.guidance.choice) {
                const tool = tools.find(one => one.id === choice.toolId)!;
                expect(html.slice(guidance, available), `${definition.id}/${choice.toolId}`).toContain(escaped(`${tool.name}</strong>: ${choice.when}`));
            }
        }
    });

    it("keeps the guidance visible rather than hidden or collapsed", async () => {
        for (const definition of tool_category_definition_list) {
            expect(await render(definition.id), definition.id).not.toMatch(/<details|hidden|display:\s*none|aria-hidden/i);
        }
    });

    it("keeps Math and Time as honest one-tool categories that remain indexable", async () => {
        const math = await render("math"), time = await render("time");
        expect(math).toContain('href="/tool/calculator"');
        expect(math).toContain("not arbitrary-precision arithmetic");
        expect(time).toContain('href="/tool/time-arithmetic"');
        expect(time).toContain("does not convert time zones");
        for (const category of ["math", "time"]) {
            const metadata = await generateMetadata({ params: Promise.resolve({ category }) });
            expect(metadata.alternates?.canonical).toBe(`https://iworkhere.space/category/${category}`);
            // No category-specific noindex: the shared indexing policy decides, identically for every category.
            expect(metadata.robots).toEqual((await generateMetadata({ params: Promise.resolve({ category: "image" }) })).robots);
        }
    });

    it("builds Time metadata from the corrected category description", async () => {
        const metadata = await generateMetadata({ params: Promise.resolve({ category: "time" }) });
        expect(metadata.description).toBe("Add and subtract time values in HH:MM format.");
    });
});
