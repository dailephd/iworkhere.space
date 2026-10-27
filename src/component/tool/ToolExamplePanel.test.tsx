// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "../../../public/examples/v0.4.3/manifest.json";
import manifest044 from "../../../public/examples/v0.4.4/manifest.json";
import { getAllValueExample, getValueExample, type ValueExample } from "@/module/tool/valueExamples";
import { ToolExamplePanel } from "./ToolExamplePanel";

const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
const ADDED = ["merge-pdf", "split-pdf", "image-compressor", "heic-converter"];
const WITH_EXAMPLE = [...FEATURED, ...ADDED];
const MEDIA_LABEL: Record<string, string> = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP", "image/heic": "HEIC" };
const PREVIEWABLE = ["image/png", "image/jpeg", "image/webp"];
// Measured facts come from whichever immutable manifest owns the file.
const ALL_ASSET = [...manifest.asset, ...manifest044.asset];

function render(example: ValueExample): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<ToolExamplePanel example={example} />);
    return host;
}
function exampleOf(toolId: string): ValueExample {
    const example = getValueExample(toolId);
    if (!example) throw new Error(`Missing example for ${toolId}`);
    return example;
}
const fileName = (url: string) => url.slice(url.lastIndexOf("/") + 1);
const assetOf = (example: ValueExample) => [...example.source, ...example.output];
const itemFor = (host: HTMLElement, url: string) => host.querySelector(`a[href="${url}"]`)!.closest("li")!;

describe("ToolExamplePanel", () => {
    it("has a record for exactly the nine tools with a worked example, five of them featured on the home page", () => {
        expect(getAllValueExample().map(example => example.toolId)).toEqual(WITH_EXAMPLE);
        expect(getAllValueExample().filter(example => example.featuredOnHome).map(example => example.toolId)).toEqual(FEATURED);
    });

    describe.each(WITH_EXAMPLE)("%s", toolId => {
        const example = exampleOf(toolId);

        it("is one labelled section with a single H2 and no H1", () => {
            const host = render(example);
            const section = host.querySelectorAll("section");
            expect(section).toHaveLength(1);
            const heading = host.querySelectorAll("h2");
            expect(heading).toHaveLength(1);
            expect(heading[0].textContent).toBe("Worked example");
            expect(section[0].getAttribute("aria-labelledby")).toBe(heading[0].id);
            expect(host.querySelectorAll("h1")).toHaveLength(0);
        });

        it("shows the record text without adding other claims", () => {
            const text = render(example).textContent ?? "";
            for (const value of [example.task, example.whyThisTool, example.outcome, example.provenance.permission, ...example.changed, ...example.unchanged, ...example.limitation]) {
                expect(text).toContain(value);
            }
            for (const operation of example.operation) {
                expect(text).toContain(operation.summary);
                for (const step of operation.reproduction) expect(text).toContain(step);
            }
            // The panel adds no ZIP claim of its own; a record may state that there is no ZIP file (Split PDF).
            const recordText = [example.task, example.whyThisTool, example.outcome, ...example.changed, ...example.unchanged, ...example.limitation].join(" ");
            expect(text.match(/zip/gi)?.length ?? 0).toBe(recordText.match(/zip/gi)?.length ?? 0);
        });

        it("shows each file's measured facts exactly as the manifest records them", () => {
            const host = render(example);
            for (const asset of assetOf(example)) {
                const recorded = ALL_ASSET.find(value => value.path === asset.path)!;
                const text = itemFor(host, asset.url).textContent ?? "";
                expect(text).toContain(fileName(asset.url));
                expect(text).toContain(MEDIA_LABEL[recorded.mediaType]);
                expect(text).toContain(`${recorded.bytes.toLocaleString("en-US")} bytes`);
                if (recorded.width !== undefined) expect(text).toContain(`${recorded.width} × ${recorded.height} px`);
                if (recorded.pageCount !== undefined) expect(text).toMatch(new RegExp(`Pages\\s*${recorded.pageCount}`));
                (recorded.page ?? []).forEach((page, index) => {
                    expect(text).toContain(`Page ${index + 1}`);
                    expect(text).toContain(`${page.width} × ${page.height} pt, rotation ${page.rotation}°`);
                });
            }
        });

        it("links only to the record's same-origin example files, each visitor-initiated and uniquely named", () => {
            const host = render(example);
            const link = [...host.querySelectorAll("a")];
            expect(link.map(value => value.getAttribute("href")).sort()).toEqual(assetOf(example).map(value => value.url).sort());
            for (const value of link) {
                const href = value.getAttribute("href")!;
                expect(href.startsWith("/examples/v0.4.3/") || href.startsWith("/examples/v0.4.4/")).toBe(true);
                expect(href).not.toMatch(/^[a-z]+:|^\/\//i);
                expect(value.getAttribute("download")).toBe(fileName(href));
                expect(value.getAttribute("data-example-asset")).toMatch(/^(source|output)$/);
                expect(value.getAttribute("type")).toBe(ALL_ASSET.find(asset => asset.path === `public${href}`)!.mediaType);
                expect(value.textContent).toMatch(/^Download (source|result) (PDF|PNG|JPEG|WebP|HEIC): /);
                expect(value.textContent).toContain(fileName(href));
            }
            const name = link.map(value => value.textContent);
            expect(new Set(name).size).toBe(name.length);
        });

        it("previews only images, at their recorded size, lazily and with alt text", () => {
            const host = render(example);
            const image = [...host.querySelectorAll("img")];
            // HEIC is offered for download only: browsers cannot display it, so it is never an inline image.
            const expected = assetOf(example).filter(asset => PREVIEWABLE.includes(asset.mediaType));
            expect(image.map(value => value.getAttribute("src")).sort()).toEqual(expected.map(asset => asset.url).sort());
            for (const value of image) {
                const asset = expected.find(item => item.url === value.getAttribute("src"))!;
                expect(value.getAttribute("width")).toBe(String(asset.width));
                expect(value.getAttribute("height")).toBe(String(asset.height));
                expect(value.getAttribute("loading")).toBe("lazy");
                expect(value.getAttribute("data-example-asset")).toBe(asset.role);
                expect(value.getAttribute("alt")).toBe(asset.description);
                expect(value.closest("figure")?.querySelector("figcaption")?.textContent).toContain(`${asset.bytes.toLocaleString("en-US")} bytes`);
            }
            expect(host.querySelectorAll("iframe, embed, object, video, audio")).toHaveLength(0);
        });

        it("describes what each image depicts, in both its alt text and its caption, not just its file facts", () => {
            const host = render(example);
            const image = [...host.querySelectorAll("img")];
            const alt = image.map(value => value.getAttribute("alt")!);
            for (const value of image) {
                const text = value.getAttribute("alt")!;
                const asset = assetOf(example).find(item => item.url === value.getAttribute("src"))!;
                expect(text.length, text).toBeGreaterThan(40);
                expect(text).toBe(asset.description);
                expect(text).not.toMatch(/^Preview of|\.(?:png|jpe?g|webp)\b|\bbytes\b|\bpixels\b/i);
                expect(value.closest("figure")!.querySelector("figcaption")!.textContent).toContain(text);
            }
            expect(new Set(alt).size, "each image has its own description").toBe(alt.length);
        });

        it("names each PDF and HEIC download by what the file contains, uniquely", () => {
            const host = render(example);
            const pdf = assetOf(example).filter(asset => !PREVIEWABLE.includes(asset.mediaType));
            for (const asset of pdf) {
                const link = host.querySelector(`a[href="${asset.url}"]`)!;
                expect(link.textContent).toContain(`(${asset.description})`);
                expect(link.textContent).toContain(fileName(asset.url));
                expect(itemFor(host, asset.url).textContent).toContain(`${asset.description[0].toUpperCase()}${asset.description.slice(1)}.`);
            }
        });

        it("is static content with no scripts, controls, advertising or external host", () => {
            const host = render(example);
            expect(host.querySelectorAll("script, button, input, select, textarea, form, dialog, ins, aside")).toHaveLength(0);
            expect(host.innerHTML).not.toMatch(/https?:\/\//i);
            expect(host.innerHTML).not.toMatch(/\bonclick\b|javascript:/i);
        });
    });

    it("reports the verified Compress PDF saving for that example only", () => {
        const example = exampleOf("compress-pdf");
        const source = manifest.asset.find(value => value.path.endsWith("compress-pdf/source.pdf"))!;
        const processed = manifest.asset.find(value => value.path.endsWith("compress-pdf/processed.pdf"))!;
        const text = render(example).textContent ?? "";
        expect(text).toContain("2,631 bytes");
        expect(text).toContain("1,878 bytes");
        expect(source.bytes - processed.bytes).toBe(753);
        expect(text).toContain("753 bytes");
        expect(text).toContain("Other PDFs may shrink by more, less or not at all.");
    });

    it("distinguishes visually similar results by the verified output difference", () => {
        const converter = exampleOf("image-converter");
        const [source] = converter.source;
        const [jpeg, webp] = converter.output;
        expect(source.description).toContain("transparent background");
        expect(jpeg.description).toContain("solid white background");
        expect(jpeg.description).toContain("JPEG cannot store transparency");
        expect(webp.description).toContain("transparent background");
        expect(webp.description).toContain("WebP can store transparency");
        const resizer = exampleOf("image-resizer");
        expect(resizer.output[0].description).toContain("half the width and height");
        const pdfToImage = exampleOf("pdf-to-image");
        expect(pdfToImage.output[1].description).toContain("landscape");
        expect(pdfToImage.output[1].description).toContain("rotated 90 degrees");
    });

    it("keeps the per-tool facts the batch requires visible", () => {
        const pdfToImage = render(exampleOf("pdf-to-image")).textContent ?? "";
        expect(pdfToImage).toContain(`Enter 1 in "Pages to convert".`);
        expect(pdfToImage).toContain("150 DPI");
        expect(pdfToImage).toContain("90 degree rotation");
        const imagesToPdf = render(exampleOf("images-to-pdf")).textContent ?? "";
        expect(imagesToPdf).toContain("no paper-size, margin, crop or layout controls");
        const resizer = render(exampleOf("image-resizer")).textContent ?? "";
        expect(resizer).toContain("800 × 600 px");
        expect(resizer).toContain("400 × 300 px");
        expect(resizer).toContain("A smaller image does not always mean a smaller file.");
        const converter = render(exampleOf("image-converter")).textContent ?? "";
        expect(converter).toContain("flattened onto white");
        expect(converter).toContain("keeps its transparency");
    });

    it("offers the HEIC source as a download-only upstream file, never as an inline image", () => {
        const host = render(exampleOf("heic-converter"));
        expect(host.querySelectorAll("img")).toHaveLength(2);
        expect([...host.querySelectorAll("img")].map(value => value.getAttribute("src")).sort()).toEqual(["/examples/v0.4.4/heic-converter/converted.jpg", "/examples/v0.4.4/heic-converter/converted.png"]);
        const link = host.querySelector('a[href="/examples/v0.4.4/heic-converter/source.heic"]')!;
        expect(link.getAttribute("type")).toBe("image/heic");
        expect(link.getAttribute("download")).toBe("source.heic");
        expect(link.textContent).toMatch(/^Download source HEIC: source\.heic \(.+\)$/);
        const text = host.textContent ?? "";
        expect(text).toContain("not project-authored");
        expect(text).toContain("MIT");
        expect(text).toContain("480 × 320 px");
        expect(text).toContain("No HEIC transparency guarantee is made");
    });

    it("keeps the per-tool facts of the four new examples visible", () => {
        const merge = render(exampleOf("merge-pdf")).textContent ?? "";
        expect(merge).toContain(`Under "Choose PDFs", choose source-001.pdf then source-002.pdf.`);
        expect(merge).toContain("A1, A2, B1, B2 and B3");
        expect(merge).toContain("Page 5");
        const split = render(exampleOf("split-pdf")).textContent ?? "";
        expect(split).toContain(`Enter 3,1 in "Pages for output group 1".`);
        expect(split).toContain(`Press "Add output group".`);
        expect(split).toContain(`Enter 2-3 in "Pages for output group 2".`);
        expect(split).toContain("Download output group 2");
        expect(split).toContain("3-1 is rejected");
        const compressor = render(exampleOf("image-compressor")).textContent ?? "";
        expect(compressor).toContain(`Move the "Quality" slider to 40.`);
        expect(compressor).toContain("not a typical rate");
        expect(compressor).toContain("No smaller file produced");
    });

    it("stays a Server Component without client state or processing imports", () => {
        const source = readFileSync("src/component/tool/ToolExamplePanel.tsx", "utf8");
        expect(source).not.toMatch(/["']use client["']/);
        expect(source).not.toMatch(/useState|useEffect|useRef|useReducer|onClick|fetch\(|Worker|canvas/i);
        expect(source).not.toMatch(/from\s+["'](?!@\/module\/tool\/valueExamples["'])[^"']+["']/);
    });
});
