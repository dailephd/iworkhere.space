import path from "node:path";
import { test, expect } from "./support/fixture";

const heic = path.resolve("test/fixtures/images/heic-source.heic");
const image = path.resolve("test/fixtures/images/resizer-source.jpg");

for (const slug of ["image-resizer", "image-compressor", "image-converter", "heic-converter"]) {
    test(`${slug}: detailed size feedback precedes decoding and stays local`, async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(window, "feedbackDecodeCount", { value: { workers: 0, bitmaps: 0 } });
            const counts = (window as unknown as { feedbackDecodeCount: { workers: number; bitmaps: number } }).feedbackDecodeCount;
            const NativeWorker = window.Worker;
            window.Worker = class extends NativeWorker {
                constructor(url: string | URL, options?: WorkerOptions) { counts.workers++; super(url, options); }
            };
            const decode = window.createImageBitmap;
            window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
                counts.bitmaps++; return Reflect.apply(decode, window, args);
            }) as typeof createImageBitmap;
        });
        const requests: { url: string; body: string }[] = [];
        page.on("request", request => requests.push({ url: request.url(), body: request.postData() ?? "" }));
        await page.goto(`/tool/${slug}`);
        const input = page.getByLabel(slug === "heic-converter" ? "Choose HEIC image" : "Choose image", { exact: true });
        await input.setInputFiles({ name: "PRIVATE_FEEDBACK_26M.heic", mimeType: "image/heic", buffer: Buffer.alloc(26 * 1024 * 1024) });
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("This image is 26.0 MiB. The maximum file size is 25 MiB. Choose a smaller image.");
        expect(await page.evaluate(() => (window as unknown as { feedbackDecodeCount: unknown }).feedbackDecodeCount)).toEqual({ workers: 0, bitmaps: 0 });
        expect(page.url()).not.toContain("PRIVATE_FEEDBACK");
        expect(JSON.stringify(requests)).not.toMatch(/PRIVATE_FEEDBACK|26 MiB|26214400/);
        await expect(page.getByRole("main").getByRole("img")).toHaveCount(0);
    });
}

for (const slug of ["image-resizer", "image-compressor", "image-converter"]) {
    test(`${slug}: content, decode and pixel-limit errors give safe next actions`, async ({ page }) => {
        await page.goto(`/tool/${slug}`);
        const input = page.getByLabel("Choose image", { exact: true });
        const alert = page.getByRole("main").getByRole("alert");
        await input.setInputFiles({ name: "unsupported.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not image content") });
        await expect(alert).toHaveText("This file is not valid JPEG, PNG, or WebP image content. Choose a supported image.");
        await input.setInputFiles({ name: "corrupt.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 0, 1]) });
        await expect(alert).toContainText("The file format is supported, but the image data could not be decoded.");
        await expect(alert).toContainText("may be damaged or use an image variant this browser does not support");
        await page.evaluate(() => {
            window.createImageBitmap = (() => Promise.resolve({ width: 8256, height: 5504, close: () => {} })) as typeof createImageBitmap;
        });
        await input.setInputFiles(image);
        await expect(alert).toHaveText("This image is 8256 × 5504 px (45,441,024 pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller image.");
        await expect(page.getByRole("main").getByRole("img")).toHaveCount(0);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await expect(alert).toHaveCount(0);
    });
}

for (const failure of ["start", "runtime", "response", "dimensions"] as const) {
    test(`HEIC ${failure} feedback is bounded, actionable and recoverable`, async ({ page }) => {
        await page.addInitScript(kind => {
            const NativeWorker = window.Worker;
            if (kind === "start") {
                window.Worker = class extends NativeWorker {
                    constructor(url: string | URL, options?: WorkerOptions) { throw new Error("PRIVATE_INTERNAL_DIAGNOSTIC"); super(url, options); }
                };
                return;
            }
            window.Worker = class extends NativeWorker {
                set onmessage(listener: ((this: Worker, event: MessageEvent) => unknown) | null) {
                    super.onmessage = listener ? event => {
                        const data = kind === "dimensions"
                            ? { id: event.data.id, status: "error", category: "source-dimension-limit", sourceWidth: 8256, sourceHeight: 5504 }
                            : { id: event.data.id, status: "inspected", stack: "PRIVATE_INTERNAL_DIAGNOSTIC" };
                        listener.call(this, new MessageEvent("message", { data }));
                    } : null;
                }
                postMessage(message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
                    if (kind === "runtime") {
                        queueMicrotask(() => this.onerror?.(new ErrorEvent("error", { message: "PRIVATE_INTERNAL_DIAGNOSTIC" })));
                    } else if (Array.isArray(transfer)) super.postMessage(message, transfer);
                    else super.postMessage(message, transfer);
                }
            };
        }, failure);
        await page.goto("/tool/heic-converter");
        await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles(heic);
        const alert = page.getByRole("main").getByRole("alert");
        const messages = {
            start: "HEIC processing could not start because the browser could not create the decoder worker. Reload the page and try again, or use another current browser.",
            runtime: "The HEIC decoder worker stopped unexpectedly while processing this image. Reset the tool and try again. If the problem repeats, try another current browser.",
            response: "The HEIC decoder returned an invalid response, so the result was discarded. Reset the tool and try again.",
            dimensions: "This HEIC image is 8256 × 5504 px (45,441,024 pixels). The maximum is 30,000,000 pixels (30 MP). Choose a smaller HEIC or HEIF image.",
        };
        await expect(alert).toHaveText(messages[failure]);
        await expect(alert).not.toContainText("PRIVATE_INTERNAL_DIAGNOSTIC");
        await expect(page.getByAltText("Selected HEIC source preview")).toHaveCount(0);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await expect(alert).toHaveCount(0);
    });
}
