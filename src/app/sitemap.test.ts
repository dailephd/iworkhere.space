import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";

describe("public sitemap", () => {
    it("enumerates the canonical registry and only populated categories once", () => {
        const urls = sitemap().map(entry => entry.url);
        expect(getAllTool()).toHaveLength(18);
        expect(getAvailableCategory()).toHaveLength(7);
        expect(urls).toHaveLength(35);
        expect(urls).toHaveLength(5 + getAllTool().length + getAvailableCategory().length + 1 + 4);
        expect(new Set(urls).size).toBe(urls.length);
        expect(urls).toContain("https://iworkhere.space/");
        expect(urls).toContain("https://iworkhere.space/discover");
        expect(urls.filter(url => url === "https://iworkhere.space/privacy")).toHaveLength(1);
        expect(urls.filter(url => url === "https://iworkhere.space/about")).toHaveLength(1);
        expect(urls.filter(url => url === "https://iworkhere.space/contact")).toHaveLength(1);
        for (const tool of getAllTool()) expect(urls).toContain(`https://iworkhere.space${tool.seo.canonicalPath}`);
        for (const category of getAvailableCategory()) expect(urls).toContain(`https://iworkhere.space/category/${category}`);
        expect(urls).toContain("https://iworkhere.space/category/document");
        for (const url of ["https://iworkhere.space/tool/json-formatter", "https://iworkhere.space/category/developer", "https://iworkhere.space/tool/word-character-counter", "https://iworkhere.space/tool/qr-code-generator"]) expect(urls.filter(entry => entry === url)).toHaveLength(1);
        for (const url of urls) {
            expect(url).toMatch(/^https:\/\/iworkhere\.space\//);
            expect(url).not.toMatch(/api\/|\?|#|localhost|vercel\.app|dashboard|_not-found/);
        }
        expect(sitemap()).toEqual(sitemap());
        expect(sitemap().every(entry => Object.keys(entry).join() === "url")).toBe(true);
    });

    it("lists the guide hub and exactly the four guide pages by independent slug", () => {
        const urls = sitemap().map(entry => entry.url);
        const expected = ["", "/assemble-pdf-packet", "/prepare-image-for-upload", "/heic-photos-to-pdf", "/pdf-pages-for-slides"].map(path => `https://iworkhere.space/guide${path}`);
        expect(urls.filter(url => url.includes("/guide"))).toEqual(expected);
    });

    it("includes future registry entries without editing the sitemap", () => {
        const tools = getAllTool();
        tools.push({ ...tools[0], id: "future-tool", slug: "future-tool", seo: { ...tools[0].seo, canonicalPath: "/tool/future-tool" } });
        try { expect(sitemap().map(entry => entry.url)).toContain("https://iworkhere.space/tool/future-tool"); }
        finally { tools.pop(); }
    });
});

it("replaces the historical canonical category URL without changing converter or QR tool URLs", () => {
    const urls = sitemap().map(entry => entry.url);
    expect(urls.filter(url => url === "https://iworkhere.space/category/converter")).toHaveLength(1);
    expect(urls).not.toContain("https://iworkhere.space/category/everyday");
    for (const slug of ["length-converter", "weight-converter", "qr-code-generator"]) {
        expect(urls.filter(url => url === `https://iworkhere.space/tool/${slug}`)).toHaveLength(1);
    }
});
