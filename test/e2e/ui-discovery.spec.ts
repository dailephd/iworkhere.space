import path from "node:path";
import { test, expect } from "./support/fixture";

const imageTool = [
    { slug: "image-resizer", source: "resizer-source.jpg", input: "Choose image", action: "Resize image", result: "Resized image preview", download: "Download resized image", form: "Resize dimensions" },
    { slug: "image-compressor", source: "compressor-source.jpg", input: "Choose image", action: "Compress image", result: "Compressed image preview", download: "Download compressed image", form: "Compression settings" },
    { slug: "image-converter", source: "compressor-source.jpg", input: "Choose image", action: "Convert image", result: "Converted image preview", download: "Download converted image", form: "Conversion settings" },
    { slug: "heic-converter", source: "heic-source.heic", input: "Choose HEIC image", action: "Convert image", result: "Converted image preview", download: "Download converted image", form: "Conversion settings" },
] as const;

for (const theme of ["light", "dark", "onedark", "system"] as const) {
    for (const tool of imageTool) {
        test(`${theme}: ${tool.slug} approved workspace and real output`, async ({ page }, info) => {
            const mobile = info.project.name === "mobile-chromium";
            await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
            await page.addInitScript(theme => localStorage.setItem("theme", JSON.stringify(theme)), theme);
            await page.goto(`/tool/${tool.slug}`);
            const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
            await expect(breadcrumb.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
            await expect(breadcrumb.getByRole("link", { name: "Image", exact: true })).toHaveAttribute("href", "/category/image");
            await expect(page.getByRole("region", { name: "Tool guide" })).toContainText("ordinary application assets");
            await expect(page.getByRole("region", { name: "Tool guide" }).getByRole("link")).toHaveCount(3);
            await expect(page.getByRole("button", { name: tool.action, exact: true })).toBeDisabled();
            await page.getByLabel(tool.input, { exact: true }).setInputFiles(path.resolve(`test/fixtures/images/${tool.source}`));
            await expect(page.getByRole("button", { name: tool.action, exact: true })).toBeEnabled();
            if (tool.slug === "image-compressor") {
                await page.getByLabel("Quality", { exact: true }).focus();
                await page.getByLabel("Quality", { exact: true }).press("Home");
            }
            const stage = page.getByRole("region", { name: "Image preview and result", exact: true });
            const settings = page.getByRole("form", { name: tool.form, exact: true });
            const source = page.getByRole("region", { name: tool.slug === "heic-converter" ? "Source HEIC image" : "Source image", exact: true });
            const boxes = { source: (await source.boundingBox())!, stage: (await stage.boundingBox())!, settings: (await settings.boundingBox())! };
            if (mobile) {
                expect(boxes.stage.y).toBeGreaterThanOrEqual(boxes.source.y + boxes.source.height);
                expect(boxes.settings.y).toBeGreaterThanOrEqual(boxes.stage.y + boxes.stage.height);
            } else {
                expect(boxes.settings.width).toBeGreaterThanOrEqual(280);
                expect(boxes.settings.width).toBeLessThanOrEqual(320);
                expect(boxes.stage.x).toBeGreaterThan(boxes.settings.x + boxes.settings.width);
                expect(boxes.stage.width).toBeGreaterThan(boxes.settings.width);
                expect(boxes.stage.height).toBeGreaterThanOrEqual(440);
            }
            await page.getByRole("button", { name: tool.action, exact: true }).click();
            await expect(page.getByAltText(tool.result, { exact: true })).toBeVisible();
            expect(await stage.getAttribute("data-surface")).toBe("result-stage");
            const image = await page.getByAltText(tool.result).evaluate(element => {
                const image = element as HTMLImageElement;
                const box = image.getBoundingClientRect();
                return { width: image.naturalWidth, height: image.naturalHeight, fit: getComputedStyle(image).objectFit, boxWidth: box.width };
            });
            expect(image.width).toBeGreaterThan(0); expect(image.height).toBeGreaterThan(0);
            expect(image.fit).toBe("contain"); expect(image.boxWidth).toBeLessThanOrEqual((await stage.boundingBox())!.width);
            const download = page.waitForEvent("download");
            await page.getByRole("link", { name: tool.download, exact: true }).click();
            expect((await download).suggestedFilename()).toMatch(/\.(jpg|png|webp)$/);
            const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
            expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1);
            await page.screenshot({ path: info.outputPath(`${tool.slug}-${theme}-success.png`), fullPage: true });
            await page.getByRole("button", { name: "Reset", exact: true }).click();
            await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeFocused();
            await expect(page.getByAltText(tool.result, { exact: true })).toHaveCount(0);
            await expect(page.getByRole("button", { name: tool.action, exact: true })).toBeDisabled();
            await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
            expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
            await page.screenshot({ path: info.outputPath(`${tool.slug}-${theme}.png`), fullPage: true });
        });
    }
}

test("initial server HTML, stable public metadata and crawl endpoints", async ({ request }) => {
    for (const route of ["/", "/discover", "/category/image", "/tool/calculator?value=42", ...imageTool.map(tool => `/tool/${tool.slug}`)]) {
        const response = await request.get(route);
        expect(response.status()).toBe(200);
        const html = await response.text();
        const canonical = `https://iworkhere.space${route === "/" ? "" : route.split("?")[0]}`;
        expect(html).toContain(`rel="canonical" href="${canonical}"`);
        expect(html).toContain(`property="og:url" content="${canonical}"`);
        expect(html).toContain('name="twitter:card" content="summary"');
        expect(html).not.toContain('content="noindex');
        if (imageTool.some(tool => route === `/tool/${tool.slug}`)) {
            expect(html).toContain("Supported images and limits");
            expect(html).toContain("25 MiB"); expect(html).toContain("30 megapixels");
            expect(html).toContain("Related image tools");
            expect(html).toContain('aria-label="Breadcrumb"');
        }
        if (route.startsWith("/tool/calculator")) expect(html).not.toContain("Supported images and limits");
    }
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml.match(/<loc>/g)).toHaveLength(21);
    expect(xml).toContain("https://iworkhere.space/category/document");
    expect(xml).not.toMatch(/localhost|vercel\.app|<loc>[^<]*\?/);
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Allow: /");
    expect(await robots.text()).toContain("Sitemap: https://iworkhere.space/sitemap.xml");
    expect(await robots.text()).not.toContain("Disallow: /");
});
