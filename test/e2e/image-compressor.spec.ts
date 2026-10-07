import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const fixturePath = (extension: string) => path.resolve(`test/fixtures/images/compressor-source.${extension}`);
async function selectSource(page: Page, extension = "jpg") {
    await page.getByLabel("Choose image").setInputFiles(fixturePath(extension));
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Selected source image preview" })).toBeVisible();
}
async function compress(page: Page) {
    await page.getByRole("button", { name: "Compress image", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Compressed image ready" })).toBeVisible();
}
async function inspectResult(page: Page) {
    const url = await page.getByRole("img", { name: "Compressed image preview" }).getAttribute("src");
    return page.evaluate(async url => {
        const blob = await (await fetch(url!)).blob(); const bitmap = await createImageBitmap(blob);
        try {
            const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0);
            return { width: bitmap.width, height: bitmap.height, mime: blob.type, bytes: blob.size, alpha: context.getImageData(2, 2, 1, 1).data[3] };
        } finally { bitmap.close(); }
    }, url);
}
async function instrumentUrls(page: Page) {
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[] };
        Object.assign(window, { compressorUrls: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
    });
}
const urls = (page: Page) => page.evaluate(() => (window as unknown as { compressorUrls: { created: string[]; revoked: string[] } }).compressorUrls);

test("Compressor route, image category and discovery use the existing registry", async ({ page }) => {
    expect((await page.goto("/tool/image-compressor"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Image Compressor", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByLabel("Choose image")).toBeVisible();
    await page.goto("/category/image");
    const links = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(links).toHaveCount(4);
    await expect(links).toContainText(["Image Resizer", "Image Compressor", "JPG / PNG / WebP Converter"]);
    await page.goto("/discover");
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(18);
    await page.getByRole("main").getByRole("link", { name: /Image Compressor/ }).click();
    await expect(page).toHaveURL(/\/tool\/image-compressor$/);
});

for (const [extension, mime] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    test(`${extension} native encoding reduces actual bytes and preserves dimensions`, async ({ page }, testInfo) => {
        await page.goto("/tool/image-compressor"); await selectSource(page, extension);
        if (extension === "png") {
            await expect(page.getByLabel("Quality", { exact: true })).toHaveCount(0);
            await expect(page.getByText("PNG uses lossless browser re-encoding. Some PNG files may not become smaller.")).toBeVisible();
        } else {
            await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("80");
            await page.getByLabel("Quality", { exact: true }).fill("60");
        }
        await compress(page);
        const result = await inspectResult(page), sourceBytes = (await stat(fixturePath(extension))).size;
        expect(result).toMatchObject({ width: 240, height: 180, mime, alpha: extension === "png" ? 0 : 255 });
        expect(result.bytes).toBeGreaterThan(0); expect(result.bytes).toBeLessThan(sourceBytes);
        const saved = sourceBytes - result.bytes, percent = saved / sourceBytes * 100;
        const region = page.getByRole("region", { name: "Compressed image ready" });
        await expect(region).toContainText(`(${sourceBytes} bytes)`);
        await expect(region).toContainText(`(${result.bytes} bytes)`);
        await expect(region).toContainText(`${saved} bytes saved (${percent.toFixed(1)}% reduction)`);
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("link", { name: "Download compressed image" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe(`compressor-source-compressed.${extension}`);
        const destination = testInfo.outputPath(`download.${extension}`); await download.saveAs(destination);
        expect((await stat(destination)).size).toBe(result.bytes);
        await testInfo.attach("actual-compression", { body: JSON.stringify({ sourceBytes, ...result, saved, percent, filename: download.suggestedFilename() }), contentType: "application/json" });
    });
}

test("equal or larger native PNG encoding has no result URL or download", async ({ page }, testInfo) => {
    await instrumentUrls(page); await page.goto("/tool/image-compressor");
    const file = path.resolve("test/fixtures/images/resizer-source.png");
    await page.getByLabel("Choose image").setInputFiles(file);
    await expect(page.getByText(/Source: 80 × 60 px/)).toBeVisible();
    await page.getByRole("button", { name: "Compress image", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No smaller file produced" })).toBeVisible();
    await expect(page.getByText("Candidate encoded size")).toBeVisible();
    await expect(page.getByRole("region", { name: "No smaller file produced" })).toContainText("did not produce a smaller file");
    await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Compressed image preview" })).toHaveCount(0);
    expect((await urls(page)).created).toHaveLength(1);
    await testInfo.attach("no-reduction", { body: JSON.stringify({ sourceBytes: (await stat(file)).size, text: await page.getByRole("region", { name: "No smaller file produced" }).innerText(), urls: await urls(page) }), contentType: "application/json" });
    await selectSource(page); await compress(page);
});

test("Quality, repetition, replacement, Reset and unmount release owned URLs", async ({ page }, testInfo) => {
    await instrumentUrls(page); await page.goto("/tool/image-compressor"); await selectSource(page); await compress(page);
    const first = await urls(page); expect(first.created).toHaveLength(2);
    await page.getByLabel("Quality", { exact: true }).fill("60");
    await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveCount(0);
    expect((await urls(page)).revoked).toEqual([first.created[1]]);
    await compress(page); await compress(page);
    expect((await urls(page)).revoked).toContain((await urls(page)).created[2]);
    await selectSource(page, "webp");
    await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("80");
    expect((await urls(page)).revoked.slice().sort()).toEqual((await urls(page)).created.slice(0, 4).sort());
    await compress(page); await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect((await urls(page)).revoked.slice().sort()).toEqual((await urls(page)).created.slice().sort());
    await expect(page.getByLabel("Choose image")).toHaveValue("");
    await expect(page.getByRole("img")).toHaveCount(0);
    await selectSource(page); await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("80"); await compress(page);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "All tools", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect.poll(async () => (await urls(page)).revoked.length).toBe(8);
    const log = await urls(page); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    await testInfo.attach("object-url-lifecycle", { body: JSON.stringify(log), contentType: "application/json" });
});

test("Reset and replacement reject a pending encode and close its stale bitmap", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        const native = window.createImageBitmap.bind(window);
        const control = { hold: false, pending: false, closed: false, release: () => {} };
        Object.assign(window, { compressorDecode: control });
        window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
            const operation = native(...args);
            if (!control.hold) return operation;
            control.hold = false;
            return operation.then(bitmap => new Promise<ImageBitmap>(resolve => {
                const close = bitmap.close.bind(bitmap); bitmap.close = () => { control.closed = true; close(); };
                control.pending = true; control.release = () => resolve(bitmap);
            }));
        }) as typeof createImageBitmap;
    });
    await page.goto("/tool/image-compressor"); await selectSource(page);
    await page.evaluate(() => { (window as unknown as { compressorDecode: { hold: boolean } }).compressorDecode.hold = true; });
    await page.getByRole("button", { name: "Compress image", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { compressorDecode: { pending: boolean } }).compressorDecode.pending)).toBe(true);
    await page.getByRole("button", { name: "Reset", exact: true }).click(); await selectSource(page, "png");
    await page.evaluate(() => { (window as unknown as { compressorDecode: { release: () => void } }).compressorDecode.release(); });
    await expect.poll(() => page.evaluate(() => (window as unknown as { compressorDecode: { closed: boolean } }).compressorDecode.closed)).toBe(true);
    await expect(page.getByText("compressor-source.png", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveCount(0);
    await testInfo.attach("stale-operation", { body: JSON.stringify({ staleBitmapClosed: true, newerSelectionPreserved: true, staleResultAdopted: false }), contentType: "application/json" });
});

test("unsupported, empty and corrupt files fail recoverably", async ({ page }) => {
    await page.goto("/tool/image-compressor");
    const input = page.getByLabel("Choose image"), alert = page.getByRole("main").getByRole("alert");
    await input.setInputFiles({ name: "wrong.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
    await expect(alert).toContainText("not valid JPEG, PNG, or WebP image content");
    await input.setInputFiles({ name: "empty.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) });
    await expect(alert).toContainText("non-empty");
    await input.setInputFiles({ name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 0, 1]) });
    await expect(alert).toContainText("could not be decoded");
    await expect(page.getByRole("img")).toHaveCount(0);
    await selectSource(page); await compress(page);
});

test("oversized source is rejected before decode", async ({ page }) => {
    await page.goto("/tool/image-compressor");
    await page.getByLabel("Choose image").setInputFiles({ name: "large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(26_214_401) });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("maximum file size is 25 MiB");
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Compress image", exact: true })).toBeDisabled();
});

test("actual signature overrides misleading filename and MIME", async ({ page }) => {
    await page.goto("/tool/image-compressor");
    await page.getByLabel("Choose image").setInputFiles({ name: "wrong.png", mimeType: "image/webp", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible(); await compress(page);
    expect((await inspectResult(page)).mime).toBe("image/jpeg");
    await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveAttribute("download", "wrong-compressed.jpg");
});

for (const failure of ["context", "encoding", "mime"] as const) {
    test(`canvas ${failure} failure stays recoverable without a result`, async ({ page }) => {
        await page.goto("/tool/image-compressor"); await selectSource(page);
        await page.evaluate(kind => {
            if (kind === "context") HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
            else HTMLCanvasElement.prototype.toBlob = callback => callback(kind === "mime" ? new Blob(["wrong"], { type: "image/png" }) : null);
        }, failure);
        await page.getByRole("button", { name: "Compress image", exact: true }).click();
        await expect(page.getByRole("main").getByRole("alert")).toContainText(failure === "context" ? "could not create the canvas" : "could not encode");
        await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    });
}

test("file information stays outside URL, storage and application network requests", async ({ page }, testInfo) => {
    const marker = "PRIVATE_COMPRESSOR_FILENAME_MARKER";
    const requests: { url: string; body: string | null }[] = [];
    page.on("request", request => requests.push({ url: request.url(), body: request.postData() }));
    await page.goto("/tool/image-compressor");
    // Wait for the existing mount event before taking the privacy baseline.
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_opened)).toBe(1);
    const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    await page.getByLabel("Choose image").setInputFiles({ name: `${marker}.jpg`, mimeType: "image/jpeg", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible(); await compress(page);
    expect(page.url()).not.toContain(marker); expect(new URL(page.url()).search).toBe("");
    expect(requests.every(request => !request.url.includes(marker) && !request.body?.includes(marker))).toBe(true);
    const api = requests.filter(request => new URL(request.url).pathname.startsWith("/api/"));
    expect(api.every(request => !/image\/jpeg|blob:|240.?180|107911/.test(request.body ?? ""))).toBe(true);
    expect(requests.filter(request => request.body && new URL(request.url).pathname !== "/api/log")).toEqual([]);
    const storageAfter = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    // The existing local analytics provider persists event counts, never event properties.
    const counter = JSON.parse(storageBefore.local.analytic_event_count ?? "{}");
    const expectedCounter = { ...counter, tool_executed: (counter.tool_executed ?? 0) + 1 };
    expect(storageAfter).toEqual({ ...storageBefore, local: { ...storageBefore.local, analytic_event_count: JSON.stringify(expectedCounter) } });
    expect(JSON.stringify(storageAfter)).not.toContain(marker);
    await testInfo.attach("privacy", { body: JSON.stringify({ url: page.url(), requests, noUpload: true, onlyMetadataFreeEventCounterChanged: true }), contentType: "application/json" });
});

test("controls, previews and metrics fit the workspace with natural scrolling", async ({ page }, testInfo) => {
    await page.goto("/tool/image-compressor"); await selectSource(page);
    await page.getByLabel("Quality", { exact: true }).focus(); await page.getByLabel("Quality", { exact: true }).press("ArrowLeft");
    await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("75"); await compress(page);
    const layout = await page.evaluate(() => {
        const main = document.querySelector("main")!, footer = document.querySelector("footer")!;
        return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scrollOwner: document.scrollingElement?.tagName,
            mainOverflow: getComputedStyle(main).overflowY, footerFollows: footer.getBoundingClientRect().top >= main.getBoundingClientRect().bottom,
            previewsFit: [...document.querySelectorAll("main img")].every(image => image.getBoundingClientRect().width <= main.clientWidth) };
    });
    expect(layout).toEqual({ horizontalOverflow: false, scrollOwner: "HTML", mainOverflow: "visible", footerFollows: true, previewsFit: true });
    await page.getByRole("link", { name: "Download compressed image" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Download compressed image" })).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await expect(page.getByRole("contentinfo")).toBeInViewport();
    await testInfo.attach("responsive-compressor", { body: JSON.stringify(layout), contentType: "application/json" });
});
