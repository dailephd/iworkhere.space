import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolPageTemplate } from "@/component/tool/ToolPageTemplate";
import { getToolGuide } from "./guide";
import { getAllTool, getToolBreadcrumb, getToolByIdList } from "./metadata";

describe("server guide and breadcrumb composition", () => {
    for (const tool of getAllTool()) {
        it(`renders truthful page content for ${tool.id}`, () => {
            const guide = getToolGuide(tool.id);
            const related = getToolByIdList(guide?.relatedToolId ?? []);
            const html = renderToStaticMarkup(<ToolPageTemplate tool={tool} toolUi={<div>Interactive workspace</div>} breadcrumb={getToolBreadcrumb(tool)} guide={guide} relatedTool={related} />);
            expect(html).toContain('aria-label="Breadcrumb"');
            expect(html).toContain('href="/"');
            expect(html).toContain(`href="/category/${tool.category}"`);
            expect(html).toContain('aria-current="page"');
            if (tool.category === "document") {
                expect(guide).toBeDefined();
                expect(html).toContain("Related document tools");
                if (tool.id === "images-to-pdf") {
                    expect(html).toContain("25 MiB"); expect(html).toContain("30 megapixels");
                    expect(html).toContain("source images are not uploaded"); expect(html).toContain("PDF points");
                    expect(html).toContain("PNG alpha"); expect(related).toHaveLength(3);
                    expect(html).toContain('href="/tool/pdf-to-image"');
                } else {
                    expect(html).toContain("10 MiB"); expect(html).toContain("100 pages");
                    expect(html).toContain("PDF processing happens locally"); expect(related).toHaveLength(tool.id === "compress-pdf" ? 4 : tool.id === "pdf-to-image" ? 3 : 1);
                    if (tool.id === "compress-pdf") for (const text of ["What this compression does", "No reduction is normal", "NO REDUCTION ACHIEVED", "Supported PDFs and limits", "Fidelity boundary", "Local processing", "short-lived browser worker"]) expect(html).toContain(text);
                    if (tool.id === "pdf-to-image") {
                        for (const text of ["Page selection", "PNG vs JPG", "4096-pixel", "16 MP", "lower DPI", "150 DPI", "0.85", "20 output images", "Convert pages"]) expect(html).toContain(text);
                    }
                }
                expect(html).toContain("ordinary application assets");
                for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
                expect(html).not.toContain("Related image tools");
                return;
            }
            if (tool.category === "developer") {
                expect(tool.id).toBe("json-formatter");
                expect(guide).toBeDefined();
                for (const text of ["Strict JSON", "RFC 8259", "Token-preserving formatting", "1 MiB", "not uploaded for formatting or validation"]) expect(html).toContain(text);
                expect(related.map(item => item.id)).toEqual(["html-text-extractor", "slugify"]);
                for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
                expect(html).not.toContain("Related image tools");
                expect(html).not.toContain("Related document tools");
                return;
            }
            if (tool.id === "word-character-counter") {
                expect(tool.category).toBe("text");
                expect(guide).toBeDefined();
                for (const text of ["Word counting", "Character counting", "Whitespace and lines", "Limits and local processing", "grapheme clusters", "Intl.Segmenter", "White_Space", "U+200B", "CRLF, CR or LF", "1 MiB", "not uploaded, saved or placed in the page address"]) expect(html).toContain(text);
                expect(related.map(item => item.id)).toEqual(["slugify", "html-text-extractor"]);
                expect(related.every(item => item.category === "text")).toBe(true);
                for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
                expect(html).toContain("Related text tools");
                return;
            }
            if (tool.id === "qr-code-generator") {
                expect(tool.category).toBe("everyday");
                expect(guide).toBeDefined();
                for (const text of ["Text and URLs", "encoded exactly as you enter it", "does not fetch, open or check URLs", "Fixed QR settings", "error correction level M", "512 × 512", "quiet zone", "Payload limit", "2048 UTF-8 bytes", "denser QR symbols", "Not every camera or scanner", "Local processing", "not uploaded for QR generation"]) expect(html).toContain(text);
                expect(related.map(item => item.id)).toEqual(["length-converter", "weight-converter"]);
                expect(related.every(item => item.category === "everyday")).toBe(true);
                for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
                expect(html).toContain("Related everyday tools");
                return;
            }
            if (["slugify", "length-converter", "weight-converter", "html-text-extractor"].includes(tool.id)) {
                expect(guide).toBeDefined();
                expect(html).toContain("How to use");
                expect(html).toContain("Interactive workspace");
                for (const section of guide!.section) expect(html).toContain(section.heading);
                expect(new Set(guide!.relatedToolId).size).toBe(guide!.relatedToolId.length);
                expect(guide!.relatedToolId).not.toContain(tool.id);
                expect(related.map(item => item.id)).toEqual(guide!.relatedToolId);
                for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
                return;
            }
            if (tool.category !== "image") {
                expect(guide).toBeUndefined();
                expect(html).not.toContain("Supported images and limits");
                expect(html).not.toContain("25 MiB");
                return;
            }
            expect(guide).toBeDefined();
            expect(html).toContain("Related image tools");
            expect(html).not.toContain("Related document tools");
            expect(Object.keys(guide!).sort()).toEqual(["instruction", "relatedToolId", "section"]);
            expect(html).toContain("25 MiB");
            expect(html).toContain("30 megapixels");
            expect(html).toContain("ordinary application assets");
            expect(related).toHaveLength(3);
            for (const item of related) expect(html).toContain(`href="${item.seo.canonicalPath}"`);
        });
    }
    it("handles unknown IDs without treating object prototype keys as guides", () => {
        expect(getToolGuide("unknown")).toBeUndefined();
        expect(getToolGuide("toString")).toBeUndefined();
        expect(getToolByIdList(["unknown", "image-resizer", "image-resizer", "heic-converter"]).map(tool => tool.id)).toEqual(["image-resizer", "heic-converter"]);
    });
    it("keeps every document guide connected only to distinct registered siblings", () => {
        const documents = getAllTool().filter(tool => tool.category === "document");
        expect(documents).toHaveLength(5);
        for (const tool of documents) {
            const ids = getToolGuide(tool.id)!.relatedToolId;
            expect(ids.length).toBeGreaterThan(0);
            expect(new Set(ids).size).toBe(ids.length);
            expect(ids).not.toContain(tool.id);
            expect(getToolByIdList(ids).map(sibling => sibling.id)).toEqual(ids);
            expect(getToolByIdList(ids).every(sibling => sibling.category === "document")).toBe(true);
        }
    });
});

describe("related-tools heading truthfulness", () => {
    function renderGuided(toolId: string, relatedId?: string[]) {
        const tool = getAllTool().find(entry => entry.id === toolId)!;
        const guide = getToolGuide(tool.id)!;
        const related = getToolByIdList(relatedId ?? guide.relatedToolId);
        const html = renderToStaticMarkup(<ToolPageTemplate tool={tool} toolUi={<div>Interactive workspace</div>} breadcrumb={getToolBreadcrumb(tool)} guide={guide} relatedTool={related} />);
        return { html, related, heading: html.match(/<h2[^>]*>(Related[^<]*)<\/h2>/)?.[1] };
    }

    it("labels every guided tool's related set by the related tools' own categories", () => {
        const guided = getAllTool().filter(tool => getToolGuide(tool.id));
        expect(guided.length).toBeGreaterThanOrEqual(12);
        for (const tool of guided) {
            const { related, heading } = renderGuided(tool.id);
            const categories = [...new Set(related.map(entry => entry.category))];
            expect(related.length, tool.id).toBeGreaterThan(0);
            if (categories.length === 1) {
                expect(heading, tool.id).toBe(`Related ${categories[0]} tools`);
            } else {
                expect(heading, tool.id).toBe("Related tools");
            }
        }
    });

    it("says Related text tools on the JSON Formatter page, not Related developer tools", () => {
        const tool = getAllTool().find(entry => entry.id === "json-formatter")!;
        const { html, related, heading } = renderGuided("json-formatter");
        expect(tool.category).toBe("developer");
        expect(related.map(entry => entry.id)).toEqual(["html-text-extractor", "slugify"]);
        expect(related.map(entry => entry.category)).toEqual(["text", "text"]);
        expect(heading).toBe("Related text tools");
        expect(html).not.toContain("Related developer tools");
        for (const entry of related) expect(html).toContain(`href="${entry.seo.canonicalPath}"`);
    });

    it("keeps the existing correct headings", () => {
        expect(renderGuided("word-character-counter").heading).toBe("Related text tools");
        expect(renderGuided("qr-code-generator").heading).toBe("Related everyday tools");
        for (const id of ["image-resizer", "image-compressor", "image-converter", "heic-converter"]) expect(renderGuided(id).heading, id).toBe("Related image tools");
        for (const id of ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf"]) expect(renderGuided(id).heading, id).toBe("Related document tools");
    });

    it("uses the neutral heading for a mixed-category related set without naming either category", () => {
        const { html, related, heading } = renderGuided("json-formatter", ["slugify", "json-formatter"]);
        expect(related.map(entry => entry.category)).toEqual(["text", "developer"]);
        expect(heading).toBe("Related tools");
        expect(html).not.toContain("Related text tools");
        expect(html).not.toContain("Related developer tools");
    });

    it("uses the neutral heading when a guide has no resolvable related tools", () => {
        const { heading } = renderGuided("json-formatter", []);
        expect(heading).toBe("Related tools");
    });
});
