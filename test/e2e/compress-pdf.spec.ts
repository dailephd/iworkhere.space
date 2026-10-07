import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";
import { inspectCompressedArtifact } from "../compressPdfVerification";
const fixture = (name: string) => path.resolve(`test/fixtures/pdf/${name}.pdf`);
interface CompressionResource { created: string[]; revoked: string[]; started: number; active: number; worker: string[] }
async function observe(page: Page) {
    page.context().on("request", request => { if (request.url().startsWith("http")) { expect(request.method(), "Document bytes stay local").toBe("GET"); expect(new URL(request.url()).origin).toBe(new URL(page.url()).origin); } });
    await page.addInitScript(() => {
        const log: CompressionResource = { created: [], revoked: [], started: 0, active: 0, worker: [] }; Object.assign(window, { compressionResource: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), NativeWorker = Worker;
        URL.createObjectURL = blob => { const url = create(blob); if (blob instanceof Blob && blob.type === "application/pdf") log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
        window.Worker = class extends NativeWorker {
            ended = false;
            constructor(url: string | URL, option?: WorkerOptions) { super(url, option); log.started++; log.active++; log.worker.push(String(url)); }
            terminate() { if (!this.ended) { this.ended = true; log.active--; } super.terminate(); }
        };
    });
}
const resources = (page: Page) => page.evaluate(() => (window as unknown as { compressionResource: CompressionResource }).compressionResource);
for (const name of ["compression-text-vector", "compression-image-only"]) test(`Compress PDF: ${name} verified smaller download, actual savings and cleanup`, async ({ page }, info) => {
    await page.goto("/tool/compress-pdf"); await observe(page); await page.reload();
    expect((await resources(page)).worker).toEqual([]);
    const input = page.getByLabel("Choose PDF", { exact: true }), action = page.getByRole("button", { name: "Compress PDF", exact: true });
    await expect(action).toBeDisabled(); await input.setInputFiles(fixture(name)); await expect(action).toBeEnabled();
    expect((await resources(page)).worker.some(url => /qpdf/.test(url))).toBe(false);
    await action.press("Enter"); await expect(page.getByRole("heading", { name: "Smaller PDF ready" })).toBeFocused();
    const pending = page.waitForEvent("download"); await page.getByRole("link", { name: "Download compressed PDF", exact: true }).click(); const download = await pending;
    expect(download.suggestedFilename()).toBe(`${name}-compressed.pdf`); const destination = info.outputPath(download.suggestedFilename()); await download.saveAs(destination);
    const before = await readFile(fixture(name)), after = await readFile(destination);
    expect(after.length).toBeLessThan(before.length); const source = await inspectCompressedArtifact(before), output = await inspectCompressedArtifact(after); expect(output).toEqual(source);
    if (name === "compression-image-only") expect(source.every(page => page.text === "[]")).toBe(true);
    const saved = before.length - after.length, percentage = saved / before.length * 100;
    await expect(page.getByRole("region", { name: "Smaller PDF ready" })).toContainText(`${saved.toLocaleString()} bytes`); await expect(page.getByRole("region", { name: "Smaller PDF ready" })).toContainText(`${percentage.toFixed(2)}%`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath("compress-pdf-smaller.png"), fullPage: true });
    await info.attach("download-static-semantics", { body: JSON.stringify({ INPUT_BYTES: before.length, OUTPUT_BYTES: after.length, REDUCTION_BYTES: saved, REDUCTION_PERCENT: percentage, source, output }), contentType: "application/json" });
    await page.getByRole("button", { name: "Reset", exact: true }).press("Enter"); await expect(input).toBeFocused(); await expect(action).toBeDisabled(); await expect(page.locator("a[download]")).toHaveCount(0);
    const log = await resources(page); expect(log.created).toEqual(log.revoked.filter(url => log.created.includes(url))); expect(log.active).toBe(0); await info.attach("compression-lifecycle", { body: JSON.stringify(log), contentType: "application/json" });
});
test("Compress PDF: equal/larger candidates have honest no-reduction state without download", async ({ page }, info) => {
    await page.goto("/tool/compress-pdf"); await observe(page); await page.reload();
    for (const name of ["already-optimized", "jpeg-heavy", "png-heavy"]) {
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(fixture(name)); await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "NO REDUCTION ACHIEVED", exact: true })).toBeFocused(); await expect(page.locator("a[download]")).toHaveCount(0); await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0); await expect(page.getByRole("heading", { name: "Smaller PDF ready" })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect((await resources(page)).created).toEqual([]); expect((await resources(page)).active).toBe(0); await page.screenshot({ path: info.outputPath("compress-pdf-no-reduction.png"), fullPage: true });
});
test("Compress PDF: replacement and Reset cancel active worker without stale results", async ({ page }) => {
    await page.goto("/tool/compress-pdf"); await observe(page); await page.reload();
    const input = page.getByLabel("Choose PDF", { exact: true }), action = page.getByRole("button", { name: "Compress PDF", exact: true });
    await page.route("**/vendor/qpdf/12.4.2/qpdf.wasm", async route => { await new Promise(resolve => setTimeout(resolve, 500)); try { await route.continue(); } catch { /* Terminated worker request. */ } });
    for (const replacement of [true, false]) {
        await input.setInputFiles(fixture("compression-multipage")); await action.click(); await expect(page.getByRole("status")).toContainText("Compressing");
        if (replacement) { await input.setInputFiles(fixture("already-optimized")); await expect(action).toBeEnabled(); } else { await page.getByRole("button", { name: "Reset", exact: true }).click(); await expect(input).toBeFocused(); }
        await page.waitForTimeout(700); await expect(page.locator("a[download]")).toHaveCount(0); await expect(page.getByRole("heading", { name: "NO REDUCTION ACHIEVED" })).toHaveCount(0); await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0); expect((await resources(page)).active).toBe(0);
    }
});
test("Compress PDF: SSR guide, discovery, category and exact sitemap", async ({ page, request }) => {
    const html = await (await request.get("/tool/compress-pdf")).text();
    for (const text of ["Compress PDF", "Compress PDF structure locally", "How to use", "What this compression does", "No reduction is normal", "Supported PDFs and limits", "Fidelity boundary", "Local processing", "Related document tools", 'href="/category/document"']) expect(html).toContain(text);
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/compress-pdf"'); for (const name of ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image"]) expect(html).toContain(`href="/tool/${name}"`);
    await page.goto("/"); await expect(page.getByRole("region", { name: "All other tools" }).locator('a[href="/tool/compress-pdf"]')).toHaveCount(1);
    await page.goto("/discover"); await page.getByLabel("Search", { exact: true }).fill("compress pdf"); await expect(page.getByRole("main").locator('a[href="/tool/compress-pdf"]')).toHaveCount(1);
    await page.goto("/category/document"); await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(5);
    const xml = await (await request.get("/sitemap.xml")).text(); expect(xml.match(/<loc>/g)).toHaveLength(26); expect(xml.match(/<loc>https:\/\/iworkhere.space\/tool\/compress-pdf<\/loc>/g)).toHaveLength(1);
});
test("Compress PDF: cold unrelated routes request no PDF processing payload", async ({ browser }, info) => {
    for (const route of ["/", "/discover", "/tool/image-converter"]) {
        const context = await browser.newContext(), page = await context.newPage(), requests: string[] = [];
        context.on("request", request => requests.push(new URL(request.url()).pathname));
        await page.goto(route, { waitUntil: "networkidle" }); expect(requests.filter(url => /qpdf|pdf\.worker|pdfLib\.worker|pdfjs|pdfjs-dist/.test(url))).toEqual([]);
        await info.attach(`cold-${route.replaceAll("/", "-")}`, { body: JSON.stringify(requests), contentType: "application/json" }); await context.close();
    }
});
