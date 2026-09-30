import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const fixturePath = (extension: string) => path.resolve(`test/fixtures/images/resizer-source.${extension}`);

async function selectSource(page: Page, extension = "jpg") {
    await page.getByLabel("Choose image", { exact: true }).setInputFiles(fixturePath(extension));
    await expect(page.getByText(/Source: 80 × 60 px/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Selected source image preview", exact: true })).toBeVisible();
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("80");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("60");
    await expect(page.getByLabel("Preserve aspect ratio")).toBeChecked();
}

async function resizeTo(page: Page, width = "40") {
    await page.getByLabel("Width", { exact: true }).fill(width);
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
}

async function inspectResult(page: Page) {
    const image = page.getByRole("img", { name: "Resized image preview", exact: true });
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    return image.evaluate(async element => {
        const preview = element as HTMLImageElement;
        const blob = await (await fetch(preview.src)).blob();
        const bitmap = await createImageBitmap(blob);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext("2d")!;
            context.drawImage(bitmap, 0, 0);
            return {
                width: preview.naturalWidth, height: preview.naturalHeight,
                decodedWidth: bitmap.width, decodedHeight: bitmap.height,
                mime: blob.type, bytes: blob.size, alpha: context.getImageData(2, 2, 1, 1).data[3],
            };
        } finally { bitmap.close(); }
    });
}

test("resizer route, image category and discovery use existing routing", async ({ page }) => {
    expect((await page.goto("/tool/image-resizer"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Image Resizer", exact: true })).toBeVisible();
    await expect(page.getByLabel("Choose image")).toBeVisible();
    await page.goto("/category/image");
    await page.getByRole("link", { name: "Image Resizer", exact: false }).click();
    await expect(page).toHaveURL(/\/tool\/image-resizer$/);
    await page.goto("/discover");
    await page.getByRole("main").getByRole("button", { name: /Image Resizer/ }).click();
    await expect(page).toHaveURL(/\/tool\/image-resizer$/);
});

for (const [extension, mime] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    test(`${extension} resizes locally with exact dimensions, MIME and download`, async ({ page }, testInfo) => {
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.toBlob;
            const encoding: { mime?: string; quality?: number }[] = [];
            Object.assign(window, { resizerEncoding: encoding });
            HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
                encoding.push({ mime: type, quality });
                return original.call(this, callback, type, quality);
            };
        });
        await page.goto("/tool/image-resizer");
        await selectSource(page, extension);
        await page.getByLabel("Width", { exact: true }).fill("40");
        await expect(page.getByLabel("Height", { exact: true })).toHaveValue("30");
        await resizeTo(page);
        const result = await inspectResult(page);
        expect(result).toMatchObject({ width: 40, height: 30, decodedWidth: 40, decodedHeight: 30, mime });
        expect(result.bytes).toBeGreaterThan(0);
        expect(result.alpha).toBe(extension === "png" ? 0 : 255);
        const encoding = await page.evaluate(() => (window as unknown as { resizerEncoding: { mime: string; quality?: number }[] }).resizerEncoding);
        expect(encoding).toEqual([{ mime, quality: extension === "png" ? undefined : 0.92 }]);
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("link", { name: "Download resized image", exact: true }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe(`resizer-source-40x30.${extension}`);
        const downloadedPath = testInfo.outputPath(`resized.${extension}`);
        await download.saveAs(downloadedPath);
        expect((await readFile(downloadedPath)).length).toBeGreaterThan(0);
        await testInfo.attach("resize-proof", { body: JSON.stringify({ ...result, encoding, filename: download.suggestedFilename() }), contentType: "application/json" });
    });
}

test("unlocked dimensions change the aspect ratio and fit the responsive workspace", async ({ page }, testInfo) => {
    await page.goto("/tool/image-resizer");
    await selectSource(page);
    await page.getByLabel("Preserve aspect ratio").uncheck();
    await page.getByLabel("Width", { exact: true }).fill("35");
    await page.getByLabel("Height", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
    expect(await inspectResult(page)).toMatchObject({ width: 35, height: 20 });
    const layout = await page.evaluate(() => {
        const main = document.querySelector("main")!;
        const footer = document.querySelector("footer")!;
        return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
            scrollOwner: document.scrollingElement?.tagName, mainOverflow: getComputedStyle(main).overflowY,
            footerFollows: footer.getBoundingClientRect().top >= main.getBoundingClientRect().bottom,
            previewsFit: [...document.querySelectorAll("main img")].every(image => image.getBoundingClientRect().width <= main.clientWidth),
        };
    });
    expect(layout).toEqual({ horizontalOverflow: false, scrollOwner: "HTML", mainOverflow: "visible", footerFollows: true, previewsFit: true });
    await page.getByRole("link", { name: "Download resized image" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Download resized image" })).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("contentinfo")).toBeInViewport();
    await testInfo.attach("responsive-resizer", { body: JSON.stringify(layout), contentType: "application/json" });
});

test("unsupported and empty files produce recoverable validation feedback", async ({ page }) => {
    await page.goto("/tool/image-resizer");
    await page.getByLabel("Choose image").setInputFiles({ name: "wrong.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("file encoding is not supported");
    await page.getByLabel("Choose image").setInputFiles({ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("non-empty");
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
});

test("supported signature with corrupt payload fails browser decode recoverably", async ({ page }) => {
    await page.goto("/tool/image-resizer");
    await page.getByLabel("Choose image").setInputFiles({ name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]) });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be decoded");
    await expect(page.getByRole("img")).toHaveCount(0);
    await selectSource(page);
    await resizeTo(page);
});

test("actual signature overrides misleading filename and declared MIME", async ({ page }) => {
    await page.goto("/tool/image-resizer");
    await page.getByLabel("Choose image").setInputFiles({ name: "misleading.png", mimeType: "image/webp", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 80 × 60 px/)).toBeVisible();
    await resizeTo(page);
    expect(await inspectResult(page)).toMatchObject({ mime: "image/jpeg" });
    await expect(page.getByRole("link", { name: "Download resized image" })).toHaveAttribute("download", "misleading-40x30.jpg");
});

test("target resource limit and invalid dimensions block processing", async ({ page }) => {
    await page.goto("/tool/image-resizer");
    await selectSource(page);
    await page.getByLabel("Preserve aspect ratio").uncheck();
    await page.getByLabel("Width", { exact: true }).fill("6000");
    await page.getByLabel("Height", { exact: true }).fill("5001");
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("30 megapixels");
    await page.getByLabel("Width", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Width must be a positive whole number");
    await page.getByLabel("Width", { exact: true }).fill("40");
    await page.getByLabel("Height", { exact: true }).fill("1.5");
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Height must be a positive whole number");
    await expect(page.getByRole("img", { name: "Resized image preview" })).toHaveCount(0);
});

test("source and result URLs are revoked on replacement, Reset and unmount", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[] };
        Object.assign(window, { resizerUrls: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
    });
    const urls = () => page.evaluate(() => (window as unknown as { resizerUrls: { created: string[]; revoked: string[] } }).resizerUrls);
    await page.goto("/tool/image-resizer");
    await selectSource(page); await resizeTo(page); await inspectResult(page);
    expect((await urls()).created).toHaveLength(2);
    await selectSource(page, "png");
    expect((await urls()).revoked.slice().sort()).toEqual((await urls()).created.slice(0, 2).sort());
    await resizeTo(page); await inspectResult(page);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect((await urls()).revoked.slice().sort()).toEqual((await urls()).created.slice().sort());
    await expect(page.getByLabel("Choose image")).toHaveValue("");
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Preserve aspect ratio")).toBeChecked();
    await selectSource(page, "png"); await resizeTo(page); await inspectResult(page);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Discover Browse all tool", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect.poll(async () => (await urls()).revoked.length).toBe(6);
    const log = await urls(); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    await testInfo.attach("object-url-lifecycle", { body: JSON.stringify(log), contentType: "application/json" });
});

test("Reset and new selection reject a pending stale resize and close its bitmap", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        const native = window.createImageBitmap.bind(window);
        const control = { hold: false, pending: false, closed: false, release: () => {} };
        Object.assign(window, { resizerDecode: control });
        window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
            const operation = native(...args);
            if (!control.hold) return operation;
            control.hold = false;
            return operation.then(bitmap => new Promise<ImageBitmap>(resolve => {
                const close = bitmap.close.bind(bitmap);
                bitmap.close = () => { control.closed = true; close(); };
                control.pending = true;
                control.release = () => resolve(bitmap);
            }));
        }) as typeof createImageBitmap;
    });
    await page.goto("/tool/image-resizer"); await selectSource(page);
    await page.evaluate(() => { (window as unknown as { resizerDecode: { hold: boolean } }).resizerDecode.hold = true; });
    await page.getByRole("button", { name: "Resize image", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { resizerDecode: { pending: boolean } }).resizerDecode.pending)).toBe(true);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await selectSource(page, "png");
    await page.evaluate(() => { (window as unknown as { resizerDecode: { release: () => void } }).resizerDecode.release(); });
    await expect.poll(() => page.evaluate(() => (window as unknown as { resizerDecode: { closed: boolean } }).resizerDecode.closed)).toBe(true);
    await expect(page.getByText("resizer-source.png", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("80");
    await expect(page.getByRole("img", { name: "Resized image preview" })).toHaveCount(0);
    await testInfo.attach("stale-operation", { body: JSON.stringify({ reset: true, newerSelectionPreserved: true, staleBitmapClosed: true, staleResultAdopted: false }), contentType: "application/json" });
});

test("selected file information stays outside URL and network requests", async ({ page }, testInfo) => {
    const marker = "PRIVATE_FILENAME_MARKER";
    const requests: { url: string; body: string | null }[] = [];
    page.on("request", request => requests.push({ url: request.url(), body: request.postData() }));
    await page.goto("/tool/image-resizer");
    await page.getByLabel("Choose image").setInputFiles({ name: `${marker}.jpg`, mimeType: "image/jpeg", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 80 × 60 px/)).toBeVisible();
    await resizeTo(page);
    expect(page.url()).not.toContain(marker);
    expect(new URL(page.url()).search).toBe("");
    expect(requests.every(request => !request.url.includes(marker) && !request.body?.includes(marker))).toBe(true);
    const api = requests.filter(request => new URL(request.url).pathname.startsWith("/api/"));
    expect(api.every(request => !/image\/jpeg|blob:|80.?60|40.?30/.test(request.body ?? ""))).toBe(true);
    expect(requests.filter(request => request.body && new URL(request.url).pathname !== "/api/log")).toEqual([]);
    await testInfo.attach("file-privacy", { body: JSON.stringify({ url: page.url(), markerAbsentFromRequests: true, apiRequests: api }), contentType: "application/json" });
});

for (const failure of ["context", "encoding"] as const) {
    test(`canvas ${failure} failure stays inside the tool`, async ({ page }) => {
        await page.goto("/tool/image-resizer"); await selectSource(page);
        await page.evaluate(kind => {
            if (kind === "context") HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
            else HTMLCanvasElement.prototype.toBlob = callback => callback(null);
        }, failure);
        await page.getByRole("button", { name: "Resize image", exact: true }).click();
        await expect(page.getByRole("main").getByRole("alert")).toContainText(failure === "context" ? "could not create a canvas" : "could not encode");
        await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
        await expect(page.getByRole("img", { name: "Resized image preview" })).toHaveCount(0);
    });
}
