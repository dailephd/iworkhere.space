import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { test, expect } from "./support/fixture";
import manifest043 from "../../public/examples/v0.4.3/manifest.json";
import manifest044 from "../../public/examples/v0.4.4/manifest.json";
import { inspectCompressedArtifact } from "../compressPdfVerification";
import { inspectImagePdf } from "../imagesToPdfVerification";
import { referencePdfRaster } from "../pdfToImageVerification";

/* Independent expectations: slugs, titles, tools and routes are typed here, not read back from the production owners. */
interface GuideCase { slug: string; title: string; tool: string[]; category: string }
const GUIDE: GuideCase[] = [
    { slug: "assemble-pdf-packet", title: "Assemble an Ordered PDF Packet", tool: ["split-pdf", "images-to-pdf", "merge-pdf", "compress-pdf"], category: "document" },
    { slug: "prepare-image-for-upload", title: "Prepare an Image for an Upload", tool: ["image-converter", "image-resizer", "image-compressor"], category: "image" },
    { slug: "heic-photos-to-pdf", title: "Turn HEIC Photos into a PDF", tool: ["heic-converter", "images-to-pdf"], category: "image" },
    { slug: "pdf-pages-for-slides", title: "Prepare PDF Pages for Slides", tool: ["pdf-to-image", "image-resizer"], category: "document" },
];
const TOOL = ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf", "slugify", "calculator", "length-converter", "html-text-extractor", "weight-converter", "time-arithmetic", "image-resizer", "image-compressor", "image-converter", "heic-converter", "json-formatter", "word-character-counter", "qr-code-generator"];
const CATEGORY = ["document", "text", "math", "converter", "time", "image", "developer"];
const FIXED = ["/", "/discover", "/privacy", "/about", "/contact"];
const GUIDE_FOR_TOOL: Record<string, string[]> = {
    "split-pdf": ["assemble-pdf-packet"], "merge-pdf": ["assemble-pdf-packet"], "compress-pdf": ["assemble-pdf-packet"],
    "images-to-pdf": ["assemble-pdf-packet", "heic-photos-to-pdf"], "image-converter": ["prepare-image-for-upload"],
    "image-resizer": ["prepare-image-for-upload", "pdf-pages-for-slides"], "image-compressor": ["prepare-image-for-upload"],
    "heic-converter": ["heic-photos-to-pdf"], "pdf-to-image": ["pdf-pages-for-slides"],
};
const SITE_TITLE_SUFFIX = " - iworkhere";
/** Set from the reproduced result of the prepare-image-for-upload workflow; that test records the measured bytes as an annotation. */
const EXPECTED_UPLOAD_RULE_MET = true;
const manifest = { asset: [...manifest043.asset, ...manifest044.asset] };
const sample = (file: string) => path.resolve("public/examples", file);
const metaContent = (html: string, name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("guide routes, metadata and discovery", () => {
    test("the hub and each guide server-render one H1, aligned metadata and no advertising", async ({ request }) => {
        const descriptionSeen = new Set<string>();
        const route: [string, string][] = [["/guide", "Practical File Workflows"], ...GUIDE.map((guide): [string, string] => [`/guide/${guide.slug}`, guide.title])];
        for (const [route_, title] of route) {
            const response = await request.get(route_);
            expect(response.status(), route_).toBe(200);
            const html = await response.text();
            expect(html.match(/<title>([^<]*)<\/title>/g), route_).toEqual([`<title>${title}${SITE_TITLE_SUFFIX}</title>`]);
            expect(html.match(/<h1[ >]/g), `${route_} has one top-level heading`).toHaveLength(1);
            expect(html, route_).toContain(`<h1 class="text-3xl font-semibold text-text">${title}</h1>`);
            const description = metaContent(html, "description")!;
            expect(description.length, route_).toBeGreaterThan(60);
            expect(descriptionSeen.has(description), `${route_} description is unique`).toBe(false);
            descriptionSeen.add(description);
            expect(html, route_).toContain(`<link rel="canonical" href="https://iworkhere.space${route_}"/>`);
            expect(html, route_).toContain(`<meta property="og:description" content="${description}"/>`);
            expect(metaContent(html, "robots"), `${route_} is crawlable in the production build`).toBe("index, follow");
            expect(html, route_).not.toMatch(/adsbygoogle|google-adsense"|Advertisement|pagead/);
            expect(html.slice(html.indexOf("<main"), html.indexOf("</main>")), route_).not.toMatch(/undefined|NaN|\[object/);
        }
    });

    test("an unknown guide slug is a real 404 with noindex, no ad and no sitemap entry", async ({ request }) => {
        for (const slug of ["unknown-guide", "ASSEMBLE-PDF-PACKET", "assemble-pdf-packet-2"]) {
            const response = await request.get(`/guide/${slug}`);
            expect(response.status(), slug).toBe(404);
            const html = await response.text();
            const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map(match => match[1]);
            expect(robots.length, slug).toBeGreaterThan(0);
            for (const value of robots) expect(value, slug).toContain("noindex");
            expect(html).not.toMatch(/adsbygoogle|Advertisement/);
        }
        const sitemap = await (await request.get("/sitemap.xml")).text();
        expect(sitemap).not.toContain("unknown-guide");
    });

    test("the sitemap lists exactly 35 unique canonical URLs, with the hub and four guides added", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        const location = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        const expected = [
            ...FIXED, ...TOOL.map(slug => `/tool/${slug}`), ...CATEGORY.map(category => `/category/${category}`), "/guide", ...GUIDE.map(guide => `/guide/${guide.slug}`),
        ].map(value => `https://iworkhere.space${value}`);
        expect(location).toHaveLength(35);
        expect(new Set(location).size).toBe(35);
        expect([...location].sort()).toEqual([...expected].sort());
        for (const value of location) expect(value).not.toMatch(/[?#]|dashboard|api\/|examples/);
    });

    test("primary navigation is Home, All tools, Guides, the seven categories in order, then About", async ({ page }) => {
        await page.goto("/");
        const link = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link");
        expect(await link.evaluateAll(list => list.map(item => item.getAttribute("href")))).toEqual(["/", "/discover", "/guide", ...CATEGORY.map(category => `/category/${category}`), "/about"]);
        expect(await link.evaluateAll(list => list.map(item => item.textContent?.trim()))).toEqual(["Home", "All tools", "Guides", "Document", "Text", "Math", "Converters", "Time", "Image", "Developer", "About"]);
    });

    test("Guides in the navigation opens the hub, shows it as current and leads to every guide and back", async ({ page }) => {
        await page.goto("/");
        const navigation = page.getByRole("navigation", { name: "Primary navigation" });
        await navigation.getByRole("link", { name: "Guides", exact: true }).click();
        await expect(page).toHaveURL(/\/guide$/);
        await expect(page.getByRole("heading", { level: 1, name: "Practical File Workflows" })).toBeVisible();
        await expect(navigation.getByRole("link", { name: "Guides", exact: true })).toHaveAttribute("aria-current", "page");
        for (const guide of GUIDE) {
            const card = page.locator(`[data-guide="${guide.slug}"]`);
            await expect(card.getByRole("heading", { level: 2 })).toHaveText(guide.title);
            for (const field of ["Start with", "You end with", "Main limit"]) await expect(card.getByText(field, { exact: true })).toBeVisible();
            expect(await card.locator('a[href^="/tool/"]').evaluateAll(list => list.map(item => item.getAttribute("href"))).then(list => list.sort())).toEqual(guide.tool.map(slug => `/tool/${slug}`).sort());
            await card.getByRole("link", { name: guide.title, exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`/guide/${guide.slug}$`));
            await expect(page.getByRole("heading", { level: 1, name: guide.title })).toBeVisible();
            await page.goBack();
            await expect(page.getByRole("heading", { level: 1, name: "Practical File Workflows" })).toBeVisible();
        }
        await page.goForward();
        await expect(page).toHaveURL(/\/guide\/pdf-pages-for-slides$/);
        await page.reload();
        await expect(page.getByRole("heading", { level: 1, name: "Prepare PDF Pages for Slides" })).toBeVisible();
    });

    test("the home page keeps five featured tasks and the 18-tool catalog and shows the four workflows between them", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-featured-task]")).toHaveCount(5);
        await expect(page.getByRole("main").locator('a.catalog-card[href^="/tool/"]')).toHaveCount(18);
        const workflow = page.locator("[data-workflow-section]");
        await expect(workflow.getByRole("heading", { level: 2, name: "Practical file workflows" })).toBeVisible();
        expect(await workflow.locator("a").evaluateAll(list => list.map(item => item.getAttribute("href")))).toEqual(GUIDE.map(guide => `/guide/${guide.slug}`));
        const top = (locator: Locator) => locator.evaluate(element => element.getBoundingClientRect().top + scrollY);
        const position = [await top(page.locator("[data-featured-task-section]")), await top(workflow), await top(page.locator("a.catalog-card").first())];
        expect(position[0]).toBeLessThan(position[1]);
        expect(position[1]).toBeLessThan(position[2]);
        await workflow.getByRole("link", { name: GUIDE[2].title, exact: true }).click();
        await expect(page).toHaveURL(/\/guide\/heic-photos-to-pdf$/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(GUIDE[2].title);
    });

    test("only the document and image categories link their guides, and every other category links none", async ({ page }) => {
        for (const category of CATEGORY) {
            await page.goto(`/category/${category}`);
            const expected = GUIDE.filter(guide => guide.category === category).map(guide => `/guide/${guide.slug}`);
            expect(await page.getByRole("main").locator('a[href^="/guide/"]').evaluateAll(list => list.map(item => item.getAttribute("href"))), category).toEqual(expected);
        }
        await page.goto("/category/document");
        await page.getByRole("main").getByRole("link", { name: /Assemble an Ordered PDF Packet/ }).click();
        await expect(page).toHaveURL(/\/guide\/assemble-pdf-packet$/);
    });

    test("each of the 18 tool pages links exactly its participating guides, after the guidance, and nine have none", async ({ page }) => {
        for (const slug of TOOL) {
            await page.goto(`/tool/${slug}`);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            const section = page.locator("section[data-task-guide-link]");
            const expected = (GUIDE_FOR_TOOL[slug] ?? []).map(value => `/guide/${value}`);
            await expect(section).toHaveCount(expected.length ? 1 : 0);
            expect(await page.getByRole("main").locator('a[href^="/guide/"]').evaluateAll(list => list.map(item => item.getAttribute("href"))), slug).toEqual(expected);
            if (!expected.length) continue;
            await expect(section.getByRole("heading", { level: 2, name: "Use this tool in a workflow" })).toBeVisible();
            const order = await page.evaluate(() => {
                const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top + scrollY;
                return [top('section[aria-label="Tool guide"]'), top("section[data-task-guide-link]")];
            });
            expect(order[0], `${slug}: workflow links follow the tool guidance`).toBeLessThan(order[1]);
            await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
        }
        await page.goto("/tool/merge-pdf");
        await page.locator("section[data-task-guide-link]").getByRole("link").first().click();
        await expect(page).toHaveURL(/\/guide\/assemble-pdf-packet$/);
        await page.goBack();
        await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(sample("v0.4.4/merge-pdf/source-001.pdf"));
        await expect(page.getByRole("list", { name: "PDF merge order" }).getByRole("listitem")).toHaveCount(1);
        await page.reload();
        await expect(page.getByLabel("Choose PDFs", { exact: true })).toBeEnabled();
    });

    for (const guide of GUIDE) {
        test(`${guide.slug}: readable structure, working links, verified sample files and no eager download`, async ({ page, request }) => {
            const requested: string[] = [];
            const downloaded: string[] = [];
            page.on("request", item => requested.push(item.url()));
            page.on("download", item => downloaded.push(item.suggestedFilename()));
            await page.goto(`/guide/${guide.slug}`, { waitUntil: "networkidle" });
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(250);
            expect(downloaded, "nothing downloads without a visitor action").toEqual([]);
            expect(requested.filter(url => /\/examples\//.test(url)), "no sample is fetched on load").toEqual([]);
            expect(requested.filter(url => /pdfjs|pdfLib|qpdf|heic-to|pdf\.worker|\.wasm|\/vendor\//i.test(url)), "no tool engine loads for reading").toEqual([]);

            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            const article = page.getByRole("article");
            await expect(article).toHaveCount(1);
            for (const heading of ["Steps", "Worked examples", "How to check the result yourself", "Limits to know", "Tools used in this guide"]) await expect(article.getByRole("heading", { level: 2, name: heading })).toBeVisible();
            const step = article.locator("ol > li");
            expect(await step.count()).toBeGreaterThanOrEqual(4);
            await expect(article.getByText("you select it again yourself")).toBeVisible();
            await expect(article.locator("time")).toHaveAttribute("datetime", "2026-10-27");
            expect(await noOverflow(page)).toBe(true);
            await expect(page.locator("ins.adsbygoogle, script[src*='adsbygoogle'], aside[aria-label*='advertising']")).toHaveCount(0);

            const stepTool = await step.locator('a[href^="/tool/"]').evaluateAll(list => list.map(item => item.getAttribute("href")));
            expect(stepTool).toEqual(guide.tool.map(slug => `/tool/${slug}`).filter(href => stepTool.includes(href)));
            expect(new Set(stepTool).size).toBe(stepTool.length);

            // The fixed header must not cover the page heading after navigation.
            await page.evaluate(() => window.scrollTo(0, 0));
            const clearance = await page.evaluate(() => {
                const heading = document.querySelector("h1")!.getBoundingClientRect(), header = document.querySelector("header")!.getBoundingClientRect();
                return heading.top - header.bottom;
            });
            expect(clearance).toBeGreaterThanOrEqual(-1);

            // Every link resolves, every sample link serves its recorded bytes and every download link is same-origin.
            const href = [...new Set(await article.locator("a[href]").evaluateAll(list => list.map(item => item.getAttribute("href")!)))];
            for (const value of href) {
                expect(value, "no empty or placeholder anchor").toMatch(/^\/(?:tool|examples)\/[a-z0-9./-]+$/);
                const response = await request.get(value);
                expect(response.status(), value).toBe(200);
                if (value.startsWith("/examples/")) {
                    const recorded = manifest.asset.find(item => `/${item.path.slice("public/".length)}` === value);
                    expect(recorded, `${value} is a recorded example file`).toBeDefined();
                    const body = await response.body();
                    expect(body.length, value).toBe(recorded!.bytes);
                    expect(createHash("sha256").update(body).digest("hex"), value).toBe(recorded!.sha256);
                }
            }
            const sampleLink = article.locator("a[download]");
            expect(await sampleLink.count()).toBeGreaterThan(0);
            for (const item of await sampleLink.all()) await expect(item).toHaveAccessibleName(/^Download (source|result) (PDF|PNG|JPEG|WebP|HEIC): [\w.-]+ \(.*\d[\d,]* bytes\)$/);

            // Keyboard: the first link in the steps is reachable and shows a focus indicator.
            const first = step.locator("a").first();
            await first.focus();
            await expect(first).toBeFocused();
            const outline = await first.evaluate(element => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
            expect(outline.style).not.toBe("none");
            expect(outline.width).toBeGreaterThan(0);

            const pending = page.waitForEvent("download");
            await sampleLink.first().click();
            const file = await pending;
            expect(file.suggestedFilename()).toMatch(/\.(pdf|png|jpg|heic)$/);
            expect(page.url()).toContain(`/guide/${guide.slug}`);
        });
    }
});

/* ---- Complete workflows, operating the real tools. Every handoff is an actual browser download selected again by hand. ---- */

interface Saved { file: string; name: string; bytes: Uint8Array }
// Downloads go to a short temporary directory: the long per-test output path exceeds the Windows 260-character limit when a file is selected again.
let work = "";
test.beforeEach(async () => { work = await mkdtemp(path.join(tmpdir(), "g-")); });
test.afterEach(async () => { await rm(work, { recursive: true, force: true }); });
async function save(page: Page, link: Locator, _info: TestInfo, folder: string, rename?: string): Promise<Saved> {
    const pending = page.waitForEvent("download");
    await link.click();
    const download = await pending;
    const name = rename ?? download.suggestedFilename();
    await mkdir(path.join(work, folder), { recursive: true });
    const file = path.join(work, folder, name);
    await download.saveAs(file);
    return { file, name, bytes: new Uint8Array(await readFile(file)) };
}
const label = (page: { text: string }) => (JSON.parse(page.text) as string[][])[0]?.[0];
function mediaType(bytes: Uint8Array): string {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    return "unknown";
}
interface Decoded { width: number; height: number; pixel: number[][] }
async function decode(page: Page, bytes: Uint8Array, point: number[][] = [[0, 0]]): Promise<Decoded> {
    return page.evaluate(async ({ data, point }) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        try {
            const context = canvas.getContext("2d")!; context.fillStyle = "#12ab34"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
            return { width: bitmap.width, height: bitmap.height, pixel: point.map(([x, y]) => [...context.getImageData(Math.min(x, bitmap.width - 1), Math.min(y, bitmap.height - 1), 1, 1).data]) };
        } finally { bitmap.close(); }
    }, { data: [...bytes], point });
}
const near = (actual: number[], expected: number[], tolerance: number) => expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);

async function imageFilterOfEachPage(bytes: Uint8Array): Promise<string[]> {
    const document = await PDFDocument.load(bytes);
    return document.getPages().map(page => {
        const resources = page.node.Resources()!;
        const xobject = resources.lookup(PDFName.of("XObject"), PDFDict);
        const [, reference] = xobject.entries()[0];
        const stream = document.context.lookup(reference as PDFRef) as unknown as { dict: PDFDict };
        return String(stream.dict.get(PDFName.of("Filter")));
    });
}

test.describe("reproduced guide workflows", () => {
    test.setTimeout(240_000);

    test("assemble-pdf-packet: split, convert a picture page, merge by hand in a chosen order, then try compression", async ({ page }, info) => {
        // 1. Split PDF: source pages P1..P4; one group "3,1" gives P3 then P1.
        await page.goto("/tool/split-pdf");
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(sample("v0.4.4/split-pdf/source.pdf"));
        await page.getByLabel("Pages for output group 1", { exact: true }).fill("3,1");
        await page.getByRole("button", { name: "Split PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Split PDFs ready", exact: true })).toBeVisible();
        const part = await save(page, page.getByRole("link", { name: "Download output group 1", exact: true }), info, "split");
        const partPage = await inspectCompressedArtifact(part.bytes);
        expect(partPage.map(label)).toEqual(["P3", "P1"]);

        // 2. Images to PDF: one PNG becomes a one-page PDF, 400 x 300 points.
        await page.goto("/tool/images-to-pdf");
        await page.getByLabel("Choose JPEG or PNG images", { exact: true }).setInputFiles(sample("v0.4.3/images-to-pdf/source-001.png"));
        await page.getByRole("button", { name: "Create PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "PDF ready", exact: true })).toBeVisible();
        const picture = await save(page, page.getByRole("link", { name: "Download PDF", exact: true }), info, "picture");
        const picturePage = await inspectImagePdf(picture.bytes);
        expect(picturePage).toHaveLength(1);
        expect([picturePage[0].width, picturePage[0].height]).toEqual([400, 300]);

        // 3. Merge PDF: the three prepared files are selected by hand, in the wrong order, then fixed with Move up.
        const second = sample("v0.4.4/merge-pdf/source-002.pdf");
        await page.goto("/tool/merge-pdf");
        await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles([part.file, second, picture.file]);
        const order = page.getByRole("list", { name: "PDF merge order" }).getByRole("listitem");
        await expect(order).toHaveCount(3);
        await page.getByRole("button", { name: `Move up PDF 3: ${picture.name}`, exact: true }).press("Enter");
        await expect(order.nth(0)).toContainText(part.name);
        await expect(order.nth(1)).toContainText(picture.name);
        await expect(order.nth(2)).toContainText("source-002.pdf");
        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Merged PDF ready", exact: true })).toBeVisible();
        const packet = await save(page, page.getByRole("link", { name: "Download merged PDF", exact: true }), info, "packet");

        // Independent check of the downloaded packet: page count, visible order and unchanged page content.
        const finalPage = await inspectCompressedArtifact(packet.bytes);
        const secondPage = await inspectCompressedArtifact(new Uint8Array(await readFile(second)));
        expect(finalPage).toHaveLength(2 + 1 + 3);
        expect(finalPage.map(label)).toEqual(["P3", "P1", undefined, "B1", "B2", "B3"]);
        [...partPage, ...(await inspectCompressedArtifact(picture.bytes)), ...secondPage].forEach((expected, index) => {
            expect(finalPage[index].raster, `packet page ${index + 1} renders like its source page`).toBe(expected.raster);
            expect([finalPage[index].width, finalPage[index].height]).toEqual([expected.width, expected.height]);
        });

        // 4. Compress PDF last: either branch is truthful. A download appears only for a smaller file and keeps every page.
        await page.goto("/tool/compress-pdf");
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(packet.file);
        await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
        const smaller = page.getByRole("heading", { name: "Smaller PDF ready", exact: true });
        const none = page.getByRole("heading", { name: "NO REDUCTION ACHIEVED", exact: true });
        await expect(smaller.or(none)).toBeVisible();
        if (await smaller.isVisible()) {
            const small = await save(page, page.getByRole("link", { name: "Download compressed PDF", exact: true }), info, "compressed");
            expect(small.bytes.length).toBeLessThan(packet.bytes.length);
            expect((await inspectCompressedArtifact(small.bytes)).map(label)).toEqual(["P3", "P1", undefined, "B1", "B2", "B3"]);
            info.annotations.push({ type: "compress-branch", description: `smaller: ${packet.bytes.length} -> ${small.bytes.length} bytes` });
        } else {
            await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);
            info.annotations.push({ type: "compress-branch", description: `no reduction for the ${packet.bytes.length}-byte packet; the packet stays as it is` });
        }
    });

    test("prepare-image-for-upload: a 960 x 640 JPEG is resized, then compressed, and the final file is checked against the example rule", async ({ page }, info) => {
        const LIMIT = { type: "image/jpeg", width: 800, height: 600, bytes: 100_000 };
        const source = new Uint8Array(await readFile(sample("v0.4.4/image-compressor/source.jpg")));
        expect([mediaType(source), source.length]).toEqual(["image/jpeg", 141_841]);

        await page.goto("/tool/image-resizer");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(sample("v0.4.4/image-compressor/source.jpg"));
        await page.getByLabel("Width", { exact: true }).fill("800");
        await expect(page.getByLabel("Height", { exact: true })).toHaveValue("533");
        await page.getByRole("button", { name: "Resize image", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Resized image ready", exact: true })).toBeVisible();
        const resized = await save(page, page.getByRole("link", { name: "Download resized image", exact: true }), info, "resized");
        const resizedFact = { type: mediaType(resized.bytes), ...(await decode(page, resized.bytes)), bytes: resized.bytes.length };
        expect([resizedFact.type, resizedFact.width, resizedFact.height]).toEqual(["image/jpeg", 800, 533]);

        await page.goto("/tool/image-compressor");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(resized.file);
        await page.getByLabel("Quality", { exact: true }).fill("40");
        await page.getByRole("button", { name: "Compress image", exact: true }).click();
        const ready = page.getByRole("heading", { name: "Compressed image ready", exact: true });
        const unchanged = page.getByRole("heading", { name: "No smaller file produced", exact: true });
        await expect(ready.or(unchanged)).toBeVisible();
        let final = resized;
        if (await ready.isVisible()) final = await save(page, page.getByRole("link", { name: "Download compressed image", exact: true }), info, "compressed");
        else await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);

        // The decision comes from the file itself, never from the input fields or a success message.
        const fact = { type: mediaType(final.bytes), ...(await decode(page, final.bytes)), bytes: final.bytes.length };
        const meets = fact.type === LIMIT.type && fact.width <= LIMIT.width && fact.height <= LIMIT.height && fact.bytes <= LIMIT.bytes;
        info.annotations.push({ type: "upload-rule", description: `resized ${resizedFact.bytes} bytes; final ${fact.type} ${fact.width}x${fact.height} ${fact.bytes} bytes; meets rule: ${meets}` });
        expect(fact.type).toBe("image/jpeg");
        expect(fact.width).toBeLessThanOrEqual(LIMIT.width);
        expect(fact.height).toBeLessThanOrEqual(LIMIT.height);
        expect(fact.bytes, "the compressor never returns a larger file").toBeLessThanOrEqual(resizedFact.bytes);
        expect(meets, `final file is ${fact.bytes} bytes against the ${LIMIT.bytes}-byte example limit`).toBe(EXPECTED_UPLOAD_RULE_MET);
    });

    test("prepare-image-for-upload: converting a transparent PNG to JPEG flattens transparency and keeps the pixel size", async ({ page }, info) => {
        await page.goto("/tool/image-converter");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(sample("v0.4.3/image-converter/source.png"));
        await page.getByLabel("Output format", { exact: true }).selectOption("jpeg");
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Converted image ready", exact: true })).toBeVisible();
        const converted = await save(page, page.getByRole("link", { name: "Download converted image", exact: true }), info, "converted");
        expect(mediaType(converted.bytes)).toBe("image/jpeg");
        const decoded = await decode(page, converted.bytes, [[0, 0], [5, 315]]);
        expect([decoded.width, decoded.height]).toEqual([480, 320]);
        for (const pixel of decoded.pixel) expect(near(pixel, [255, 255, 255, 255], 3), `transparent corner became white: ${pixel}`).toBe(true);
        expect(converted.bytes.length).toBeLessThanOrEqual(100_000);
    });

    test("heic-photos-to-pdf: two HEIC conversions, one at a time, then an ordered PDF checked page by page", async ({ page }, info) => {
        const heic = sample("v0.4.4/heic-converter/source.heic");
        const photo: Saved[] = [];
        for (const [index, format] of (["jpeg", "png"] as const).entries()) {
            await page.goto("/tool/heic-converter");
            await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles(heic);
            await page.getByLabel("Output format", { exact: true }).selectOption(format);
            await page.getByRole("button", { name: "Convert image", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Converted image ready", exact: true })).toBeVisible();
            photo.push(await save(page, page.getByRole("link", { name: "Download converted image", exact: true }), info, `photo-${index + 1}`, `photo-0${index + 1}.${format === "jpeg" ? "jpg" : "png"}`));
        }
        expect(photo.map(item => mediaType(item.bytes))).toEqual(["image/jpeg", "image/png"]);
        const point = [[5, 5], [360, 5], [5, 240]];
        const decoded = [await decode(page, photo[0].bytes, point), await decode(page, photo[1].bytes, point)];
        for (const value of decoded) expect([value.width, value.height]).toEqual([480, 320]);

        // Images to PDF accepts only JPEG and PNG: the HEIC file itself is refused there.
        await page.goto("/tool/images-to-pdf");
        const input = page.getByLabel("Choose JPEG or PNG images", { exact: true });
        await input.setInputFiles(photo.map(item => item.file));
        const order = page.getByRole("list", { name: "Image page order" }).getByRole("listitem");
        await expect(order).toHaveCount(2);
        await page.getByRole("button", { name: "Move down image 1: photo-01.jpg", exact: true }).press("Enter");
        await expect(order.nth(0)).toContainText("photo-02.png");
        await page.getByRole("button", { name: "Move up image 2: photo-01.jpg", exact: true }).press("Enter");
        await expect(order.nth(0)).toContainText("photo-01.jpg");
        await page.getByRole("button", { name: "Create PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "PDF ready", exact: true })).toBeVisible();
        const pdf = await save(page, page.getByRole("link", { name: "Download PDF", exact: true }), info, "pdf");

        const finalPage = await inspectImagePdf(pdf.bytes);
        expect(finalPage).toHaveLength(2);
        finalPage.forEach((value, index) => {
            expect([value.width, value.height], `page ${index + 1} takes its image size`).toEqual([480, 320]);
            decoded[index].pixel.forEach((pixel, at) => expect(near(value.pixel[at], pixel, index === 0 ? 40 : 3), `page ${index + 1} sample ${at}: ${value.pixel[at]} vs ${pixel}`).toBe(true));
        });
        expect(await imageFilterOfEachPage(pdf.bytes), "page 1 embeds the JPEG and page 2 the PNG").toEqual(["/DCTDecode", "/FlateDecode"]);

        // A HEIC file cannot be picked in the PDF tool.
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await input.setInputFiles(heic);
        await expect(page.getByRole("main").getByRole("alert")).toContainText("not valid");
        await expect(order).toHaveCount(0);
    });

    test("pdf-pages-for-slides: selected pages become PNGs of the right identity, orientation and size, then one is resized", async ({ page }, info) => {
        const pdf = new Uint8Array(await readFile(sample("v0.4.3/pdf-to-image/source.pdf")));
        await page.goto("/tool/pdf-to-image");
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(sample("v0.4.3/pdf-to-image/source.pdf"));
        await page.getByLabel("Pages to convert", { exact: true }).fill("1,2");
        await page.getByLabel("Output format", { exact: true }).selectOption("png");
        await page.getByLabel("Resolution (DPI)", { exact: true }).selectOption("150");
        await page.getByRole("button", { name: "Convert pages", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeVisible();
        const image = [
            await save(page, page.getByRole("link", { name: "Download page 1", exact: true }), info, "slide"),
            await save(page, page.getByRole("link", { name: "Download page 2", exact: true }), info, "slide"),
        ];
        expect(image.map(item => mediaType(item.bytes))).toEqual(["image/png", "image/png"]);

        // Page 2 is stored rotated, so its image is landscape. Compare size and flat page content with an independent PDF.js render.
        for (const [index, item] of image.entries()) {
            const reference = await referencePdfRaster(pdf, index + 1, 150);
            const decoded = await decode(page, item.bytes, reference.sample.map(value => [value.x, value.y]));
            expect([decoded.width, decoded.height], `page ${index + 1} size`).toEqual([reference.width, reference.height]);
            reference.sample.forEach((value, at) => expect(near(decoded.pixel[at], value.pixel, 10), `page ${index + 1} sample ${at}`).toBe(true));
        }
        const dimension = [await decode(page, image[0].bytes), await decode(page, image[1].bytes)];
        expect([dimension[0].width, dimension[0].height]).toEqual([625, 834]);
        expect([dimension[1].width, dimension[1].height]).toEqual([834, 625]);
        expect(dimension[1].width).toBeGreaterThan(dimension[1].height);
        expect(image[0].bytes).not.toEqual(image[1].bytes);

        // Image Resizer: a deliberately selected page image is made smaller with its aspect ratio kept.
        await page.goto("/tool/image-resizer");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image[0].file);
        await page.getByLabel("Width", { exact: true }).fill("400");
        await page.getByRole("button", { name: "Resize image", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Resized image ready", exact: true })).toBeVisible();
        const small = await save(page, page.getByRole("link", { name: "Download resized image", exact: true }), info, "slide-small");
        expect(mediaType(small.bytes)).toBe("image/png");
        const smallFact = await decode(page, small.bytes);
        expect(smallFact.width).toBe(400);
        expect(Math.abs(smallFact.height - (834 * 400) / 625)).toBeLessThanOrEqual(1);
    });
});
