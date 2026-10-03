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
            if (tool.category !== "image") {
                expect(guide).toBeUndefined();
                expect(html).not.toContain("Supported images and limits");
                expect(html).not.toContain("25 MiB");
                return;
            }
            expect(guide).toBeDefined();
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
});
