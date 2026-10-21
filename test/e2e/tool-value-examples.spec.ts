import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";
import manifest from "../../public/examples/v0.4.3/manifest.json";

const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
const UNFEATURED = ["json-formatter", "calculator", "image-compressor", "merge-pdf"];
const MEDIA_LABEL: Record<string, string> = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };

const assetOf = (slug: string) => manifest.asset.filter(value => value.exampleId === `${slug}-example`);
const urlOf = (asset: { path: string }) => `/${asset.path.slice("public/".length)}`;
const nameOf = (asset: { path: string }) => asset.path.slice(asset.path.lastIndexOf("/") + 1);
const panel = (page: Page) => page.getByRole("region", { name: "Worked example", exact: true });
const guide = (page: Page) => page.getByRole("region", { name: "Tool guide", exact: true });
const firstControl = (slug: string) => manifest.operation.find(value => value.toolId === slug)!.step.find(step => step.kind === "choose-files")!.control;
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("v0.4.3 tool-page worked examples", () => {
    test("the five featured tool pages server-render their example and every other page has none", async ({ request }) => {
        for (const slug of FEATURED) {
            const response = await request.get(`/tool/${slug}`);
            expect(response.status(), slug).toBe(200);
            const html = await response.text();
            expect(html, slug).toContain("Worked example");
            for (const asset of assetOf(slug)) expect(html, `${slug} ${asset.path}`).toContain(`href="${urlOf(asset)}"`);
        }
        for (const slug of UNFEATURED) {
            const html = await (await request.get(`/tool/${slug}`)).text();
            expect(html, slug).not.toContain("Worked example");
            expect(html, slug).not.toContain("/examples/v0.4.3/");
        }
    });

    for (const slug of FEATURED) {
        test(`${slug}: the example sits between the working tool and the guide with its recorded facts`, async ({ page }) => {
            await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" });
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            const example = panel(page);
            await expect(example).toBeVisible();
            await expect(example.getByRole("heading", { level: 2, name: "Worked example", exact: true })).toBeVisible();
            await expect(example.getByRole("heading", { level: 1 })).toHaveCount(0);

            const control = page.getByLabel(firstControl(slug), { exact: true });
            await expect(control).toBeEnabled();
            const position = await Promise.all([control.evaluate(element => element.getBoundingClientRect().top + scrollY),
                example.evaluate(element => element.getBoundingClientRect().top + scrollY),
                guide(page).evaluate(element => element.getBoundingClientRect().top + scrollY)]);
            expect(position[0], "working tool is first").toBeLessThan(position[1]);
            expect(position[1], "example precedes the guide").toBeLessThan(position[2]);
            await expect(guide(page).getByRole("heading", { name: "How to use", exact: true })).toBeVisible();
            await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();

            const text = (await example.textContent()) ?? "";
            for (const asset of assetOf(slug)) {
                expect(text, asset.path).toContain(nameOf(asset));
                expect(text, asset.path).toContain(MEDIA_LABEL[asset.mediaType]);
                expect(text, asset.path).toContain(`${asset.bytes.toLocaleString("en-US")} bytes`);
                if ("width" in asset) expect(text, asset.path).toContain(`${asset.width} × ${asset.height} px`);
            }
            const link = example.locator("a[data-example-asset]");
            await expect(link).toHaveCount(assetOf(slug).length);
            expect(await link.evaluateAll(element => element.map(value => value.getAttribute("href")).sort())).toEqual(assetOf(slug).map(urlOf).sort());
            expect(await link.evaluateAll(element => element.every(value => value.hasAttribute("download") && new URL((value as HTMLAnchorElement).href).origin === location.origin))).toBe(true);
        });
    }

    test("an unfeatured tool page has no example section, example link or placeholder", async ({ page }) => {
        for (const slug of UNFEATURED) {
            await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" });
            await expect(panel(page)).toHaveCount(0);
            await expect(page.getByText("Worked example")).toHaveCount(0);
            await expect(page.locator('a[href^="/examples/"], img[src^="/examples/"], [data-example-asset]')).toHaveCount(0);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        }
    });

    test("every example file resolves from this origin with its recorded media type, size and SHA-256", async ({ request }) => {
        for (const asset of manifest.asset) {
            const response = await request.get(urlOf(asset));
            expect(response.status(), asset.path).toBe(200);
            expect(response.headers()["content-type"], asset.path).toContain(asset.mediaType);
            const body = await response.body();
            expect(body.length, asset.path).toBe(asset.bytes);
            expect(createHash("sha256").update(body).digest("hex"), asset.path).toBe(asset.sha256);
        }
    });

    test("loading and scrolling an example page downloads nothing and fetches no PDF or foreign host", async ({ page, baseURL }) => {
        const download: string[] = [], request: string[] = [], popup: string[] = [];
        page.on("download", value => download.push(value.suggestedFilename()));
        page.on("popup", value => popup.push(value.url()));
        page.on("request", value => request.push(value.url()));
        for (const slug of FEATURED) {
            await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" });
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(300);
        }
        expect(download, "no file is downloaded without a visitor action").toEqual([]);
        expect(popup, "no PDF viewer or window opens by itself").toEqual([]);
        expect(request.filter(value => /\/examples\/.*\.pdf(\?|$)/i.test(value)), "PDF examples are only fetched on request").toEqual([]);
        const origin = new URL(baseURL!).origin;
        expect(request.filter(value => /^https?:/i.test(value) && new URL(value).origin !== origin), "no external sample host").toEqual([]);
    });

    for (const slug of FEATURED) {
        test(`${slug}: each example link is a visitor-initiated download of the exact committed bytes`, async ({ page }, info) => {
            await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" });
            for (const asset of assetOf(slug)) {
                const link = panel(page).locator(`a[href="${urlOf(asset)}"]`);
                await expect(link).toHaveCount(1);
                // PDF links also name what the file contains (v0.4.3 Batch 3); image links are described by their figure's alt text and caption.
                const description = asset.mediaType === "application/pdf" ? " \\(.{15,}\\)" : "";
                await expect(link).toHaveAccessibleName(new RegExp(`^Download (source|result) ${MEDIA_LABEL[asset.mediaType]}: ${nameOf(asset).replace(".", "\\.")}${description}$`));
                const pending = page.waitForEvent("download");
                await link.click();
                const download = await pending;
                expect(download.suggestedFilename(), asset.path).toBe(nameOf(asset));
                const destination = info.outputPath(`${slug}-${nameOf(asset)}`);
                await download.saveAs(destination);
                const saved = await readFile(destination);
                expect(saved.length, asset.path).toBe(asset.bytes);
                expect(createHash("sha256").update(saved).digest("hex"), asset.path).toBe(asset.sha256);
                expect(page.url(), "the page stays put").toContain(`/tool/${slug}`);
            }
        });

        test(`${slug}: no horizontal overflow, the real tool stays reachable and the example clears the fixed footer`, async ({ page }) => {
            await page.goto(`/tool/${slug}`, { waitUntil: "networkidle" });
            expect(await noHorizontalOverflow(page)).toBe(true);
            const example = panel(page);
            const box = (await example.boundingBox())!;
            const width = page.viewportSize()!.width;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
            for (const image of await example.locator("img").all()) {
                await image.scrollIntoViewIfNeeded();
                await expect(image).toBeVisible();
                const rendered = await image.evaluate(element => { const value = element as HTMLImageElement; return { complete: value.complete, natural: value.naturalWidth, width: value.getBoundingClientRect().width, height: value.getBoundingClientRect().height, nw: value.naturalWidth, nh: value.naturalHeight }; });
                expect(rendered.complete && rendered.natural > 0, "preview image decoded").toBe(true);
                expect(Math.abs(rendered.width / rendered.height - rendered.nw / rendered.nh), "aspect ratio preserved").toBeLessThan(0.02);
            }

            const control = page.getByLabel(firstControl(slug), { exact: true });
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeEnabled();

            for (const state of ["expanded", "collapsed"] as const) {
                if (state === "collapsed") await page.getByRole("contentinfo").getByRole("button", { name: "Hide footer", exact: true }).click();
                await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                const end = await page.evaluate(() => ({ mainBottom: document.querySelector("main")!.getBoundingClientRect().bottom, footerTop: document.querySelector("footer")!.getBoundingClientRect().top }));
                expect(end.mainBottom, `${state}: the end of the page is above the footer`).toBeLessThanOrEqual(end.footerTop + 1);
                const last = example.locator("a[data-example-asset]").last();
                await last.evaluate(element => element.scrollIntoView({ block: "nearest" }));
                await expect(last).toBeInViewport();
                const reachable = await last.evaluate(element => {
                    const rect = element.getBoundingClientRect(), footer = document.querySelector("footer")!.getBoundingClientRect();
                    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    return { aboveFooter: rect.bottom <= footer.top + 1, receivesPointer: !!hit && element.contains(hit) };
                });
                expect(reachable, `${state} footer`).toEqual({ aboveFooter: true, receivesPointer: true });
            }
            expect(await noHorizontalOverflow(page)).toBe(true);
        });
    }

    test("example links are keyboard reachable with a visible focus indicator and the panel adds no dialog or nested scroller", async ({ page }) => {
        await page.goto("/tool/image-converter", { waitUntil: "networkidle" });
        const link = panel(page).locator("a[data-example-asset]").first();
        await link.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        const outline = await link.evaluate(element => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThan(0);
        await expect(panel(page).locator("dialog, [role=dialog], [aria-modal=true]")).toHaveCount(0);
        const scroller = await panel(page).evaluate(element => [element, ...element.querySelectorAll("*")].filter(value => /(auto|scroll)/.test(getComputedStyle(value).overflowY + getComputedStyle(value).overflowX)).length);
        expect(scroller).toBe(0);
    });
});
