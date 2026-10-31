// @vitest-environment jsdom
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { getAllTaskGuide, getTaskGuide, getTaskGuideForTool } from "./taskGuide";
import { tool_definition_list } from "@/module/tool/registry";
import { getAllValueExample } from "@/module/tool/valueExamples";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));

const SLUG = ["assemble-pdf-packet", "prepare-image-for-upload", "heic-photos-to-pdf", "pdf-pages-for-slides"];
const TITLE = ["Assemble an Ordered PDF Packet", "Prepare an Image for an Upload", "Turn HEIC Photos into a PDF", "Prepare PDF Pages for Slides"];
const toolId = new Set(tool_definition_list.map(tool => tool.id));

describe("task guide records", () => {
    it("has exactly the four frozen slugs and titles in publication order", () => {
        const guide = getAllTaskGuide();
        expect(guide.map(one => one.slug)).toEqual(SLUG);
        expect(guide.map(one => one.title)).toEqual(TITLE);
    });

    it("gives every guide distinct, substantial, non-empty content", () => {
        const guide = getAllTaskGuide();
        for (const field of ["title", "description", "startingMaterial", "expectedOutcome"] as const) {
            expect(new Set(guide.map(one => one[field])).size, field).toBe(4);
            for (const one of guide) expect(one[field].trim().length, `${one.slug} ${field}`).toBeGreaterThan(20);
        }
        for (const one of guide) {
            expect(one.step.length, one.slug).toBeGreaterThanOrEqual(4);
            expect(one.verification.length, one.slug).toBeGreaterThanOrEqual(3);
            expect(one.limitation.length, one.slug).toBeGreaterThanOrEqual(3);
            for (const step of one.step) {
                expect(step.heading.trim()).not.toBe("");
                expect(step.explanation.length, `${one.slug} ${step.heading}`).toBeGreaterThan(60);
            }
            expect(new Set(one.step.map(step => step.heading)).size, one.slug).toBe(one.step.length);
        }
    });

    it("stores real calendar review dates and no timer-like wording", () => {
        for (const one of getAllTaskGuide()) {
            expect(one.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const date = new Date(`${one.reviewedOn}T00:00:00Z`);
            expect(date.toISOString().slice(0, 10), one.slug).toBe(one.reviewedOn);
            expect(date.getTime(), "review date is not in the future").toBeLessThanOrEqual(Date.now() + 24 * 3600 * 1000);
        }
    });

    it("references only registered tools, with unique ids and examples that exist", () => {
        const example = new Set(getAllValueExample().map(one => one.toolId));
        for (const one of getAllTaskGuide()) {
            const reference = [...one.step.flatMap(step => step.toolId ? [step.toolId] : []), ...one.exampleToolId, ...one.relatedToolId];
            for (const id of reference) expect(toolId.has(id), `${one.slug} ${id}`).toBe(true);
            expect(new Set(one.exampleToolId).size, one.slug).toBe(one.exampleToolId.length);
            expect(new Set(one.relatedToolId).size, one.slug).toBe(one.relatedToolId.length);
            for (const id of one.exampleToolId) expect(example.has(id), `${one.slug} example ${id}`).toBe(true);
        }
    });

    it("fixes the frozen tool participation of each guide", () => {
        const stepTool = (slug: string) => getTaskGuide(slug)!.step.flatMap(step => step.toolId ? [step.toolId] : []);
        expect(stepTool("assemble-pdf-packet")).toEqual(["split-pdf", "images-to-pdf", "merge-pdf", "compress-pdf"]);
        expect(stepTool("prepare-image-for-upload")).toEqual(["image-converter", "image-resizer", "image-compressor"]);
        expect(stepTool("heic-photos-to-pdf")).toEqual(["heic-converter", "images-to-pdf"]);
        expect(stepTool("pdf-pages-for-slides")).toEqual(["pdf-to-image", "image-resizer"]);
        expect(getTaskGuide("assemble-pdf-packet")!.exampleToolId).toEqual(["split-pdf", "merge-pdf"]);
        expect(getTaskGuide("prepare-image-for-upload")!.exampleToolId).toEqual(["image-resizer", "image-compressor"]);
        expect(getTaskGuide("prepare-image-for-upload")!.relatedToolId).toEqual(["image-converter", "image-resizer", "image-compressor"]);
    });

    it("duplicates no registry fact: no tool name, tool path or category label is stored", () => {
        const text = JSON.stringify(getAllTaskGuide());
        for (const tool of tool_definition_list) {
            expect(text, tool.name).not.toContain(tool.name);
            expect(text, tool.seo.canonicalPath).not.toContain(tool.seo.canonicalPath);
        }
        expect(text).not.toContain("/tool/");
    });

    it("never promises what the tools cannot do", () => {
        const text = JSON.stringify(getAllTaskGuide());
        expect(text).not.toMatch(/guarantee[sd]? (?:smaller|lossless|acceptance)|always (?:smaller|accepted)|\b\d+% (?:smaller|savings)/i);
        expect(text).toMatch(/signature/i);
        expect(text).toMatch(/not.*upload|nothing is uploaded|rule is an example|illustrative|does not come from any real upload form/i);
    });
});

describe("task guide queries", () => {
    it("returns undefined for an unknown or malformed slug", () => {
        for (const slug of ["", "unknown", "ASSEMBLE-PDF-PACKET", "assemble-pdf-packet/", "../assemble-pdf-packet", "__proto__"]) expect(getTaskGuide(slug), slug).toBeUndefined();
    });

    it("finds a guide by slug", () => {
        for (const [index, slug] of SLUG.entries()) expect(getTaskGuide(slug)?.title).toBe(TITLE[index]);
    });

    it("returns the guides a tool takes part in, in stable order, and none for unrelated tools", () => {
        const slugOf = (id: string) => getTaskGuideForTool(id).map(one => one.slug);
        expect(slugOf("split-pdf")).toEqual(["assemble-pdf-packet"]);
        expect(slugOf("merge-pdf")).toEqual(["assemble-pdf-packet"]);
        expect(slugOf("compress-pdf")).toEqual(["assemble-pdf-packet"]);
        expect(slugOf("images-to-pdf")).toEqual(["assemble-pdf-packet", "heic-photos-to-pdf"]);
        expect(slugOf("image-resizer")).toEqual(["prepare-image-for-upload", "pdf-pages-for-slides"]);
        expect(slugOf("image-converter")).toEqual(["prepare-image-for-upload"]);
        expect(slugOf("image-compressor")).toEqual(["prepare-image-for-upload"]);
        expect(slugOf("heic-converter")).toEqual(["heic-photos-to-pdf"]);
        expect(slugOf("pdf-to-image")).toEqual(["pdf-pages-for-slides"]);
        for (const id of ["calculator", "json-formatter", "slugify", "qr-code-generator", "not-a-tool"]) expect(slugOf(id), id).toEqual([]);
    });

    it("links nine of the 18 tools and leaves the other nine unpromoted", () => {
        const linked = tool_definition_list.filter(tool => getTaskGuideForTool(tool.id).length > 0).map(tool => tool.id);
        expect(linked.sort()).toEqual(["compress-pdf", "heic-converter", "image-compressor", "image-converter", "image-resizer", "images-to-pdf", "merge-pdf", "pdf-to-image", "split-pdf"].sort());
    });

    it("hands out copies so a caller cannot corrupt the shared records", () => {
        const first = getAllTaskGuide();
        first[0].title = "Changed";
        first[0].step.pop();
        first[0].limitation.length = 0;
        getTaskGuide("heic-photos-to-pdf")!.relatedToolId.push("calculator");
        getTaskGuideForTool("merge-pdf")[0].verification.length = 0;
        const fresh = getAllTaskGuide();
        expect(fresh[0].title).toBe(TITLE[0]);
        expect(fresh[0].step.length).toBeGreaterThanOrEqual(4);
        expect(fresh[0].limitation.length).toBeGreaterThan(0);
        expect(getTaskGuide("heic-photos-to-pdf")!.relatedToolId).toEqual(["heic-converter", "images-to-pdf"]);
        expect(getTaskGuideForTool("merge-pdf")[0].verification.length).toBeGreaterThan(0);
    });
});


describe("legacy guide routes", () => {
    async function redirectOf(run: () => Promise<unknown>): Promise<{ digest: string } | undefined> {
        try { await run(); } catch (error) { return error as { digest: string }; }
        return undefined;
    }

    it("permanently redirects each former manual guide to the workflow with the same slug, from both the page and its metadata", async () => {
        const { default: GuideDetailPage, generateMetadata } = await import("@/app/guide/[slug]/page");
        for (const slug of SLUG) {
            const expected = `NEXT_REDIRECT;replace;/workflows/${slug};308;`;
            expect((await redirectOf(() => GuideDetailPage({ params: Promise.resolve({ slug }) })))?.digest, `page ${slug}`).toBe(expected);
            expect((await redirectOf(() => generateMetadata({ params: Promise.resolve({ slug }) })))?.digest, `metadata ${slug}`).toBe(expected);
        }
    });

    it("keeps unknown, malformed and differently cased slugs as 404 with no metadata and no redirect", async () => {
        const { default: GuideDetailPage, generateMetadata } = await import("@/app/guide/[slug]/page");
        for (const slug of ["unknown", "", "ASSEMBLE-PDF-PACKET", "assemble-pdf-packet/", "../assemble-pdf-packet", "__proto__", "assemble-pdf-packet?x=1"]) {
            const failure = await redirectOf(() => GuideDetailPage({ params: Promise.resolve({ slug }) }));
            expect(failure?.digest ?? "", slug).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
            expect(await generateMetadata({ params: Promise.resolve({ slug }) }), slug).toEqual({});
        }
    });

    it("keeps the authored manual records available as source data after the public route is superseded", () => {
        expect(getAllTaskGuide().map(guide => guide.slug)).toEqual(SLUG);
        for (const guide of getAllTaskGuide()) {
            expect(guide.step.length).toBeGreaterThan(0);
            expect(guide.verification.length).toBeGreaterThan(0);
            expect(guide.limitation.length).toBeGreaterThan(0);
        }
    });
});

describe("guide hub route", () => {
    it("builds the unbranded finder title with the site suffix exactly once and the /guide canonical", async () => {
        const { metadata } = await import("@/app/guide/page");
        expect(metadata.title).toBe("Find the Right Tool or Workflow - iworkhere");
        expect(String(metadata.title).match(/iworkhere/g)).toHaveLength(1);
        expect(metadata.alternates?.canonical).toBe("https://iworkhere.space/guide");
        expect(String(metadata.description).length).toBeGreaterThan(50);
    });

    it("renders one H1, the root choice group and plain discovery links without scripts, ads or manual-guide links", async () => {
        const { renderToStaticMarkup } = await import("react-dom/server");
        const { default: GuideHubPage } = await import("@/app/guide/page");
        const html = renderToStaticMarkup(GuideHubPage());
        expect(html.match(/<h1/g)).toHaveLength(1);
        expect(html).toContain("Find the Right Tool or Workflow");
        expect(html).toContain("What do you need to do?");
        for (const label of ["Image", "PDF", "Text", "Converters", "Developer", "Math", "Time"]) expect(html).toContain(`>${label}</button>`);
        expect(html).toContain('href="/discover"');
        expect(html).toContain('href="/workflows"');
        expect(html).not.toContain("/guide/");
        expect(html).not.toMatch(/adsbygoogle|<script|type="file"|<form/);
    });
});