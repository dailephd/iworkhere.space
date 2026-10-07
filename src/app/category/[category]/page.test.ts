import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppShell from "@/component/layout/AppShell";

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
            createElement(AppShell, null, categoryContent),
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
    it("keeps the exact title of each pre-v0.4 category", async () => {
        const titles = { document: "Document Tool", image: "Image &amp; Media Tool", text: "Text &amp; Code Tool", math: "Math &amp; Calculator Tool", time: "Time &amp; Date Tool", everyday: "Everyday Utility" };
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
