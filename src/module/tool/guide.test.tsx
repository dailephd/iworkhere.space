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
