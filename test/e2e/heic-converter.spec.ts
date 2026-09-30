import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const fixture = path.resolve("test/fixtures/images/heic-source.heic");
const chunkRoot = path.resolve(".next/static/chunks");
const decoderAssets = readdirSync(chunkRoot, { recursive: true }).filter((name): name is string =>
    typeof name === "string" && name.endsWith(".js") && readFileSync(path.join(chunkRoot, name)).includes("HeifDecoder"));

interface WorkerRecord { terminated: boolean; operation?: string }
interface Control {
    workers: WorkerRecord[];
    urls: { url: string; type: string; bytes: number }[];
    revoked: string[];
    hold: boolean;
    held: number;
    release: () => void;
}
interface InstrumentedWindow extends Window { heicControl: Control }

async function instrument(page: Page) {
    await page.addInitScript(() => {
        const control: Control = { workers: [], urls: [], revoked: [], hold: false, held: 0, release: () => {} };
        const queued: (() => void)[] = [];
        control.release = () => { for (const deliver of queued.splice(0)) deliver(); };
        (window as unknown as InstrumentedWindow).heicControl = control;
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            private record: WorkerRecord;
            private listener: ((this: Worker, event: MessageEvent) => unknown) | null = null;
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                this.record = { terminated: false };
                control.workers.push(this.record);
            }
            set onmessage(listener: ((this: Worker, event: MessageEvent) => unknown) | null) {
                this.listener = listener;
                super.onmessage = listener ? event => {
                    const deliver = () => listener.call(this, event);
                    if (control.hold) { control.hold = false; control.held++; queued.push(deliver); }
                    else deliver();
                } : null;
            }
            get onmessage() { return this.listener; }
            postMessage(message: { operation?: string }, transfer: Transferable[] | StructuredSerializeOptions = []) {
                this.record.operation = message.operation;
                if (Array.isArray(transfer)) super.postMessage(message, transfer);
                else super.postMessage(message, transfer);
            }
            terminate() { this.record.terminated = true; super.terminate(); }
        };
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => {
            const url = create(blob);
            if (blob instanceof Blob && ["image/png", "image/jpeg"].includes(blob.type)) control.urls.push({ url, type: blob.type, bytes: blob.size });
            return url;
        };
        URL.revokeObjectURL = url => { control.revoked.push(url); revoke(url); };
    });
}

async function snapshot(page: Page) {
    return page.evaluate(() => {
        const control = (window as unknown as InstrumentedWindow).heicControl;
        return { workers: control.workers, urls: control.urls, revoked: control.revoked, held: control.held };
    });
}
async function select(page: Page, name?: string) {
    const count = (await snapshot(page)).workers.length;
    await page.getByLabel("Choose HEIC image").setInputFiles(name ? { name, mimeType: "image/heic", buffer: readFileSync(fixture) } : fixture);
    await expect.poll(async () => (await snapshot(page)).workers.length).toBe(count + 1);
    await expect.poll(async () => (await snapshot(page)).workers.at(-1)?.terminated).toBe(true);
    await expect(page.getByAltText("Selected HEIC source preview")).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Source HEIC image" })).toContainText("480 × 320");
}
async function decoded(page: Page, alt: string) {
    const url = await page.getByAltText(alt).getAttribute("src");
    return page.evaluate(async source => {
        const blob = await (await fetch(source!)).blob();
        const bitmap = await createImageBitmap(blob);
        const result = { type: blob.type, bytes: blob.size, width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
    }, url);
}

test.describe("HEIC converter", () => {
    test.setTimeout(90_000);
    for (const target of ["jpeg", "png"] as const) {
        test(`real ${target} inspection, conversion, download and containment`, async ({ page }, testInfo) => {
            await instrument(page);
            const requests: string[] = [];
            page.on("request", request => requests.push(request.url()));
            await page.goto("/tool/heic-converter");
            expect((await snapshot(page)).workers).toHaveLength(0);
            expect(requests.some(url => decoderAssets.some(asset => url.endsWith(asset)))).toBe(false);
            await select(page);
            expect(await decoded(page, "Selected HEIC source preview")).toMatchObject({ type: "image/png", width: 480, height: 320 });
            expect((await snapshot(page)).workers).toEqual([{ operation: "inspect", terminated: true }]);
            await page.getByLabel("Output format").selectOption(target);
            if (target === "jpeg") await page.getByLabel("Quality", { exact: true }).fill("60");
            else await expect(page.getByLabel("Quality", { exact: true })).toHaveCount(0);
            await page.getByRole("button", { name: "Convert image", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Converted image ready" })).toBeVisible();
            const output = await decoded(page, "Converted image preview");
            expect(output).toMatchObject({ type: `image/${target}`, width: 480, height: 320 });
            expect(output.bytes).toBeGreaterThan(0);
            const downloadPromise = page.waitForEvent("download");
            await page.getByRole("link", { name: "Download converted image" }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBe(`heic-source-converted.${target === "jpeg" ? "jpg" : "png"}`);
            await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
            expect(await download.failure()).toBeNull();
            expect((await snapshot(page)).workers).toEqual([
                { operation: "inspect", terminated: true }, { operation: "convert", terminated: true },
            ]);
            expect(requests.some(url => decoderAssets.some(asset => url.endsWith(asset)))).toBe(true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            const layout = await page.evaluate(() => {
                const workspace = document.querySelector("main section:has(>h1)")!;
                const box = workspace.getBoundingClientRect();
                const images = [...workspace.querySelectorAll("img")].map(image => image.getBoundingClientRect());
                return {
                    previewsContained: images.every(image => image.left >= box.left && image.right <= box.right),
                    documentOwnsScroll: document.scrollingElement === document.documentElement,
                    clippedAncestor: [...document.querySelectorAll("main, main section")].some(element =>
                        ["hidden", "auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight),
                };
            });
            expect(layout).toEqual({ previewsContained: true, documentOwnsScroll: true, clippedAncestor: false });
            await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
            await expect(page.getByRole("contentinfo")).toBeVisible();
            await testInfo.attach("real-output", { body: JSON.stringify({ output, workers: (await snapshot(page)).workers }), contentType: "application/json" });
        });
    }

    test("size precheck prevents workers and decoder requests", async ({ page }) => {
        await instrument(page);
        const requests: string[] = [];
        page.on("request", request => requests.push(request.url()));
        await page.goto("/tool/heic-converter");
        await page.getByLabel("Choose HEIC image").setInputFiles({ name: "oversize.heic", mimeType: "image/heic", buffer: Buffer.alloc(26_214_401) });
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
        expect((await snapshot(page)).workers).toHaveLength(0);
        expect(requests.some(url => decoderAssets.some(asset => url.endsWith(asset)))).toBe(false);
        await page.getByLabel("Choose HEIC image").setInputFiles({ name: "empty.heic", mimeType: "image/heic", buffer: Buffer.alloc(0) });
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
        expect((await snapshot(page)).workers).toHaveLength(0);
    });

    test("content detection rejects fake HEIC and accepts misleading metadata", async ({ page }) => {
        await instrument(page);
        await page.goto("/tool/heic-converter");
        await page.getByLabel("Choose HEIC image").setInputFiles({ name: "fake.heic", mimeType: "image/heic", buffer: readFileSync("test/fixtures/images/compressor-source.jpg") });
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("This file is not valid HEIC or HEIF content. Choose a HEIC or HEIF image.");
        await expect(page.getByAltText("Selected HEIC source preview")).toHaveCount(0);
        expect((await snapshot(page)).workers[0].terminated).toBe(true);
        await page.getByLabel("Choose HEIC image").setInputFiles({ name: "misleading.jpg", mimeType: "image/jpeg", buffer: readFileSync(fixture) });
        await expect(page.getByAltText("Selected HEIC source preview")).toBeVisible();
        expect(await decoded(page, "Selected HEIC source preview")).toMatchObject({ width: 480, height: 320 });
    });

    for (const action of ["reset", "replace", "navigate"] as const) {
        test(`pending inspection ${action} terminates worker and ignores late response`, async ({ page }) => {
            await instrument(page);
            await page.goto("/tool/heic-converter");
            await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.hold = true; });
            await page.getByLabel("Choose HEIC image").setInputFiles(fixture);
            await expect.poll(async () => (await snapshot(page)).held).toBe(1);
            await expect(page.getByText("Reading HEIC…", { exact: true })).toBeVisible();
            if (action === "reset") await page.getByRole("button", { name: "Reset", exact: true }).click();
            if (action === "replace") await page.getByLabel("Choose HEIC image").setInputFiles({ name: "empty.heic", mimeType: "image/heic", buffer: Buffer.alloc(0) });
            if (action === "navigate") { await page.getByRole("link", { name: "Discover Browse all tool", exact: true }).first().click(); await expect(page).toHaveURL(/\/discover$/); await expect(page.getByLabel("Choose HEIC image")).toHaveCount(0); }
            expect((await snapshot(page)).workers[0].terminated).toBe(true);
            await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.release(); });
            await expect(page.getByAltText("Selected HEIC source preview")).toHaveCount(0);
            if (action !== "replace") await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
            await expect(page.getByRole("heading", { name: "Converted image ready" })).toHaveCount(0);
        });
    }

    test("result and preview URL ownership survives changes, Reset and unmount", async ({ page }) => {
        await instrument(page);
        await page.goto("/tool/heic-converter");
        await select(page);
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        const first = await snapshot(page);
        await page.getByLabel("Quality", { exact: true }).fill("60");
        await expect(page.getByAltText("Converted image preview")).toHaveCount(0);
        expect((await snapshot(page)).revoked).toContain(first.urls[1].url);
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        await page.getByLabel("Output format").selectOption("png");
        expect((await snapshot(page)).revoked).toContain((await snapshot(page)).urls[2].url);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        let state = await snapshot(page);
        expect(state.urls.every(item => state.revoked.includes(item.url))).toBe(true);
        await select(page);
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        const replacedResult = await page.getByAltText("Converted image preview").getAttribute("src");
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect.poll(async () => page.getByAltText("Converted image preview").getAttribute("src")).not.toBe(replacedResult);
        expect((await snapshot(page)).revoked).toContain(replacedResult);
        const beforeReplacement = await snapshot(page);
        await select(page, "replacement.heic");
        state = await snapshot(page);
        expect(beforeReplacement.urls.every(item => state.revoked.includes(item.url))).toBe(true);
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        await page.getByRole("link", { name: "Discover Browse all tool", exact: true }).first().click();
        await expect(page.getByLabel("Choose HEIC image")).toHaveCount(0);
        state = await snapshot(page);
        expect(state.urls.every(item => state.revoked.includes(item.url))).toBe(true);
    });

    test("cancelled conversion cannot adopt late output or emit execution telemetry", async ({ page }) => {
        await instrument(page);
        await page.goto("/tool/heic-converter");
        await select(page);
        const count = await page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_executed ?? 0);
        await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.hold = true; });
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect.poll(async () => (await snapshot(page)).held).toBe(1);
        await expect(page.getByRole("button", { name: "Converting\u2026", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        expect((await snapshot(page)).workers.every(worker => worker.terminated)).toBe(true);
        await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.release(); });
        await expect(page.getByAltText("Converted image preview")).toHaveCount(0);
        await expect(page.getByAltText("Selected HEIC source preview")).toHaveCount(0);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("analytic_event_count") ?? "{}").tool_executed ?? 0)).toBe(count);
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });

    test("settings are guarded during conversion and invalidate results without alerts", async ({ page }) => {
        await instrument(page);
        await page.goto("/tool/heic-converter");
        await select(page);
        await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.hold = true; });
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect.poll(async () => (await snapshot(page)).held).toBe(1);
        await expect(page.getByLabel("Quality", { exact: true })).toBeDisabled();
        await expect(page.getByLabel("Output format", { exact: true })).toBeDisabled();
        await page.evaluate(() => { (window as unknown as InstrumentedWindow).heicControl.release(); });
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        const resultUrl = await page.getByAltText("Converted image preview").getAttribute("src");
        await page.getByLabel("Quality", { exact: true }).fill("60");
        await expect(page.getByAltText("Converted image preview")).toHaveCount(0);
        expect((await snapshot(page)).revoked).toContain(resultUrl);
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });

    test("processing stays local and private filename never enters requests", async ({ page }) => {
        await instrument(page);
        const marker = "PRIVATE_HEIC_MARKER_731";
        const requests: { url: string; body: string; method: string }[] = [];
        page.on("request", request => requests.push({ url: request.url(), body: request.postData() ?? "", method: request.method() }));
        await page.goto("/tool/heic-converter");
        const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
        await page.getByLabel("Choose HEIC image").setInputFiles({ name: `${marker}.heic`, mimeType: "image/heic", buffer: readFileSync(fixture) });
        await expect(page.getByAltText("Selected HEIC source preview")).toBeVisible();
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
        expect(page.url()).not.toContain(marker);
        expect(JSON.stringify(requests)).not.toContain(marker);
        expect(requests.filter(request => !request.url.startsWith("blob:") && new URL(request.url).origin !== "http://127.0.0.1:3100")).toEqual([]);
        expect(requests.filter(request => request.method === "POST").every(request => request.url.endsWith("/api/log") && !request.body.includes("image/heic") && !request.body.includes("480"))).toBe(true);
        const counter = JSON.parse(storageBefore.local.analytic_event_count ?? "{}");
        const expectedCounter = { ...counter, tool_executed: (counter.tool_executed ?? 0) + 1 };
        const storageAfter = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
        expect(storageAfter).toEqual({ ...storageBefore, local: { ...storageBefore.local, analytic_event_count: JSON.stringify(expectedCounter) } });
        expect(JSON.stringify(storageAfter)).not.toContain(marker);
    });
});
