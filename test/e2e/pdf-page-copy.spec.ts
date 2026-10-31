import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { test, expect } from "./support/fixture";

const fixture = (name: string) => path.resolve(`test/fixtures/pdf/${name}.pdf`);
interface PdfSemanticPage { width: number; height: number; rotation: number; text: string }
async function inspect(bytes: Uint8Array): Promise<PdfSemanticPage[]> {
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useSystemFonts: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/" });
    const document = await task.promise;
    try {
        const result: PdfSemanticPage[] = [];
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index), viewport = page.getViewport({ scale: 1, rotation: 0 });
            const content = await page.getTextContent();
            result.push({ width: viewport.width, height: viewport.height, rotation: page.rotate, text: content.items.map(value => "str" in value ? value.str : "").join(" ") });
            page.cleanup();
        }
        return result;
    } finally { await task.destroy(); }
}
async function download(page: Page, info: TestInfo, label: string, expected: PdfSemanticPage[], filename: string) {
    const pending = page.waitForEvent("download");
    await page.getByRole("link", { name: label, exact: true }).click();
    const output = await pending; expect(output.suggestedFilename()).toBe(filename);
    const destination = info.outputPath(filename); await output.saveAs(destination);
    expect(await inspect(await readFile(destination))).toEqual(expected);
}
async function observe(page: Page) {
    const requests: string[] = [];
    page.context().on("request", request => {
        if (request.url().startsWith("http")) { requests.push(request.method()); expect(request.method(), "PDF payload must never be uploaded").toBe("GET"); }
    });
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[], workers: [] as string[] };
        Object.assign(window, { pdfToolResources: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = value => { const url = create(value); log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
        const NativeWorker = Worker;
        window.Worker = class extends NativeWorker {
            constructor(url: string | URL, option?: WorkerOptions) { super(url, option); log.workers.push(String(url)); }
        };
    });
    return requests;
}
const resources = (page: Page) => page.evaluate(() => (window as unknown as { pdfToolResources: { created: string[]; revoked: string[]; workers: string[] } }).pdfToolResources);
// Files chosen before hydration can be dropped silently (the container run lost ten files this way); Themes enables once hydrated.
async function waitForHydration(page: Page) { await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled(); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test("Merge: real ordered local PDFs, keyboard controls, verified download and lifecycle", async ({ page }, info) => {
    const requests = await observe(page);
    await page.goto("/tool/merge-pdf");
    const input = page.getByLabel("Choose PDFs", { exact: true });
    await input.setInputFiles([fixture("ordering"), fixture("mixed-dimensions"), fixture("rotated")]);
    const list = page.getByRole("list", { name: "PDF merge order" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list.getByRole("listitem").nth(0)).toContainText("ordering.pdf");
    const down = page.getByRole("button", { name: "Move down PDF 1: ordering.pdf", exact: true });
    await down.focus(); await down.press("Enter");
    await expect(list.getByRole("listitem").nth(0)).toContainText("mixed-dimensions.pdf");
    await page.getByRole("button", { name: "Move up PDF 2: ordering.pdf", exact: true }).press("Enter");
    const action = page.getByRole("button", { name: "Merge PDF", exact: true }); await expect(action).toBeEnabled();
    await action.focus(); await action.press("Enter");
    await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeFocused();
    const expected = (await Promise.all(["ordering", "mixed-dimensions", "rotated"].map(async name => inspect(await readFile(fixture(name)))))).flat();
    await download(page, info, "Download merged PDF", expected, "ordering-merged.pdf");
    await noOverflow(page); await page.screenshot({ path: info.outputPath("merge-success.png"), fullPage: true });
    await page.getByRole("button", { name: "Move down PDF 1: ordering.pdf", exact: true }).click();
    await expect(page.getByRole("link", { name: "Download merged PDF" })).toHaveCount(0);
    expect((await resources(page)).revoked).toHaveLength(1);
    await action.click(); await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click(); await expect(input).toBeFocused();
    await expect(list.getByRole("listitem")).toHaveCount(0); await expect(action).toBeDisabled();
    const log = await resources(page); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    expect(requests.length).toBeGreaterThan(0);
    await info.attach("merge-local-evidence", { body: JSON.stringify({ pages: expected.length, methods: [...new Set(requests)], resources: log }), contentType: "application/json" });
});

test("Split: multiple ordered groups, overlap, verified individual downloads and invalidation", async ({ page }, info) => {
    await observe(page); await page.goto("/tool/split-pdf");
    const input = page.getByLabel("Choose PDF", { exact: true }); await input.setInputFiles(fixture("ordering"));
    const first = page.getByLabel("Pages for output group 1", { exact: true }); await first.fill("1-3");
    const add = page.getByRole("button", { name: "Add output group", exact: true }); await add.focus(); await add.press("Enter");
    const second = page.getByLabel("Pages for output group 2", { exact: true }); await expect(second).toBeFocused(); await second.fill("3,1,3");
    const action = page.getByRole("button", { name: "Split PDF", exact: true }); await action.press("Enter");
    await expect(page.getByRole("heading", { name: "Split PDFs ready" })).toBeFocused();
    const result = page.getByRole("region", { name: "Split PDFs ready" }); await expect(result.getByRole("link")).toHaveCount(2);
    const source = await inspect(await readFile(fixture("ordering")));
    await download(page, info, "Download output group 1", source.slice(0, 3), "ordering-split-01-pages-1-3.pdf");
    await download(page, info, "Download output group 2", [source[2], source[0]], "ordering-split-02-pages-3_1.pdf");
    await noOverflow(page); await page.screenshot({ path: info.outputPath("split-success.png"), fullPage: true });
    await second.fill("2"); await expect(result).toHaveCount(0); expect((await resources(page)).revoked).toHaveLength(2);
    await action.click(); await expect(result).toBeVisible(); await input.setInputFiles(fixture("mixed-dimensions"));
    await expect(result).toHaveCount(0); await expect(first).toHaveValue(""); await expect(second).toHaveCount(0); await expect(action).toBeDisabled();
    await first.fill("1"); await action.click(); await expect(result).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click(); await expect(input).toBeFocused();
    const log = await resources(page); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    await info.attach("split-local-evidence", { body: JSON.stringify(log), contentType: "application/json" });
});

test("document registry discovery, search, initial SEO/guides and 36 canonical sitemap URLs", async ({ page, request }) => {
    for (const [slug, name, related] of [["merge-pdf", "Merge PDF", "split-pdf"], ["split-pdf", "Split PDF", "merge-pdf"]]) {
        const html = await (await request.get(`/tool/${slug}`)).text();
        expect(html).toContain(`<h1`); expect(html).toContain(name); expect(html).toContain("How to use");
        expect(html).toContain("Static-page fidelity"); expect(html).toContain("Your PDF is processed in this browser");
        expect(html).toContain("Related tools"); expect(html).toContain(`href="/tool/${related}"`);
        expect(html).toContain(`rel="canonical" href="https://iworkhere.space/tool/${slug}"`);
        expect(html).toContain(`property="og:url" content="https://iworkhere.space/tool/${slug}"`);
        expect(html).toContain('aria-label="Breadcrumb"'); expect(html).toContain('href="/category/document"');
        await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" }); await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    }
    await page.goto("/category/document", { waitUntil: "networkidle" }); const category = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(category).toHaveCount(5); await expect(category).toContainText(["Merge PDF", "Split PDF", "Images to PDF", "PDF to JPG / PNG", "Compress PDF"]);
    await page.goto("/", { waitUntil: "networkidle" });
    const other = page.getByRole("region", { name: "PDF Tools", exact: true });
    for (const slug of ["merge-pdf", "split-pdf"]) await expect(other.locator(`a[href="/tool/${slug}"]`)).toHaveCount(1);
    await page.goto("/discover", { waitUntil: "networkidle" }); await page.getByLabel("Search", { exact: true }).fill("pdf");
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(5);
    const xml = await (await request.get("/sitemap.xml")).text(); expect(xml.match(/<loc>/g)).toHaveLength(36); expect(xml.split("<loc>https://iworkhere.space/workflows</loc>")).toHaveLength(2);
    for (const route of ["/tool/merge-pdf", "/tool/split-pdf", "/category/document"]) expect(xml.split(`<loc>https://iworkhere.space${route}</loc>`)).toHaveLength(2);
    expect(xml).not.toMatch(/vercel\.app|<loc>[^<]*[?#]/);
});

test("cold Home, Discover and image tool keep heavy PDF runtimes absent", async ({ page }, info) => {
    const evidence: Record<string, string[]> = {};
    await observe(page);
    for (const route of ["/", "/discover", "/tool/image-converter"]) {
        const url: string[] = [];
        const script: Promise<string>[] = [];
        const capture = (request: import("@playwright/test").Request) => { url.push(request.url()); };
        const response = (response: import("@playwright/test").Response) => {
            if (response.request().resourceType() === "script") script.push(response.text());
        };
        page.context().on("request", capture);
        page.context().on("response", response);
        await page.goto(route, { waitUntil: "networkidle" });
        expect((await resources(page)).workers).toEqual([]);
        expect(url.filter(value => /vendor\/(pdfjs|qpdf)|pdf-lib|pdfLib_worker|qpdf_worker|pdfjs-dist/i.test(value))).toEqual([]);
        const payload = await Promise.all(script);
        expect(payload.filter(value => /Invalid factory url:|Trying to parse invalid object:|Failed to parse PDF document|createQpdfModule/.test(value)), "No heavy PDF engine code in cold script responses").toEqual([]);
        page.context().off("request", capture); page.context().off("response", response); evidence[route] = url;
    }
    await info.attach("cold-route-pdf-isolation", { body: JSON.stringify(evidence), contentType: "application/json" });
});

test("encrypted/malformed PDFs remain bounded accessible errors", async ({ page }) => {
    for (const slug of ["merge-pdf", "split-pdf"]) {
        await page.goto(`/tool/${slug}`); const input = page.getByLabel(slug === "merge-pdf" ? "Choose PDFs" : "Choose PDF", { exact: true });
        await input.setInputFiles(fixture("encrypted")); const alert = page.getByRole("main").getByRole("alert");
        await expect(alert).toContainText("Encrypted or password-protected"); await expect(alert).toBeFocused();
        await input.setInputFiles(fixture("invalid-body")); await expect(alert).toContainText("could not be parsed safely");
        // The tool offers no result download after an error. The page's worked-example links are separate, marked data-example-asset and visitor-initiated.
        await expect(page.getByRole("main").locator("a[download]:not([data-example-asset])")).toHaveCount(0); await noOverflow(page);
    }
});

// Boundary evidence for the documented Merge and Split limits. Synthetic PDFs are generated in memory
// (nothing is uploaded and no large fixture is committed); every produced file is judged by PDF.js text
// extraction, which is independent of the application's own verification.
const MIB = 1024 * 1024;
const NEWLINE = String.fromCharCode(10);
async function syntheticPdf(label: string, pages: number, exactSize?: number): Promise<Buffer> {
    const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica);
    for (let index = 1; index <= pages; index++) document.addPage([200, 200]).drawText(`${label}-P${String(index).padStart(3, "0")}`, { x: 20, y: 100, size: 14, font });
    const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
    if (exactSize === undefined) return bytes;
    expect(bytes.length, "synthetic PDF must fit inside its requested padded size").toBeLessThan(exactSize);
    // Trailing comment bytes after %%EOF pad the file to an exact byte count without changing its pages.
    return Buffer.concat([bytes, Buffer.from(`${NEWLINE}%`), Buffer.alloc(exactSize - bytes.length - 2, 0x20)]);
}
const named = (name: string, buffer: Buffer) => ({ name, mimeType: "application/pdf", buffer });
const labels = (label: string, pages: number) => Array.from({ length: pages }, (_, index) => `${label}-P${String(index + 1).padStart(3, "0")}`);
async function downloadedText(page: Page, info: TestInfo, link: string, filename: string): Promise<string[]> {
    const pending = page.waitForEvent("download");
    await page.getByRole("link", { name: link, exact: true }).click();
    const output = await pending; expect(output.suggestedFilename()).toBe(filename);
    const destination = info.outputPath(filename); await output.saveAs(destination);
    return (await inspect(await readFile(destination))).map(value => value.text.trim());
}
const mergeList = (page: Page) => page.getByRole("list", { name: "PDF merge order" }).getByRole("listitem");
async function expectRejected(page: Page, message: string, names: string[]) {
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText(message); await expect(alert).toBeFocused();
    // Rejection is atomic: the previously accepted files stay, in order, and nothing new completed.
    await expect(mergeList(page)).toHaveCount(names.length);
    for (const [index, name] of names.entries()) await expect(mergeList(page).nth(index)).toContainText(name);
    await expect(page.getByRole("link", { name: "Download merged PDF" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toHaveCount(0);
}

test.describe("Merge PDF limit boundaries", () => {
    test.setTimeout(180_000);
    test("10-file collection: 10 merge in order, an 11th and an over-count batch are rejected atomically", async ({ page }, info) => {
        await observe(page); await page.goto("/tool/merge-pdf"); await waitForHydration(page);
        const input = page.getByLabel("Choose PDFs", { exact: true });
        const names = Array.from({ length: 10 }, (_, index) => `f${String(index + 1).padStart(2, "0")}.pdf`);
        await input.setInputFiles(await Promise.all(names.map(async (name, index) => named(name, await syntheticPdf(`F${String(index + 1).padStart(2, "0")}`, 1)))));
        await expect(mergeList(page)).toHaveCount(10);
        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeFocused();
        expect(await downloadedText(page, info, "Download merged PDF", "f01-merged.pdf")).toEqual(names.flatMap((_, index) => labels(`F${String(index + 1).padStart(2, "0")}`, 1)));
        await input.setInputFiles(named("f11.pdf", await syntheticPdf("F11", 1)));
        await expectRejected(page, "Merge accepts at most 10 PDFs", names);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await input.setInputFiles(await Promise.all(names.slice(0, 9).map(async (name, index) => named(name, await syntheticPdf(`F${String(index + 1).padStart(2, "0")}`, 1)))));
        await expect(mergeList(page)).toHaveCount(9);
        await input.setInputFiles([named("x1.pdf", await syntheticPdf("X1", 1)), named("x2.pdf", await syntheticPdf("X2", 1))]);
        await expectRejected(page, "Merge accepts at most 10 PDFs", names.slice(0, 9));
    });

    test("per-file 10 MiB: exactly 10 MiB merges, one extra byte is rejected without losing prior files", async ({ page }, info) => {
        await observe(page); await page.goto("/tool/merge-pdf"); await waitForHydration(page);
        const input = page.getByLabel("Choose PDFs", { exact: true });
        const exact = await syntheticPdf("BIG", 1, 10 * MIB);
        expect(exact.length).toBe(10 * MIB);
        await input.setInputFiles([named("exact-10mib.pdf", exact), named("small.pdf", await syntheticPdf("SM", 2))]);
        await expect(mergeList(page)).toHaveCount(2);
        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeFocused();
        expect(await downloadedText(page, info, "Download merged PDF", "exact-10mib-merged.pdf")).toEqual([...labels("BIG", 1), ...labels("SM", 2)]);
        const over = await syntheticPdf("OVER", 1, 10 * MIB + 1);
        expect(over.length).toBe(10 * MIB + 1);
        await input.setInputFiles([named("ok-before-over.pdf", await syntheticPdf("OK", 1)), named("over-10mib.pdf", over)]);
        await expectRejected(page, "exceeds the 10 MiB source limit", ["exact-10mib.pdf", "small.pdf"]);
    });

    test("aggregate 25 MiB: exactly 25 MiB merges, one extra byte is rejected without losing prior files", async ({ page }, info) => {
        await observe(page); await page.goto("/tool/merge-pdf"); await waitForHydration(page);
        const input = page.getByLabel("Choose PDFs", { exact: true });
        const first = await syntheticPdf("A", 1, 10 * MIB), second = await syntheticPdf("B", 1, 10 * MIB);
        await input.setInputFiles([named("a.pdf", first), named("b.pdf", second), named("c.pdf", await syntheticPdf("C", 1, 5 * MIB))]);
        await expect(mergeList(page)).toHaveCount(3);
        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeFocused();
        expect(await downloadedText(page, info, "Download merged PDF", "a-merged.pdf")).toEqual([...labels("A", 1), ...labels("B", 1), ...labels("C", 1)]);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await input.setInputFiles([named("a.pdf", first), named("b.pdf", second)]);
        await expect(mergeList(page)).toHaveCount(2);
        await input.setInputFiles(named("c-plus-one.pdf", await syntheticPdf("C", 1, 5 * MIB + 1)));
        await expectRejected(page, "The combined sources exceed 25 MiB", ["a.pdf", "b.pdf"]);
    });

    test("100-page output: 50 + 50 pages merge in order, one more page is rejected without losing prior files", async ({ page }, info) => {
        await observe(page); await page.goto("/tool/merge-pdf"); await waitForHydration(page);
        const input = page.getByLabel("Choose PDFs", { exact: true });
        await input.setInputFiles([named("front.pdf", await syntheticPdf("FRONT", 50)), named("back.pdf", await syntheticPdf("BACK", 50))]);
        await expect(mergeList(page)).toHaveCount(2);
        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeFocused();
        await expect(page.getByRole("status").filter({ hasText: "100 pages" })).toBeVisible();
        const text = await downloadedText(page, info, "Download merged PDF", "front-merged.pdf");
        expect(text).toHaveLength(100);
        expect(text).toEqual([...labels("FRONT", 50), ...labels("BACK", 50)]);
        await input.setInputFiles(named("one-more.pdf", await syntheticPdf("MORE", 1)));
        await expectRejected(page, "The combined sources exceed 100 pages", ["front.pdf", "back.pdf"]);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await input.setInputFiles([named("a.pdf", await syntheticPdf("A", 50)), named("b.pdf", await syntheticPdf("B", 51))]);
        const alert = page.getByRole("main").getByRole("alert");
        await expect(alert).toContainText("The combined sources exceed 100 pages");
        await expect(mergeList(page)).toHaveCount(0);
        await input.setInputFiles(named("single-101.pdf", await syntheticPdf("S", 101)));
        await expect(alert).toContainText("exceeds the 100-page limit"); await expect(mergeList(page)).toHaveCount(0);
    });
});

// Hosted Linux Chromium 153 delivered exactly ten download events per page and then no event for the eleventh click, on desktop and mobile
// (run 40590174147: link, blob href and filename intact, no page or console error). Downloads therefore run in two pages of the same
// browser context, ten per page; every one of the twenty clicks still has to produce its own download that is saved and read back.
const SPLIT_DOWNLOAD_PER_PAGE = 10;
const SPLIT_OUTPUT_DOWNLOAD_TIMEOUT_MS = 20_000;
const splitExpression = ["1-3", "5,2", "10-12,1", "25", ...Array.from({ length: 16 }, (_, index) => String(index + 5))];
const splitExpectedPage = [[1, 2, 3], [5, 2], [10, 11, 12, 1], [25], ...Array.from({ length: 16 }, (_, index) => [index + 5])];

async function splitTwentyGroups(page: Page, verifyLimit: boolean) {
    await observe(page); await page.goto("/tool/split-pdf"); await waitForHydration(page);
    await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(named("split-limit.pdf", await syntheticPdf("S", 25)));
    const add = page.getByRole("button", { name: "Add output group", exact: true });
    await page.getByLabel("Pages for output group 1", { exact: true }).fill(splitExpression[0]);
    for (let group = 2; group <= 20; group++) {
        await add.click();
        const field = page.getByLabel(`Pages for output group ${group}`, { exact: true });
        await expect(field).toBeFocused(); await field.fill(splitExpression[group - 1]);
    }
    await expect(page.getByLabel(/^Pages for output group \d+$/)).toHaveCount(20);
    if (verifyLimit) {
        await expect(add).toBeDisabled();
        await add.evaluate(element => (element as HTMLButtonElement).click());
        await expect(page.getByLabel("Pages for output group 21", { exact: true })).toHaveCount(0);
        await expect(page.getByLabel(/^Pages for output group \d+$/)).toHaveCount(20);
    }
    await page.getByRole("button", { name: "Split PDF", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Split PDFs ready" })).toBeFocused({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Split PDFs ready" }).getByRole("link")).toHaveCount(20);
}

async function verifySplitDownload(page: Page, info: TestInfo, group: number, completed: number[]) {
    const link = page.getByRole("link", { name: `Download output group ${group}`, exact: true });
    const pending = page.waitForEvent("download", { timeout: SPLIT_OUTPUT_DOWNLOAD_TIMEOUT_MS });
    // A missed event must name the group instead of consuming the whole-test deadline.
    const missed = pending.catch(async () => {
        const state = await resources(page);
        throw new Error(`No download event for output group ${group} after groups [${completed.join(",")}] completed on this page: `
            + `href scheme ${((await link.getAttribute("href")) ?? "").split(":")[0]}, created ${state.created.length}, revoked ${state.revoked.length}`);
    });
    await link.click();
    const output = await missed;
    expect(output.suggestedFilename()).toMatch(new RegExp(`^split-limit-split-${String(group).padStart(2, "0")}-pages-`));
    const destination = info.outputPath(output.suggestedFilename()); await output.saveAs(destination);
    const text = (await inspect(await readFile(destination))).map(value => value.text.trim());
    expect(text, `output group ${group} (${splitExpression[group - 1]})`).toEqual(splitExpectedPage[group - 1].map(value => `S-P${String(value).padStart(3, "0")}`));
    completed.push(group);
}

test("Split: 20 output groups are accepted, the 21st is refused, and every ordered download is independently verified", async ({ page }, info) => {
    test.setTimeout(120_000);
    await splitTwentyGroups(page, true);
    const completed: number[] = [];
    for (let group = 1; group <= SPLIT_DOWNLOAD_PER_PAGE; group++) await verifySplitDownload(page, info, group, completed);
    await noOverflow(page);

    const second = await page.context().newPage();
    const secondFailure: string[] = [];
    second.on("pageerror", error => secondFailure.push(`pageerror: ${error.message}`));
    second.on("console", message => { if (message.type() === "error") secondFailure.push(`console: ${message.text()}`); });
    await splitTwentyGroups(second, false);
    const secondCompleted: number[] = [];
    for (let group = SPLIT_DOWNLOAD_PER_PAGE + 1; group <= 20; group++) await verifySplitDownload(second, info, group, secondCompleted);
    await noOverflow(second);
    expect(secondFailure, "No page or console errors on the second Split page").toEqual([]);
    expect([...completed, ...secondCompleted]).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
});
