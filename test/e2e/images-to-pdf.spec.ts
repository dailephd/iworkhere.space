import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "./support/fixture";
import { inspectImagePdf } from "../imagesToPdfVerification";
const fixture = (name: string) => path.resolve(`test/fixtures/images/${name}`);
interface ResourceLog { created: string[]; revoked: string[]; workers: string[] }
test("Images to PDF: ordered local sources, real worker, independent rendered download and cleanup", async ({ page }, info) => {
    const methods: string[] = [];
    page.context().on("request", request => { if (request.url().startsWith("http")) { methods.push(request.method()); expect(request.method(), "Source images must not be uploaded").toBe("GET"); } });
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[], workers: [] as string[] };
        Object.assign(window, { imagesPdfResources: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
        const NativeWorker = Worker; window.Worker = class extends NativeWorker { constructor(url: string | URL, option?: WorkerOptions) { super(url, option); log.workers.push(String(url)); } };
    });
    const resources = () => page.evaluate(() => (window as unknown as { imagesPdfResources: ResourceLog }).imagesPdfResources);
    await page.goto("/tool/images-to-pdf");
    const input = page.getByLabel("Choose JPEG or PNG images", { exact: true });
    const sourceName = ["resizer-source.jpg", "resizer-source.png", "compressor-source.jpg"];
    await input.setInputFiles(sourceName.map(fixture));
    const list = page.getByRole("list", { name: "Image page order" }); await expect(list.getByRole("listitem")).toHaveCount(3);
    expect((await resources()).workers).toEqual([]);
    await expect(list.getByRole("listitem").nth(0)).toContainText("resizer-source.jpg");
    await page.getByRole("button", { name: "Move down image 1: resizer-source.jpg", exact: true }).press("Enter");
    await expect(list.getByRole("listitem").nth(0)).toContainText("resizer-source.png");
    await page.getByRole("button", { name: "Move up image 2: resizer-source.jpg", exact: true }).press("Enter");
    const source = await Promise.all(sourceName.map(async name => [...await readFile(fixture(name))]));
    const expected = await page.evaluate(async source => {
        const result = [];
        for (const bytes of source) {
            const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
            try {
                const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
                const context = canvas.getContext("2d")!; context.fillStyle = "#12ab34"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0);
                const pixel = [[5, 5], [Math.floor(image.width * .75), 5], [5, Math.floor(image.height * .75)]].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
                result.push({ width: image.width, height: image.height, rotation: 0, pixel });
            } finally { image.close(); }
        }
        return result;
    }, source);
    const action = page.getByRole("button", { name: "Create PDF", exact: true }); await action.press("Enter");
    await expect(page.getByRole("heading", { name: "PDF ready", exact: true })).toBeFocused();
    const pending = page.waitForEvent("download"); await page.getByRole("link", { name: "Download PDF", exact: true }).click();
    const download = await pending; expect(download.suggestedFilename()).toBe("images-to-pdf.pdf");
    const destination = info.outputPath("images-to-pdf.pdf"); await download.saveAs(destination);
    const actual = await inspectImagePdf(await readFile(destination)); expect(actual).toHaveLength(3);
    const difference: number[] = [];
    for (let index = 0; index < actual.length; index++) {
        expect({ ...actual[index], pixel: [] }).toEqual({ ...expected[index], pixel: [] });
        const delta = actual[index].pixel.flat().map((value, channel) => Math.abs(value - expected[index].pixel.flat()[channel]));
        difference.push(Math.max(...delta));
        // Chromium native JPEG and independent PDF.js decoding can differ slightly.
        expect(Math.max(...delta)).toBeLessThanOrEqual(index === 1 ? 0 : 3);
    }
    expect(actual[1].pixel[0]).toEqual([18, 171, 52, 255]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("images-to-pdf-success.png"), fullPage: true });
    await page.getByRole("button", { name: "Remove image 3: compressor-source.jpg", exact: true }).press("Enter");
    await expect(input).toBeFocused(); await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toHaveCount(0);
    await input.setInputFiles(fixture("compressor-source.jpg")); await expect(list.getByRole("listitem")).toHaveCount(3);
    await action.click(); await expect(page.getByRole("heading", { name: "PDF ready", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).press("Enter"); await expect(input).toBeFocused(); await expect(action).toBeDisabled();
    const log = await resources(); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    await info.attach("images-pdf-local-render-evidence", { body: JSON.stringify({ actual, expected, maximumChannelDifference: difference, methods: [...new Set(methods)], resources: log }), contentType: "application/json" });
});
test("Images to PDF: initial SEO/guide and automatic registry discovery", async ({ page, request }) => {
    const response = await request.get("/tool/images-to-pdf"); expect(response.status()).toBe(200); const html = await response.text();
    for (const text of ["Images to PDF", "Combine JPEG and PNG images", "How to use", "One image per page", "PDF points", "PNG alpha", "source images are not uploaded", "Related document tools", 'href="/tool/merge-pdf"', 'href="/tool/split-pdf"', 'href="/category/document"']) expect(html).toContain(text);
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/images-to-pdf"'); expect(html).toContain('property="og:url" content="https://iworkhere.space/tool/images-to-pdf"');
    await page.goto("/"); await expect(page.getByRole("region", { name: "All other tools" }).locator('a[href="/tool/images-to-pdf"]')).toHaveCount(1);
    await page.goto("/discover"); await page.getByLabel("Search", { exact: true }).fill("images to pdf"); await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
    await page.goto("/category/document"); await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toContainText(["Merge PDF", "Split PDF", "Images to PDF", "PDF to JPG / PNG"]);
    const xml = await (await request.get("/sitemap.xml")).text(); expect(xml.match(/<loc>/g)).toHaveLength(26); expect(xml.split("<loc>https://iworkhere.space/tool/images-to-pdf</loc>")).toHaveLength(2);
});
test("Images to PDF: unsupported content rejects an entire batch locally", async ({ page }) => {
    await page.goto("/tool/images-to-pdf"); const input = page.getByLabel("Choose JPEG or PNG images", { exact: true }); await input.setInputFiles(fixture("resizer-source.jpg"));
    await expect(page.getByRole("list", { name: "Image page order" }).getByRole("listitem")).toHaveCount(1);
    await input.setInputFiles([fixture("resizer-source.png"), fixture("resizer-source.webp")]);
    const alert = page.getByRole("main").getByRole("alert"); await expect(alert).toContainText("WebP"); await expect(alert).toBeFocused();
    await expect(page.getByRole("list", { name: "Image page order" }).getByRole("listitem")).toHaveCount(1);
    await input.setInputFiles({ name: "false.png", mimeType: "image/png", buffer: Buffer.from("invalid encoded content") }); await expect(alert).toContainText("not valid");
});
