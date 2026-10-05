import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "./support/fixture";
import { referencePdfRaster, type PdfRasterReference } from "../pdfToImageVerification";
import { detectImageFileFormat } from "../../src/module/tool/image/imageFile";
const fixture = (name: string) => path.resolve(`test/fixtures/pdf/${name}.pdf`);
interface ResourceLog { created: string[]; revoked: string[]; canvas: number; workers: string[] }
async function observe(page: Page) {
    page.context().on("request", request => { if (request.url().startsWith("http")) expect(request.method(), "PDF bytes must remain local").toBe("GET"); });
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[], canvas: 0, workers: [] as string[] }; Object.assign(window, { pdfImageResources: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), element = document.createElement.bind(document);
        URL.createObjectURL = blob => { const url = create(blob); log.created.push(url); return url; }; URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
        document.createElement = ((tag: string, options?: ElementCreationOptions) => { if (tag === "canvas") log.canvas++; return element(tag, options); }) as typeof document.createElement;
        const NativeWorker = Worker; window.Worker = class extends NativeWorker { constructor(url: string | URL, option?: WorkerOptions) { super(url, option); log.workers.push(String(url)); } };
    });
}
const resources = (page: Page) => page.evaluate(() => (window as unknown as { pdfImageResources: ResourceLog }).pdfImageResources);
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
async function downloadImage(page: Page, info: TestInfo, source: string, pageNumber: number, dpi: number, format: "png" | "jpeg") {
    const pending = page.waitForEvent("download"); await page.getByRole("link", { name: `Download page ${pageNumber}`, exact: true }).click(); const download = await pending;
    const filename = `${source}-page-${String(pageNumber).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "png"}`; expect(download.suggestedFilename()).toBe(filename);
    const destination = info.outputPath(filename); await download.saveAs(destination); const bytes = await readFile(destination); expect(detectImageFileFormat(bytes)).toBe(format);
    const reference = await referencePdfRaster(await readFile(fixture(source)), pageNumber, dpi);
    const actual = await page.evaluate(async ({ bytes, format, reference }) => {
        const blob = new Blob([new Uint8Array(bytes)], { type: `image/${format}` }), image = await createImageBitmap(blob);
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        try {
            const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
            const sample = reference.sample.map(point => [...context.getImageData(point.x, point.y, 1, 1).data]);
            const label = reference.label;
            return { width: image.width, height: image.height, mime: blob.type, sample, label: [...context.getImageData(label.x, label.y, label.width, label.height).data] };
        } finally { image.close(); canvas.width = 0; canvas.height = 0; }
    }, { bytes: [...bytes], format, reference });
    expect({ width: actual.width, height: actual.height, mime: actual.mime }).toEqual({ width: reference.width, height: reference.height, mime: `image/${format}` });
    const difference = actual.sample.flatMap((pixel, index) => pixel.map((value, channel) => Math.abs(value - reference.sample[index].pixel[channel])));
    expect(Math.max(...difference)).toBeLessThanOrEqual(format === "png" ? 0 : 4);
    expect(actual.sample[0][3]).toBe(255); expect(actual.sample[1]).toEqual([255, 255, 255, 255]);
    expect(actual.label.some(value => value < 128)).toBe(true);
    await info.attach(`page-${pageNumber}-${format}-native-verification`, { body: JSON.stringify({ filename, width: actual.width, height: actual.height, mime: actual.mime, sample: actual.sample, referenceSample: reference.sample, maximumChannelDifference: Math.max(...difference) }), contentType: "application/json" });
    return { actual, reference };
}
function rasterDifference(actual: number[], reference: PdfRasterReference) { return actual.reduce((sum, value, index) => sum + Math.abs(value - reference.label.pixel[index]), 0) / actual.length; }

test("PDF to image: reordered PNG downloads, independent visible page identity, local lifecycle and service worker", async ({ page }, info) => {
    await observe(page); await page.goto("/tool/pdf-to-image"); await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined)); await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const input = page.getByLabel("Choose PDF", { exact: true }); expect((await resources(page)).workers).toEqual([]);
    await input.setInputFiles(fixture("ordering")); await expect(page.getByLabel("Pages to convert")).toHaveValue("1");
    await page.getByLabel("Pages to convert").fill("3,1"); await expect(page.getByLabel("Output format")).toHaveValue("png"); await expect(page.getByLabel("Resolution (DPI)")).toHaveValue("150");
    const action = page.getByRole("button", { name: "Convert pages", exact: true }); await action.press("Enter"); await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeFocused();
    const result = page.getByRole("region", { name: "Page images ready", exact: true }); await expect(result.getByRole("link")).toHaveCount(2); await expect(result.getByRole("link")).toHaveText(["Download page 3", "Download page 1"]);
    const third = await downloadImage(page, info, "ordering", 3, 150, "png"), first = await downloadImage(page, info, "ordering", 1, 150, "png");
    // Comparing the page-number label against both independent references proves page identity despite rasterizer antialias differences.
    expect(rasterDifference(third.actual.label, third.reference)).toBeLessThan(rasterDifference(third.actual.label, first.reference));
    expect(rasterDifference(first.actual.label, first.reference)).toBeLessThan(rasterDifference(first.actual.label, third.reference));
    await noOverflow(page); await page.screenshot({ path: info.outputPath("pdf-to-image-png.png"), fullPage: true });
    await page.getByLabel("Pages to convert").fill("1"); await expect(result).toHaveCount(0); await action.click(); await expect(result).toBeVisible();
    await page.getByLabel("Resolution (DPI)").selectOption("72"); await expect(result).toHaveCount(0); await action.click(); await expect(result).toBeVisible();
    await page.getByLabel("Output format").selectOption("jpeg"); await expect(result).toHaveCount(0); await expect(page.getByLabel("JPEG quality")).toHaveValue("0.85");
    await action.click(); await expect(result).toBeVisible(); await page.getByLabel("JPEG quality").fill("0.5"); await expect(result).toHaveCount(0);
    await page.getByRole("button", { name: "Reset", exact: true }).press("Enter"); await expect(input).toBeFocused(); await expect(action).toBeDisabled();
    const log = await resources(page); expect(log.created.slice().sort()).toEqual(log.revoked.slice().sort()); expect(log.workers.some(value => value.endsWith("pdf.worker.mjs"))).toBe(true);
    await info.attach("pdf-image-local-lifecycle", { body: JSON.stringify(log), contentType: "application/json" });
});
test("PDF to image: rotated JPG native download and source replacement", async ({ page }, info) => {
    await observe(page); await page.goto("/tool/pdf-to-image"); const input = page.getByLabel("Choose PDF", { exact: true }); await input.setInputFiles(fixture("rotated"));
    await page.getByLabel("Output format").selectOption("jpeg"); await page.getByLabel("Resolution (DPI)").selectOption("72"); await page.getByLabel("JPEG quality").fill("0.85");
    await page.getByRole("button", { name: "Convert pages", exact: true }).click(); await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeVisible();
    const proof = await downloadImage(page, info, "rotated", 1, 72, "jpeg"); expect(proof.actual.width).toBe(240); expect(proof.actual.height).toBe(320); await noOverflow(page);
    await input.setInputFiles(fixture("ordering")); await expect(page.getByRole("link", { name: "Download page 1", exact: true })).toHaveCount(0); await expect(page.getByLabel("Pages to convert")).toHaveValue("1");
    await page.getByRole("button", { name: "Reset", exact: true }).click(); const log = await resources(page); expect(log.revoked).toEqual(log.created);
});
test("PDF to image: atomic high-DPI preflight creates no canvas, lower DPI succeeds", async ({ page }, info) => {
    await observe(page); await page.goto("/tool/pdf-to-image"); await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(fixture("render-dpi-limit"));
    await page.getByLabel("Pages to convert").fill("1-2"); await page.getByLabel("Resolution (DPI)").selectOption("300"); const before = await resources(page);
    await page.getByRole("button", { name: "Convert pages", exact: true }).click(); const alert = page.getByRole("main").getByRole("alert"); await expect(alert).toContainText("Select a lower DPI"); await expect(alert).toBeFocused();
    expect((await resources(page)).canvas).toBe(before.canvas); await expect(page.getByRole("main").locator("a[download]")).toHaveCount(0);
    await page.getByLabel("Resolution (DPI)").selectOption("150"); await page.getByRole("button", { name: "Convert pages", exact: true }).click(); await expect(page.getByRole("region", { name: "Page images ready" }).getByRole("link")).toHaveCount(2);
    await downloadImage(page, info, "render-dpi-limit", 2, 150, "png"); await noOverflow(page); await page.getByRole("button", { name: "Reset", exact: true }).click();
    const log = await resources(page); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
});
test("PDF to image: initial SSR guide, metadata, registry discovery and sitemap", async ({ page, request }) => {
    const response = await request.get("/tool/pdf-to-image"); expect(response.status()).toBe(200); const html = await response.text();
    for (const text of ["PDF to JPG / PNG", "Convert selected PDF pages", "How to use", "Page selection", "PNG vs JPG", "Resolution and limits", "4096-pixel", "16 MP", "lower DPI", "PDF source limits", "Related document tools", "PDF processing happens locally", 'href="/category/document"']) expect(html).toContain(text);
    for (const slug of ["merge-pdf", "split-pdf", "images-to-pdf"]) expect(html).toContain(`href="/tool/${slug}"`);
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/pdf-to-image"'); expect(html).toContain('property="og:url" content="https://iworkhere.space/tool/pdf-to-image"');
    await page.goto("/"); await expect(page.getByRole("region", { name: "All other tools" }).locator('a[href="/tool/pdf-to-image"]')).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Image tools", exact: true }).locator('a[href="/tool/pdf-to-image"]')).toHaveCount(0);
    await page.goto("/discover"); await page.getByLabel("Search", { exact: true }).fill("pdf to"); await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
    await page.goto("/category/document"); const links = page.getByRole("main").locator('a[href^="/tool/"]'); await expect(links).toHaveCount(4); await expect(links).toContainText(["Merge PDF", "Split PDF", "Images to PDF", "PDF to JPG / PNG"]);
    const xml = await (await request.get("/sitemap.xml")).text(); expect(xml.match(/<loc>/g)).toHaveLength(22); expect(xml.split("<loc>https://iworkhere.space/tool/pdf-to-image</loc>")).toHaveLength(2);
});
