import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import jsQR from "jsqr";
import { test, expect } from "./support/fixture";

const SECRET = "PRIVATE-QR-PAYLOAD";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const PAYLOADS: Array<[string, string]> = [
    ["plain text", "Hello QR 123"],
    ["URL", "https://example.com/path?x=1&y=two#frag"],
    ["Unicode and emoji", "Héllo 世界 😀 ñ"],
];

const generateButton = (page: Page) => page.getByRole("button", { name: "Generate QR code", exact: true });
const downloadLink = (page: Page) => page.getByRole("link", { name: "Download PNG", exact: true });
const preview = (page: Page) => page.getByRole("img", { name: "Generated QR code preview", exact: true });

async function generate(page: Page, text: string) {
    await page.getByLabel("Text or URL", { exact: true }).fill(text);
    await generateButton(page).click();
    await expect(preview(page)).toBeVisible();
    await expect(downloadLink(page)).toBeVisible();
}

// Decodes PNG bytes in the browser (no PNG decoder dependency) and returns RGBA as base64.
async function rasterize(page: Page, png: Buffer) {
    return page.evaluate(async (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d")!;
            context.drawImage(bitmap, 0, 0);
            const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
            let out = "";
            for (let i = 0; i < rgba.length; i += 0x8000) out += String.fromCharCode(...rgba.subarray(i, i + 0x8000));
            return { width: bitmap.width, height: bitmap.height, base64: btoa(out) };
        } finally {
            bitmap.close();
        }
    }, png.toString("base64"));
}

test("QR Code Generator route, SEO, breadcrumb, guide and related links are server-rendered", async ({ page, request }) => {
    const response = await request.get("/tool/qr-code-generator");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1");
    expect(html).toContain("QR Code Generator");
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/qr-code-generator"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/category/everyday"');
    for (const text of ["How to use", "Text and URLs", "Fixed QR settings", "Payload limit", "Local processing", "2048 UTF-8 bytes", "error correction level M", "Related everyday tools"]) expect(html).toContain(text);
    for (const href of ["/tool/length-converter", "/tool/weight-converter"]) expect(html).toContain(`href="${href}"`);

    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "QR Code Generator", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Everyday" })).toHaveAttribute("href", "/category/everyday");
    for (const href of ["/tool/length-converter", "/tool/weight-converter"]) {
        await expect(page.getByRole("main").locator(`a[href="${href}"]`).first()).toBeVisible();
        expect((await request.get(href)).status()).toBe(200);
    }
});

test("starts disabled, generates a visible preview, resets and fits the viewport", async ({ page }) => {
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    const input = page.getByLabel("Text or URL", { exact: true });
    await expect(generateButton(page)).toBeDisabled();
    await expect(preview(page)).toHaveCount(0);
    await expect(downloadLink(page)).toHaveCount(0);

    await generate(page, "Hello QR");
    const box = await preview(page).boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(preview(page)).toHaveCount(0);
    await expect(downloadLink(page)).toHaveCount(0);
    await expect(generateButton(page)).toBeDisabled();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("");
});

for (const [name, payload] of PAYLOADS) {
    test(`downloads a real 512x512 PNG that independently decodes to the ${name} payload`, async ({ page }, testInfo) => {
        await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
        await generate(page, payload);

        const downloading = page.waitForEvent("download");
        await downloadLink(page).click();
        const download = await downloading;
        expect(download.suggestedFilename()).toBe("qr-code.png");
        const destination = testInfo.outputPath("qr-code.png");
        await download.saveAs(destination);
        const png = await readFile(destination);

        expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
        expect(png.readUInt32BE(8)).toBe(13);
        expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
        expect(png.readUInt32BE(16)).toBe(512);
        expect(png.readUInt32BE(20)).toBe(512);

        const raster = await rasterize(page, png);
        expect(raster).toMatchObject({ width: 512, height: 512 });
        const rgba = new Uint8ClampedArray(Buffer.from(raster.base64, "base64"));
        const decoded = jsQR(rgba, raster.width, raster.height);
        expect(decoded?.data).toBe(payload);
        await testInfo.attach("qr-png-proof", { body: JSON.stringify({ name, bytes: png.length, signature: "PNG", ihdr: "512x512", decoded: decoded?.data === payload }), contentType: "application/json" });
    });
}

test("PNG encoding does not depend on the idle-scheduled canvas.toBlob", async ({ page }) => {
    // toBlob waits for browser idle periods and measured 1.6 s or more on a busy page, which delayed the preview.
    await page.addInitScript(() => {
        const counter = window as unknown as { __toBlobCalls: number };
        counter.__toBlobCalls = 0;
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (...args: Parameters<HTMLCanvasElement["toBlob"]>) {
            counter.__toBlobCalls += 1;
            return original.apply(this, args);
        };
    });
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    await generate(page, "no toBlob");
    expect(await page.evaluate(() => (window as unknown as { __toBlobCalls: number }).__toBlobCalls)).toBe(0);
});

test("editing the input removes the stale preview and download before a new generation", async ({ page }) => {
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    await generate(page, "first payload");
    await page.getByLabel("Text or URL", { exact: true }).fill("first payload edited");
    await expect(downloadLink(page)).toHaveCount(0);
    await expect(preview(page)).toHaveCount(0);
    await expect(generateButton(page)).toBeEnabled();
    await generateButton(page).click();
    await expect(downloadLink(page)).toBeVisible();
});

test("rejects over-limit text without a result and keeps the input", async ({ page }) => {
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    const text = "é".repeat(1025);
    await page.getByLabel("Text or URL", { exact: true }).fill(text);
    await generateButton(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("QR code text must be 2,048 UTF-8 bytes or less.");
    await expect(page.getByLabel("Text or URL", { exact: true })).toHaveValue(text);
    await expect(preview(page)).toHaveCount(0);
    await expect(downloadLink(page)).toHaveCount(0);
});

// The encoder's own error text identifies its emitted chunk without relying on hashed file names.
const UQR_SIGNATURE = "uqr only supports encoding string and binary data";
const UNRELATED_ROUTES = ["/", "/discover", "/tool/calculator", "/tool/json-formatter", "/tool/word-character-counter"];

const isStaticScript = (url: string) => {
    const { pathname } = new URL(url);
    return pathname.startsWith("/_next/static/") && pathname.endsWith(".js");
};

test("the uqr encoder chunk is requested only by the QR route, never by unrelated routes", async ({ browser, baseURL }) => {
    for (const route of UNRELATED_ROUTES) {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        const bodies: Array<Promise<string>> = [];
        page.on("response", response => { if (isStaticScript(response.url())) bodies.push(response.text()); });
        await page.goto(route, { waitUntil: "networkidle" });
        const texts = await Promise.all(bodies);
        expect(texts.length, `${route} loaded client scripts`).toBeGreaterThan(0);
        expect(texts.filter(text => text.includes(UQR_SIGNATURE)), `${route} must not load the uqr encoder`).toEqual([]);
        await context.close();
    }

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const encoderLoaded = page.waitForResponse(async response => isStaticScript(response.url()) && (await response.text()).includes(UQR_SIGNATURE));
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    await encoderLoaded;
    await context.close();
});

test("generation stays local: no payload leaves the browser, no query or storage", async ({ page }) => {
    const requests: string[] = [];
    await page.goto("/tool/qr-code-generator", { waitUntil: "networkidle" });
    page.on("request", request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));
    await generate(page, `https://example.com/${SECRET}`);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await generate(page, SECRET);

    expect(requests.filter(value => value.includes(SECRET)), "Payload never leaves the browser").toEqual([]);
    expect(requests.filter(value => !value.startsWith("GET")), "No non-GET request while using the tool").toEqual([]);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(SECRET);
});

test("everyday category, Discover search and sitemap include the QR Code Generator", async ({ page, request }) => {
    expect((await page.goto("/category/everyday"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Everyday Utility", exact: true })).toBeVisible();
    const tools = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(tools).toHaveCount(3);
    await expect(tools).toContainText(["Length Converter", "Weight Converter", "QR Code Generator"]);

    await page.goto("/discover", { waitUntil: "networkidle" });
    await page.getByLabel("Search", { exact: true }).fill("qr");
    const results = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(results).toHaveCount(1);
    await expect(results).toHaveAttribute("href", "/tool/qr-code-generator");

    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(27);
    expect(xml.split("<loc>https://iworkhere.space/tool/qr-code-generator</loc>")).toHaveLength(2);
    expect(xml.split("<loc>https://iworkhere.space/category/everyday</loc>")).toHaveLength(2);
    expect(xml).not.toMatch(/vercel\.app|<loc>[^<]*[?#]/);
});
