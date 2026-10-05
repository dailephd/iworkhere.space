import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

test("document registry discovery, search, initial SEO/guides and 23 canonical sitemap URLs", async ({ page, request }) => {
    for (const [slug, name, related] of [["merge-pdf", "Merge PDF", "split-pdf"], ["split-pdf", "Split PDF", "merge-pdf"]]) {
        const html = await (await request.get(`/tool/${slug}`)).text();
        expect(html).toContain(`<h1`); expect(html).toContain(name); expect(html).toContain("How to use");
        expect(html).toContain("Static-page fidelity"); expect(html).toContain("PDF processing happens locally");
        expect(html).toContain("Related document tools"); expect(html).toContain(`href="/tool/${related}"`);
        expect(html).toContain(`rel="canonical" href="https://iworkhere.space/tool/${slug}"`);
        expect(html).toContain(`property="og:url" content="https://iworkhere.space/tool/${slug}"`);
        expect(html).toContain('aria-label="Breadcrumb"'); expect(html).toContain('href="/category/document"');
        await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" }); await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    }
    await page.goto("/category/document", { waitUntil: "networkidle" }); const category = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(category).toHaveCount(5); await expect(category).toContainText(["Merge PDF", "Split PDF", "Images to PDF", "PDF to JPG / PNG", "Compress PDF"]);
    await page.goto("/", { waitUntil: "networkidle" });
    const other = page.getByRole("region", { name: "All other tools" });
    for (const slug of ["merge-pdf", "split-pdf"]) await expect(other.locator(`a[href="/tool/${slug}"]`)).toHaveCount(1);
    await page.goto("/discover", { waitUntil: "networkidle" }); await page.getByLabel("Search", { exact: true }).fill("pdf");
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(5);
    const xml = await (await request.get("/sitemap.xml")).text(); expect(xml.match(/<loc>/g)).toHaveLength(23);
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
        await expect(page.getByRole("main").locator("a[download]")).toHaveCount(0); await noOverflow(page);
    }
});
