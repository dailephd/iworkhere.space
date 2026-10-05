import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";

describe("public sitemap", () => {
    it("enumerates the canonical registry and only populated categories once", () => {
        const urls = sitemap().map(entry => entry.url);
        expect(getAllTool()).toHaveLength(14);
        expect(getAvailableCategory()).toHaveLength(6);
        expect(urls).toHaveLength(22);
        expect(urls).toHaveLength(2 + getAllTool().length + getAvailableCategory().length);
        expect(new Set(urls).size).toBe(urls.length);
        expect(urls).toContain("https://iworkhere.space/");
        expect(urls).toContain("https://iworkhere.space/discover");
        for (const tool of getAllTool()) expect(urls).toContain(`https://iworkhere.space${tool.seo.canonicalPath}`);
        for (const category of getAvailableCategory()) expect(urls).toContain(`https://iworkhere.space/category/${category}`);
        expect(urls).toContain("https://iworkhere.space/category/document");
        for (const url of urls) {
            expect(url).toMatch(/^https:\/\/iworkhere\.space\//);
            expect(url).not.toMatch(/api\/|\?|#|localhost|vercel\.app|dashboard|_not-found/);
        }
        expect(sitemap()).toEqual(sitemap());
        expect(sitemap().every(entry => Object.keys(entry).join() === "url")).toBe(true);
    });

    it("includes future registry entries without editing the sitemap", () => {
        const tools = getAllTool();
        tools.push({ ...tools[0], id: "future-tool", slug: "future-tool", seo: { ...tools[0].seo, canonicalPath: "/tool/future-tool" } });
        try { expect(sitemap().map(entry => entry.url)).toContain("https://iworkhere.space/tool/future-tool"); }
        finally { tools.pop(); }
    });
});
