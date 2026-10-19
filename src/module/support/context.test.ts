import { describe, expect, it } from "vitest";
import { isAllowedPathname, isSafePathname, resolveReportContext, toolIdForPathname, type SupportContextSource } from "./context";
import { contextSource, toolProjection } from "./projection";
import { tool_definition_list } from "@/module/tool/registry";

const source: SupportContextSource = {
    tool: [{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }],
    category: ["document"],
};

describe("report context", () => {
    it("derives the default tool from a registered tool route", () => {
        expect(resolveReportContext("/tool/merge-pdf", source)).toEqual({ toolId: "merge-pdf", pathname: "/tool/merge-pdf" });
    });
    it("uses Site-wide for general pages", () => {
        expect(resolveReportContext("/", source)).toEqual({ toolId: null, pathname: "/" });
        expect(resolveReportContext("/discover", source)).toEqual({ toolId: null, pathname: "/discover" });
        expect(resolveReportContext("/category/document", source)).toEqual({ toolId: null, pathname: "/category/document" });
    });
    it("never invents a tool for unknown or malformed routes", () => {
        for (const pathname of ["/tool/unknown", "/tool/", "/tool/merge-pdf?x=1", "//tool/merge-pdf", "/tool/merge-pdf#x", "not-a-path", "/random/page"]) {
            expect(resolveReportContext(pathname, source), pathname).toEqual({ toolId: null, pathname: "/" });
        }
    });
    it("exposes the same predicates the server uses", () => {
        expect(isSafePathname("/tool/a_b-c")).toBe(true);
        expect(isSafePathname("/a?b")).toBe(false);
        expect(isAllowedPathname("/privacy", source)).toBe(true);
        expect(isAllowedPathname("/tool/other", source)).toBe(false);
        expect(toolIdForPathname("/discover", source)).toBeNull();
    });
});

describe("registry projection", () => {
    it("contains exactly id, slug and name for every registered tool and no component or definition data", () => {
        const projection = toolProjection();
        expect(projection).toHaveLength(tool_definition_list.length);
        for (const item of projection) {
            expect(Object.keys(item).sort()).toEqual(["id", "name", "slug"]);
            expect(Object.values(item).every(value => typeof value === "string")).toBe(true);
        }
        expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
        expect(JSON.stringify(projection)).not.toMatch(/function|Component|seo|description/);
    });
    it("builds the context source from the registry categories", () => {
        const built = contextSource();
        expect(built.tool).toEqual(toolProjection());
        expect(built.category.length).toBeGreaterThan(0);
        expect(resolveReportContext(`/tool/${tool_definition_list[0].slug}`, built).toolId).toBe(tool_definition_list[0].id);
    });
});
