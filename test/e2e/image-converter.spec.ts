import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const fixturePath = (extension: string) => path.resolve(extension === "alpha-webp"
    ? "test/fixtures/images/converter-transparent.webp" : `test/fixtures/images/compressor-source.${extension}`);

async function selectSource(page: Page, extension = "jpg") {
    await page.getByLabel("Choose image").setInputFiles(fixturePath(extension));
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible();
    await expect(page.getByRole("img", { name: "Selected source image preview" })).toBeVisible();
}

async function convert(page: Page) {
    await page.getByRole("button", { name: "Convert image", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Converted image ready" })).toBeVisible();
}

async function inspectResult(page: Page) {
    const url = await page.getByRole("img", { name: "Converted image preview" }).getAttribute("src");
    return page.evaluate(async url => {
        const blob = await (await fetch(url!)).blob();
        const bitmap = await createImageBitmap(blob);
        try {
            const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0);
            return { width: bitmap.width, height: bitmap.height, mime: blob.type, bytes: blob.size, pixel: [...context.getImageData(2, 2, 1, 1).data] };
        } finally { bitmap.close(); }
    }, url);
}

test("Converter registry, SEO, category and discovery", async ({ page }) => {
    expect((await page.goto("/tool/image-converter"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "JPG / PNG / WebP Converter", exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/JPG \/ PNG \/ WebP Converter/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/tool\/image-converter$/);
    await page.goto("/category/image");
    const links = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(links).toHaveCount(4);
    await expect(links).toContainText(["Image Resizer", "Image Compressor", "JPG / PNG / WebP Converter"]);
    await page.goto("/discover");
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(17);
    await page.getByRole("main").getByRole("link", { name: /JPG \/ PNG \/ WebP Converter/ }).click();
    await expect(page).toHaveURL(/\/tool\/image-converter$/);
});

const pair = [
    { source: "jpg", sourceFormat: "jpeg", target: "png", extension: "png" },
    { source: "jpg", sourceFormat: "jpeg", target: "webp", extension: "webp" },
    { source: "png", sourceFormat: "png", target: "jpeg", extension: "jpg" },
    { source: "png", sourceFormat: "png", target: "webp", extension: "webp" },
    { source: "alpha-webp", sourceFormat: "webp", target: "jpeg", extension: "jpg" },
    { source: "alpha-webp", sourceFormat: "webp", target: "png", extension: "png" },
];
for (const { source, sourceFormat, target, extension } of pair) {
    test(`${sourceFormat} to ${target}: native MIME, dimensions, transparency and download`, async ({ page }, testInfo) => {
        await page.goto("/tool/image-converter"); await selectSource(page, source);
        const output = page.getByLabel("Output format", { exact: true });
        expect(await output.locator("option").evaluateAll(option => option.map(element => (element as HTMLOptionElement).value)))
            .toEqual(["jpeg", "png", "webp"].filter(format => format !== sourceFormat));
        await expect(output).toHaveValue(sourceFormat === "jpeg" ? "png" : "jpeg");
        await output.selectOption(target);
        if (target === "png") await expect(page.getByLabel("Quality", { exact: true })).toHaveCount(0);
        else {
            await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("90");
            await page.getByLabel("Quality", { exact: true }).fill("60");
        }
        await convert(page);
        const result = await inspectResult(page);
        expect(result).toMatchObject({ width: 240, height: 180, mime: `image/${target}` });
        expect(result.bytes).toBeGreaterThan(0);
        if (sourceFormat !== "jpeg") {
            if (target === "jpeg") {
                expect(result.pixel.slice(0, 3).every(channel => channel >= 240)).toBe(true);
                expect(result.pixel[3]).toBe(255);
            } else expect(result.pixel[3]).toBe(0);
        }
        const region = page.getByRole("region", { name: "Converted image ready" });
        await expect(region).toContainText("240 × 180 px");
        await expect(region).toContainText(`(${(await stat(fixturePath(source))).size} bytes)`);
        await expect(region).toContainText(`(${result.bytes} bytes)`);
        const downloading = page.waitForEvent("download");
        await page.getByRole("link", { name: "Download converted image" }).click();
        const download = await downloading;
        const basename = source === "alpha-webp" ? "converter-transparent" : "compressor-source";
        expect(download.suggestedFilename()).toBe(`${basename}-converted.${extension}`);
        const destination = testInfo.outputPath(`converted.${extension}`); await download.saveAs(destination);
        expect((await stat(destination)).size).toBe(result.bytes);
        const downloaded = await readFile(destination);
        const decoded = await page.evaluate(async ({ bytes, mime }) => {
            const blob = new Blob([new Uint8Array(bytes)], { type: mime }); const bitmap = await createImageBitmap(blob);
            try { return { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); }
        }, { bytes: [...downloaded], mime: result.mime });
        expect(decoded).toEqual({ width: 240, height: 180 });
        await testInfo.attach("conversion-pair", { body: JSON.stringify({ sourceFormat, target, quality: target === "png" ? null : 60, ...result, filename: download.suggestedFilename(), downloadedDecoded: decoded }), contentType: "application/json" });
    });
}

async function instrumentUrls(page: Page) {
    await page.addInitScript(() => {
        const log = { created: [] as string[], revoked: [] as string[] };
        Object.assign(window, { converterUrls: log });
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); log.created.push(url); return url; };
        URL.revokeObjectURL = url => { log.revoked.push(url); revoke(url); };
    });
}
const urls = (page: Page) => page.evaluate(() => (window as unknown as { converterUrls: { created: string[]; revoked: string[] } }).converterUrls);

test("format, quality, repetition, replacement, Reset and unmount revoke URLs", async ({ page }, testInfo) => {
    await instrumentUrls(page); await page.goto("/tool/image-converter"); await selectSource(page); await convert(page);
    const first = await urls(page); expect(first.created).toHaveLength(2);
    await page.getByLabel("Output format", { exact: true }).selectOption("webp");
    await expect(page.getByRole("link", { name: "Download converted image" })).toHaveCount(0);
    expect((await urls(page)).revoked).toEqual([first.created[1]]);
    await page.getByLabel("Quality", { exact: true }).fill("60"); await convert(page);
    const second = await urls(page);
    await page.getByLabel("Quality", { exact: true }).fill("75");
    await expect(page.getByRole("link", { name: "Download converted image" })).toHaveCount(0);
    expect((await urls(page)).revoked).toContain(second.created[2]);
    await page.getByLabel("Output format", { exact: true }).selectOption("png");
    await page.getByLabel("Output format", { exact: true }).selectOption("webp");
    await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("75");
    await convert(page); await convert(page);
    await selectSource(page, "png");
    await expect(page.getByLabel("Output format", { exact: true })).toHaveValue("jpeg");
    await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("90");
    const replaced = await urls(page);
    expect(replaced.revoked.slice().sort()).toEqual(replaced.created.slice(0, -1).sort());
    await convert(page); await page.getByRole("button", { name: "Reset", exact: true }).click();
    const reset = await urls(page); expect(reset.revoked.slice().sort()).toEqual(reset.created.slice().sort());
    await expect(page.getByLabel("Choose image")).toHaveValue("");
    await expect(page.getByRole("img")).toHaveCount(0);
    await selectSource(page); await convert(page);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "All tools", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect.poll(async () => { const log = await urls(page); return log.revoked.length === log.created.length; }).toBe(true);
    const log = await urls(page); expect(log.revoked.slice().sort()).toEqual(log.created.slice().sort());
    await testInfo.attach("object-url-lifecycle", { body: JSON.stringify(log), contentType: "application/json" });
});

test("unsupported, empty, corrupt and oversized inputs fail recoverably", async ({ page }) => {
    await page.goto("/tool/image-converter");
    const input = page.getByLabel("Choose image"), alert = page.getByRole("main").getByRole("alert");
    await input.setInputFiles({ name: "wrong.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
    await expect(alert).toContainText("not valid JPEG, PNG, or WebP image content");
    await input.setInputFiles({ name: "empty.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) });
    await expect(alert).toContainText("non-empty");
    await input.setInputFiles({ name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 0, 1]) });
    await expect(alert).toContainText("could not be decoded");
    await input.setInputFiles({ name: "large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(26_214_401) });
    await expect(alert).toContainText("maximum file size is 25 MiB");
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Convert image", exact: true })).toBeDisabled();
    await selectSource(page); await convert(page);
});

test("actual signature overrides misleading filename and MIME", async ({ page }) => {
    await page.goto("/tool/image-converter");
    await page.getByLabel("Choose image").setInputFiles({ name: "graphic.final.webp", mimeType: "image/webp", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible();
    await expect(page.getByLabel("Output format", { exact: true })).toHaveValue("png");
    await convert(page); expect((await inspectResult(page)).mime).toBe("image/png");
    await expect(page.getByRole("link", { name: "Download converted image" })).toHaveAttribute("download", "graphic.final-converted.png");
});

for (const failure of ["context", "encoding", "mime"] as const) {
    test(`canvas ${failure} failure is recoverable and has no download`, async ({ page }) => {
        await page.goto("/tool/image-converter"); await selectSource(page, "png");
        await page.evaluate(kind => {
            if (kind === "context") HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
            else HTMLCanvasElement.prototype.toBlob = callback => callback(kind === "mime" ? new Blob(["fallback"], { type: "image/png" }) : null);
        }, failure);
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByRole("main").getByRole("alert")).toContainText(failure === "context" ? "could not create the canvas" : "could not produce a valid");
        await expect(page.getByRole("link", { name: "Download converted image" })).toHaveCount(0);
        await expect(page.getByRole("img", { name: "Converted image preview" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    });
}

test("completed workflow preserves document flow, footer reachability and contained previews", async ({ page }, testInfo) => {
    await page.goto("/tool/image-converter"); await selectSource(page, "png");
    await page.getByLabel("Quality", { exact: true }).focus();
    await page.getByLabel("Quality", { exact: true }).press("ArrowLeft");
    await expect(page.getByLabel("Quality", { exact: true })).toHaveValue("85");
    await convert(page);
    await expect(page.getByRole("img", { name: "Converted image preview" })).toBeVisible();
    const layout = await page.getByRole("region", { name: "Source image" }).evaluate(source => {
        const root = source.parentElement!, main = source.closest("main")!, footer = document.querySelector("footer")!;
        return { height: document.documentElement.scrollHeight, viewport: innerHeight, width: document.documentElement.scrollWidth, viewportWidth: innerWidth,
            documentOwner: document.scrollingElement === document.documentElement,
            mainOverflow: getComputedStyle(main).overflowY, workspaceOverflow: getComputedStyle(root).overflowY,
            footerFollows: footer.getBoundingClientRect().top >= root.getBoundingClientRect().bottom,
            previewsFit: [...root.querySelectorAll("img")].every(image => image.getBoundingClientRect().width <= root.clientWidth) };
    });
    expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentOwner).toBe(true); expect(layout.footerFollows).toBe(true); expect(layout.previewsFit).toBe(true);
    expect(["auto", "scroll", "hidden"]).not.toContain(layout.mainOverflow);
    expect(["auto", "scroll", "hidden"]).not.toContain(layout.workspaceOverflow);
    if (testInfo.project.name === "mobile-chromium") expect(layout.height, "Actual completed mobile state must naturally overflow").toBeGreaterThan(layout.viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    if (layout.height > layout.viewport) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole("contentinfo")).toBeInViewport();
    const scrollY = await page.evaluate(() => window.scrollY);
    await testInfo.attach("completed-layout-scroll", { body: JSON.stringify({ ...layout, scrollY, footerInViewport: true }), contentType: "application/json" });
});

test("Reset and replacement reject a pending encode and close its stale bitmap", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        const native = window.createImageBitmap.bind(window);
        const control = { hold: false, pending: false, closed: false, release: () => {} };
        Object.assign(window, { converterDecode: control });
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
    await page.goto("/tool/image-converter"); await selectSource(page);
    await page.evaluate(() => { (window as unknown as { converterDecode: { hold: boolean } }).converterDecode.hold = true; });
    await page.getByRole("button", { name: "Convert image", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { converterDecode: { pending: boolean } }).converterDecode.pending)).toBe(true);
    const countBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_executed ?? 0);
    await page.getByRole("button", { name: "Reset", exact: true }).click(); await selectSource(page, "png");
    await page.evaluate(() => { (window as unknown as { converterDecode: { release: () => void } }).converterDecode.release(); });
    await expect.poll(() => page.evaluate(() => (window as unknown as { converterDecode: { closed: boolean } }).converterDecode.closed)).toBe(true);
    await expect(page.getByText("compressor-source.png", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download converted image" })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_executed ?? 0)).toBe(countBefore);
    await convert(page);
    await testInfo.attach("stale-operation", { body: JSON.stringify({ staleBitmapClosed: true, newerSelectionPreserved: true, staleResultAdopted: false }), contentType: "application/json" });
});


test("file information stays outside URL, storage and application network requests", async ({ page }, testInfo) => {
    const marker = "PRIVATE_CONVERTER_FILENAME_MARKER";
    const requests: { url: string; body: string | null }[] = [];
    page.on("request", request => requests.push({ url: request.url(), body: request.postData() }));
    await page.goto("/tool/image-converter");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_opened ?? 0)).toBe(1);
    const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    await page.getByLabel("Choose image").setInputFiles({ name: `${marker}.jpg`, mimeType: "image/jpeg", buffer: await readFile(fixturePath("jpg")) });
    await expect(page.getByText(/Source: 240 × 180 px/)).toBeVisible(); await convert(page);
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
