import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Download, Locator, Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { test, expect } from "./support/fixture";

const ROUTE = "/workflows/prepare-image-for-upload";
const SOURCE_LABEL = "Source image (JPEG, PNG or WebP)";
const fixturePath = (name: string) => path.resolve("test/fixtures/images", name);

/* Fixture facts, measured from the committed files: 240 x 180 px, noisy JPEG 107,911 bytes; 80 x 60 px JPEG 1,000 bytes. */
const NOISY_JPEG = "compressor-source.jpg";
const NOISY_PNG = "compressor-source.png";
const SMALL_JPEG = "resizer-source.jpg";
const ALPHA_WEBP = "converter-transparent.webp";

interface Requirement { format?: "jpeg" | "png" | "webp"; width?: string; height?: string; bytes?: string }
interface Measured { mime: string; width: number; height: number; byteLength: number }
interface WorkflowWindow extends Window { __gate: Promise<void> | null; __release: () => void; __stageLog: string[]; __created: string[]; __revoked: string[] }

function sniff(bytes: Buffer): string {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return "unknown";
}

/** Decodes bytes in the browser, so the assertion rests on real decoded pixels rather than a UI label. */
async function measure(page: Page, bytes: Buffer): Promise<Measured> {
    const decoded = await page.evaluate(async (base64) => {
        const raw = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([raw]));
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
    }, bytes.toString("base64"));
    return { mime: sniff(bytes), ...decoded, byteLength: bytes.length };
}

/** Instruments the page: a stage-transition log and an optional gate on canvas encoding for deterministic busy states. */
async function instrument(page: Page) {
    await page.addInitScript(() => {
        const target = window as unknown as WorkflowWindow;
        target.__gate = null;
        target.__release = () => undefined;
        target.__stageLog = [];
        target.__created = [];
        target.__revoked = [];
        const createObjectURL = URL.createObjectURL.bind(URL), revokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (object: Blob | MediaSource) => { const url = createObjectURL(object); target.__created.push(url); return url; };
        URL.revokeObjectURL = (url: string) => { target.__revoked.push(url); revokeObjectURL(url); };
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
            const gate = target.__gate;
            if (!gate) return original.call(this, callback, type, quality);
            void gate.then(() => original.call(this, callback, type, quality));
        };
        const last = new Map<string, string>();
        const record = () => {
            document.querySelectorAll("[data-stage]").forEach(item => {
                const stage = item.getAttribute("data-stage")!, state = item.getAttribute("data-state")!;
                if (last.get(stage) !== state) { last.set(stage, state); target.__stageLog.push(`${stage}:${state}`); }
            });
        };
        new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
    });
}

async function armGate(page: Page) {
    await page.evaluate(() => {
        const target = window as unknown as WorkflowWindow;
        target.__gate = new Promise<void>(release => { target.__release = release; });
    });
}
async function releaseGate(page: Page) { await page.evaluate(() => (window as unknown as WorkflowWindow).__release()); }
async function stageLog(page: Page) { return page.evaluate(() => (window as unknown as WorkflowWindow).__stageLog); }
async function revokedUrl(page: Page) { return page.evaluate(() => (window as unknown as WorkflowWindow).__revoked); }
async function createdUrl(page: Page) { return page.evaluate(() => (window as unknown as WorkflowWindow).__created); }

async function openWorkflow(page: Page) {
    await page.goto(ROUTE);
    await expect(page.getByRole("heading", { level: 1, name: "Prepare an Image for Upload" })).toBeVisible();
}

async function chooseSource(page: Page, name: string) {
    await page.getByLabel(SOURCE_LABEL).setInputFiles(fixturePath(name));
    await expect(page.locator("[data-workflow-source]")).toBeVisible();
}

async function setRequirement(page: Page, requirement: Requirement) {
    if (requirement.format) await page.getByLabel("Output format").selectOption(requirement.format);
    if (requirement.width !== undefined) await page.getByLabel("Maximum width (pixels)").fill(requirement.width);
    if (requirement.height !== undefined) await page.getByLabel("Maximum height (pixels)").fill(requirement.height);
    if (requirement.bytes !== undefined) await page.getByLabel("Maximum file size (bytes)").fill(requirement.bytes);
}

const processButton = (page: Page) => page.getByRole("button", { name: /^(Process image|Processing\.\.\.)$/ });

async function processToResult(page: Page, name: string, requirement: Requirement) {
    await chooseSource(page, name);
    await setRequirement(page, requirement);
    await processButton(page).click();
}

async function downloadResult(page: Page): Promise<{ download: Download; name: string; bytes: Buffer }> {
    const link = page.locator("[data-workflow-download]");
    await expect(link).toBeVisible();
    const waiting = page.waitForEvent("download");
    await link.click();
    const download = await waiting;
    const location = await download.path();
    return { download, name: download.suggestedFilename(), bytes: await readFile(location) };
}

async function expectNoHorizontalOverflow(page: Page, state: string) {
    const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(overflow.scroll, `${state}: no horizontal page overflow`).toBeLessThanOrEqual(overflow.inner);
}

test.describe("prepare-image-for-upload: route and server content", () => {
    test("serves working server-visible content, metadata and canonical URL", async ({ request, page }) => {
        const response = await request.get(ROUTE);
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain("Prepare an Image for Upload");
        expect(html).toContain("Maximum file size (bytes)");
        expect(html).toContain('rel="canonical" href="https://iworkhere.space/workflows/prepare-image-for-upload"');
        expect(html).toContain("<title>Prepare an Image for Upload - iworkhere</title>");
        await page.goto(ROUTE);
        await expect(page).toHaveTitle("Prepare an Image for Upload - iworkhere");
        await expect(page.getByRole("link", { name: "Find another tool or workflow" })).toHaveAttribute("href", "/guide");
        await expect(page.locator('main a[href="/guide/prepare-image-for-upload"]')).toHaveCount(0);
    });

    test("returns 404 for unknown workflow slugs and offers no Process control there", async ({ request }) => {
        for (const slug of ["not-a-workflow", "prepare-image-for-upload/extra", "HEIC-PHOTOS-TO-PDF", "heic-photos-to-pdf-2"]) {
            expect((await request.get(`/workflows/${slug}`)).status(), slug).toBe(404);
        }
        const unknown = await (await request.get("/workflows/not-a-workflow")).text();
        expect(unknown).not.toContain("Process image");
        expect(unknown).not.toContain("Create PDF");
        expect(unknown).not.toContain("workflow-source");
    });

    test("lists all four workflows as links to their own detail routes and no coming-soon entry", async ({ page }) => {
        await page.goto("/workflows");
        const main = page.getByRole("main");
        await expect(main.locator('a[href^="/workflows/"]')).toHaveCount(4);
        const expectedTitle: Record<string, string> = {
            "prepare-image-for-upload": "Prepare an Image for Upload",
            "heic-photos-to-pdf": "HEIC Photos to PDF",
            "assemble-pdf-packet": "Assemble a PDF Packet",
            "pdf-pages-for-slides": "PDF Pages for Slides",
        };
        for (const [slug, title] of Object.entries(expectedTitle)) {
            await expect(main.locator(`a[href="/workflows/${slug}"] h3`)).toHaveText(title);
            await expect(page.locator(`[data-available-workflow="${slug}"]`)).toHaveCount(1);
        }
        await expect(page.locator("[data-planned-workflow]")).toHaveCount(0);
        await expect(page.getByText("Coming soon")).toHaveCount(0);
        await expect(page.locator("[data-workflows-status]")).toContainText("4 workflows are available now");
        await expectNoHorizontalOverflow(page, "workflows landing");
    });

    test("redirects the former manual guides permanently and keeps the sitemap contract: 36 URLs with four workflow detail URLs", async ({ request }) => {
        for (const slug of ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"]) {
            const response = await request.get(`/guide/${slug}`, { maxRedirects: 0 });
            expect(response.status(), `/guide/${slug} redirects permanently`).toBe(308);
            expect(new URL(response.headers()["location"], "http://127.0.0.1").pathname).toBe(`/workflows/${slug}`);
        }
        const xml = await (await request.get("/sitemap.xml")).text();
        const location = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        expect(location).toHaveLength(36);
        expect(new Set(location).size).toBe(36);
        expect(location.filter(url => url.includes("/workflows/"))).toEqual([
            "https://iworkhere.space/workflows/prepare-image-for-upload",
            "https://iworkhere.space/workflows/heic-photos-to-pdf",
            "https://iworkhere.space/workflows/assemble-pdf-packet",
            "https://iworkhere.space/workflows/pdf-pages-for-slides",
        ]);
        expect(location.filter(url => url.includes("/tool/"))).toHaveLength(18);
    });

    for (const [slug, title, control] of [
        ["heic-photos-to-pdf", "HEIC Photos to PDF", "Create PDF"],
        ["assemble-pdf-packet", "Assemble a PDF Packet", "Assemble packet"],
        ["pdf-pages-for-slides", "PDF Pages for Slides", "Export slide images"],
    ] as const) {
        test(`${slug}: serves server-visible content, canonical URL, title and the guide-finder link`, async ({ request, page }) => {
            const response = await request.get(`/workflows/${slug}`);
            expect(response.status()).toBe(200);
            const html = await response.text();
            expect(html).toContain(title);
            expect(html).toContain(`rel="canonical" href="https://iworkhere.space/workflows/${slug}"`);
            expect(html).toContain(`<title>${title} - iworkhere</title>`);
            expect(html).toContain(control);
            await page.goto(`/workflows/${slug}`);
            await expect(page).toHaveTitle(`${title} - iworkhere`);
            await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
            await expect(page.getByRole("link", { name: "Find another tool or workflow" })).toHaveAttribute("href", "/guide");
            await expect(page.locator(`main a[href="/guide/${slug}"]`)).toHaveCount(0);
            await expect(page.getByRole("button", { name: control, exact: true })).toBeDisabled();
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
            await expectNoHorizontalOverflow(page, `${slug} initial`);
        });
    }
});

test.describe("prepare-image-for-upload: one-click processing with verified downloads", () => {
    test.beforeEach(async ({ page }) => { await instrument(page); await openWorkflow(page); });

    test("starts with no progress claim and shows the source facts after inspection", async ({ page }) => {
        await expect(page.locator("[data-workflow-status]")).toContainText("Nothing has run yet");
        await expect(page.locator('[data-stage][data-state="pending"]')).toHaveCount(7);
        await expect(processButton(page)).toBeDisabled();
        await expect(page.getByLabel("Maximum width (pixels)")).toHaveValue("800");
        await expect(page.getByLabel("Maximum height (pixels)")).toHaveValue("600");
        await expect(page.getByLabel("Maximum file size (bytes)")).toHaveValue("100000");
        await chooseSource(page, SMALL_JPEG);
        await expect(page.locator("[data-workflow-source]")).toHaveText("resizer-source.jpg: JPEG, 80 x 60 px, 1,000 bytes");
        expect((await stageLog(page)).filter(entry => !entry.endsWith(":pending")), "no stage has left pending before Process").toEqual([]);
        await expectNoHorizontalOverflow(page, "initial");
    });

    test("preserves a compliant source byte for byte, skips the optional stages and runs every stage from one click", async ({ page }) => {
        await processToResult(page, SMALL_JPEG, {});
        await expect(page.locator("[data-workflow-download]")).toBeVisible();
        const result = await downloadResult(page);
        expect(result.bytes.equals(await readFile(fixturePath(SMALL_JPEG)))).toBe(true);
        expect(result.name).toBe("resizer-source-prepared.jpg");
        expect(await measure(page, result.bytes)).toEqual({ mime: "image/jpeg", width: 80, height: 60, byteLength: 1000 });
        const started = (await stageLog(page)).filter(entry => !entry.endsWith(":pending")).map(entry => entry.split(":")[0]).filter((stage, index, all) => all.indexOf(stage) === index);
        expect(started, "stages leave pending in the fixed order").toEqual(["validate", "inspect", "convert", "resize", "compress", "verify", "complete"]);
        await expect(page.locator("[data-stage]")).toHaveCount(7);
        for (const stage of ["convert", "resize", "compress"]) {
            await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute("data-state", "skipped");
            await expect(page.locator(`[data-stage="${stage}"]`)).toContainText("Skipped:");
        }
        await expect(page.locator("[data-workflow-check-list] li")).toHaveCount(7);
        await expect(page.locator("[data-workflow-check-list]")).not.toContainText("Failed:");
        await expect(page.locator("[data-workflow-status]")).toContainText("Done.");
        await expectNoHorizontalOverflow(page, "success");
    });

    test("converts a transparent WebP to JPEG with the transparent area flattened on white", async ({ page }) => {
        await processToResult(page, ALPHA_WEBP, { format: "jpeg", bytes: "1000000" });
        const result = await downloadResult(page);
        expect(result.name).toBe("converter-transparent-prepared.jpg");
        expect(await measure(page, result.bytes)).toMatchObject({ mime: "image/jpeg", width: 240, height: 180 });
        await expect(page.locator("[data-stage=convert]")).toHaveAttribute("data-state", "passed");
        const source = await readFile(fixturePath(ALPHA_WEBP));
        const flattened = await page.evaluate(async ({ sourceBase64, outputBase64 }) => {
            const decode = async (base64: string, type: string) => {
                const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), character => character.charCodeAt(0))], { type }));
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width; canvas.height = bitmap.height;
                const context = canvas.getContext("2d", { willReadFrequently: true })!;
                context.drawImage(bitmap, 0, 0);
                return context.getImageData(0, 0, canvas.width, canvas.height).data;
            };
            const original = await decode(sourceBase64, "image/webp"), output = await decode(outputBase64, "image/jpeg");
            let transparent = 0, flatWhite = 0;
            for (let index = 0; index < original.length; index += 4) {
                if (original[index + 3] !== 0) continue;
                transparent += 1;
                if (output[index] >= 240 && output[index + 1] >= 240 && output[index + 2] >= 240) flatWhite += 1;
            }
            return { transparent, flatWhite };
        }, { sourceBase64: source.toString("base64"), outputBase64: result.bytes.toString("base64") });
        expect(flattened.transparent, "the fixture really contains fully transparent pixels").toBeGreaterThan(0);
        expect(flattened.flatWhite / flattened.transparent, "transparent pixels become white, not black").toBeGreaterThan(0.95);
    });

    test("converts JPEG to WebP and PNG, keeping the explicitly selected format", async ({ page }) => {
        await chooseSource(page, NOISY_JPEG);
        for (const [format, mime] of [["webp", "image/webp"], ["png", "image/png"]] as const) {
            await setRequirement(page, { format, bytes: "5000000" });
            await processButton(page).click();
            const result = await downloadResult(page);
            expect(await measure(page, result.bytes)).toMatchObject({ mime, width: 240, height: 180 });
            expect(result.name.endsWith(format === "webp" ? ".webp" : ".png")).toBe(true);
        }
    });

    test("resizes to fit both bounds preserving aspect ratio and never upscales", async ({ page }) => {
        await processToResult(page, NOISY_JPEG, { format: "jpeg", width: "120", height: "120", bytes: "5000000" });
        const shrunk = await downloadResult(page);
        expect(await measure(page, shrunk.bytes)).toMatchObject({ mime: "image/jpeg", width: 120, height: 90 });
        await expect(page.locator("[data-stage=resize]")).toHaveAttribute("data-state", "passed");
        await expect(page.locator("[data-workflow-prepared]")).toContainText("120 x 90 px");

        await setRequirement(page, { width: "4000", height: "4000" });
        await processButton(page).click();
        const same = await downloadResult(page);
        expect(await measure(page, same.bytes), "a smaller image is not upscaled").toMatchObject({ width: 240, height: 180 });
        await expect(page.locator("[data-stage=resize]")).toHaveAttribute("data-state", "skipped");
    });

    test("finds a real output within the byte cap in the selected format and verifies the actual downloaded bytes", async ({ page }) => {
        await processToResult(page, NOISY_JPEG, { format: "jpeg", bytes: "20000" });
        const result = await downloadResult(page);
        const measured = await measure(page, result.bytes);
        expect(measured.mime).toBe("image/jpeg");
        expect(measured.byteLength).toBeLessThanOrEqual(20000);
        expect(measured.width).toBeLessThanOrEqual(240);
        expect(measured.height).toBeLessThanOrEqual(180);
        expect(measured.byteLength).toBeLessThan(107911);
        await expect(page.locator("[data-stage=compress]")).toHaveAttribute("data-state", "passed");
        await expect(page.locator("[data-workflow-prepared]")).toContainText(`${measured.byteLength.toLocaleString("en-US")} bytes`);
        await expect(page.locator("[data-workflow-prepared]")).toContainText(`${measured.width} x ${measured.height} px`);
        await expect(page.locator("[data-workflow-check-list]")).toContainText("Passed: Output size in bytes");
    });

    test("fails an impossible byte cap with measured unmet checks and no download, for JPEG and for PNG that stays PNG", async ({ page }) => {
        await processToResult(page, NOISY_JPEG, { format: "jpeg", bytes: "50" });
        const alert = page.locator('[data-workflow-failure="UNMET_REQUIREMENT"]');
        await expect(alert).toBeVisible();
        await expect(alert).toHaveAttribute("role", "alert");
        await expect(alert).toContainText("Failed: Output size in bytes. Expected at most 50, observed");
        await expect(alert).toContainText("No file is offered for download.");
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        await expect(page.locator("[data-stage=compress]")).toHaveAttribute("data-state", "failed");
        await expect(page.locator("[data-stage=verify]")).toHaveAttribute("data-state", "pending");
        await expect(page.locator("[data-workflow-status]")).toContainText("stopped without producing a file");

        await setRequirement(page, { format: "png", bytes: "50" });
        await processButton(page).click();
        await expect(page.locator('[data-workflow-failure="UNMET_REQUIREMENT"]')).toContainText("No PNG output within 50 bytes");
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        await expectNoHorizontalOverflow(page, "unmet requirement");
    });

    test("rejects an unsupported or corrupt file with a specific alert and never offers Process", async ({ page }) => {
        await page.getByLabel(SOURCE_LABEL).setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("this is plain text, not an image") });
        await expect(page.locator('[data-workflow] [role="alert"]')).toContainText("not valid JPEG, PNG, or WebP");
        await expect(processButton(page)).toBeDisabled();
        const truncated = (await readFile(fixturePath(NOISY_JPEG))).subarray(0, 12);
        await page.getByLabel(SOURCE_LABEL).setInputFiles({ name: "cut.jpg", mimeType: "image/jpeg", buffer: truncated });
        await expect(page.locator('[data-workflow] [role="alert"]')).toContainText(/could not be decoded|not valid/);
        await expect(processButton(page)).toBeDisabled();
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
    });

    test("blocks invalid numbers with field errors and starts no run", async ({ page }) => {
        await chooseSource(page, SMALL_JPEG);
        for (const [field, value] of [["Maximum width (pixels)", ""], ["Maximum height (pixels)", "0"], ["Maximum file size (bytes)", "12.5"]] as const) {
            await setRequirement(page, { width: "800", height: "600", bytes: "100000" });
            await page.getByLabel(field).fill(value);
            await processButton(page).click();
            await expect(page.getByLabel(field)).toHaveAttribute("aria-invalid", "true");
            await expect(page.locator("[data-stage][data-state='running']")).toHaveCount(0);
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        }
        expect((await stageLog(page)).filter(entry => !entry.endsWith(":pending")), "no stage left pending: no run started").toEqual([]);
    });
});

test.describe("prepare-image-for-upload: run lifecycle in the browser", () => {
    test.beforeEach(async ({ page }) => { await instrument(page); await openWorkflow(page); });

    test("suppresses a second run while active, cancels, then retries successfully", async ({ page }) => {
        await chooseSource(page, NOISY_PNG);
        await setRequirement(page, { format: "jpeg", bytes: "5000000" });
        await armGate(page);
        await processButton(page).click();
        await expect(page.locator("[data-stage=convert]")).toHaveAttribute("data-state", "running");
        await expect(processButton(page)).toBeDisabled();
        await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
        await expect(page.getByLabel("Maximum width (pixels)")).toBeDisabled();
        await expect(page.locator("[data-workflow-status]")).toContainText("Convert: Converting PNG to JPEG");
        await page.getByRole("button", { name: "Cancel" }).click();
        await releaseGate(page);
        await expect(page.locator("[data-workflow-cancelled]")).toBeVisible();
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        await expect(page.locator("[data-stage=convert]")).toHaveAttribute("data-state", "cancelled");
        await expect(processButton(page)).toBeEnabled();
        await processButton(page).click();
        const retry = await downloadResult(page);
        expect(await measure(page, retry.bytes)).toMatchObject({ mime: "image/jpeg", width: 240, height: 180 });
        expect(await createdUrl(page), "exactly one result URL was created: the cancelled run produced none").toHaveLength(1);
    });

    test("invalidates and revokes the previous output when a requirement or the file changes", async ({ page }) => {
        await processToResult(page, SMALL_JPEG, {});
        const href = (await page.locator("[data-workflow-download]").getAttribute("href"))!;
        expect(href.startsWith("blob:")).toBe(true);
        expect(await page.evaluate(async url => (await fetch(url)).ok, href)).toBe(true);
        await setRequirement(page, { width: "700" });
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        await expect(page.locator('[data-stage][data-state="pending"]')).toHaveCount(7);
        expect(await revokedUrl(page), "the old object URL was revoked").toContain(href);

        await processButton(page).click();
        const second = (await page.locator("[data-workflow-download]").getAttribute("href"))!;
        await chooseSource(page, NOISY_JPEG);
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        expect(await revokedUrl(page)).toContain(second);
    });

    test("revokes the output URL when the form is reset", async ({ page }) => {
        await processToResult(page, SMALL_JPEG, {});
        const href = (await page.locator("[data-workflow-download]").getAttribute("href"))!;
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        expect(await revokedUrl(page)).toContain(href);
        await expect(page.getByLabel("Maximum file size (bytes)")).toHaveValue("100000");
    });

    test("runs from the keyboard alone and keeps every control reachable without horizontal overflow", async ({ page }) => {
        await chooseSource(page, SMALL_JPEG);
        await page.getByLabel("Maximum file size (bytes)").focus();
        await page.keyboard.press("Tab");
        await expect(processButton(page)).toBeFocused();
        const focusStyle = await processButton(page).evaluate(element => { const style = getComputedStyle(element); return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow }; });
        expect(focusStyle.outline !== "none" && focusStyle.width > 0 || focusStyle.shadow !== "none", "visible focus indicator").toBe(true);
        await page.keyboard.press("Enter");
        await expect(page.locator("[data-workflow-download]")).toBeVisible();
        await page.locator("[data-workflow-download]").focus();
        await expect(page.locator("[data-workflow-download]")).toBeFocused();
        await expectNoHorizontalOverflow(page, "keyboard success");
        for (const control of [processButton(page), page.getByRole("button", { name: "Reset" }), page.locator("[data-workflow-download]")]) {
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeInViewport();
        }
    });
});

test.describe("prepare-image-for-upload: privacy and storage", () => {
    test("sends no file content or name over the network and persists nothing", async ({ page }) => {
        await instrument(page);
        await openWorkflow(page);
        const storage = () => page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
        const before = await storage();
        const request: Array<{ method: string; url: string; body: string | null }> = [];
        page.on("request", item => request.push({ method: item.method(), url: item.url(), body: item.postData() }));
        const url = page.url();
        await processToResult(page, NOISY_JPEG, { format: "jpeg", bytes: "20000" });
        await expect(page.locator("[data-workflow-download]")).toBeVisible();
        expect(page.url(), "no query or hash is written").toBe(url);
        const origin = new URL(url).origin;
        for (const item of request) {
            expect(item.method, item.url).toBe("GET");
            expect(item.body, item.url).toBeNull();
            expect(item.url.startsWith(origin) || item.url.startsWith("blob:") || item.url.startsWith("data:"), item.url).toBe(true);
            expect(item.url, "the file name never appears in a request").not.toContain("compressor-source");
        }
        const after = await storage();
        expect(after, "local and session storage are unchanged by a run").toBe(before);
        expect(after).not.toContain("compressor-source");
    });
});

/* ---- Visual lane: screenshots (opt-in via env) and computed contrast across all 13 appearances ---- */

const SCREENSHOT_DIR = process.env.WORKFLOW_SCREENSHOT_DIR;
const APPEARANCE: Array<{ id: string; palette: string; mode: string }> = [
    ...["mineral", "oxblood", "signal", "cobalt", "amber", "original"].flatMap(palette => ["light", "dark"].map(mode => ({ id: `${palette}-${mode}`, palette, mode }))),
    { id: "onedark", palette: "onedark", mode: "onedark" },
];
const CAPTURE_APPEARANCE = ["original-light", "original-dark", "onedark"];

async function useAppearance(page: Page, appearance: { palette: string; mode: string }) {
    await page.addInitScript(({ palette, mode }) => {
        localStorage.setItem("palette", JSON.stringify(palette));
        localStorage.setItem("theme", JSON.stringify(mode));
    }, appearance);
}

async function capture(page: Page, state: string, appearanceId: string) {
    if (!SCREENSHOT_DIR) return;
    const viewport = page.viewportSize()!;
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${state}__${appearanceId}__${viewport.width}x${viewport.height}.png`), fullPage: true });
}

interface ContrastRow { target: string; foreground: string; background: string; ratio: number; minimum: number; passed: boolean }

/** Computes WCAG contrast from the browser's resolved colors, compositing translucent backgrounds up the ancestor chain. */
async function measureContrast(page: Page, target: Array<{ name: string; selector: string; kind: "text" | "border"; minimum: number }>): Promise<ContrastRow[]> {
    return page.evaluate((list) => {
        const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const parse = (value: string): [number, number, number, number] => {
            probe.clearRect(0, 0, 1, 1);
            probe.fillStyle = "#000"; probe.fillStyle = value;
            probe.globalCompositeOperation = "copy"; probe.fillRect(0, 0, 1, 1);
            const data = probe.getImageData(0, 0, 1, 1).data;
            return [data[0], data[1], data[2], data[3] / 255];
        };
        const over = (top: number[], bottom: number[]): [number, number, number, number] => {
            const alpha = top[3] + bottom[3] * (1 - top[3]);
            if (alpha === 0) return [255, 255, 255, 0];
            return [0, 1, 2].map(index => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha) as [number, number, number, number];
        };
        const backgroundOf = (element: Element): [number, number, number, number] => {
            const chain: Element[] = [];
            for (let node: Element | null = element; node; node = node.parentElement) chain.push(node);
            let result: [number, number, number, number] = [255, 255, 255, 1];
            for (const node of chain.reverse()) result = over(parse(getComputedStyle(node).backgroundColor), result);
            return result;
        };
        const luminance = (color: number[]) => {
            const [red, green, blue] = color.slice(0, 3).map(channel => { const value = channel / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        const ratio = (first: number[], second: number[]) => {
            const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
            return (light + 0.05) / (dark + 0.05);
        };
        const hex = (color: number[]) => `rgb(${color.slice(0, 3).map(channel => Math.round(channel)).join(",")})`;
        const row: ContrastRow[] = [];
        for (const item of list) {
            const element = document.querySelector(item.selector);
            if (!element) { row.push({ target: item.name, foreground: "missing", background: "missing", ratio: 0, minimum: item.minimum, passed: false }); continue; }
            const style = getComputedStyle(element);
            const background = backgroundOf(element.parentElement ?? element);
            const surface = item.kind === "text" ? over(parse(style.backgroundColor), background) : background;
            const foreground = item.kind === "text" ? over(parse(style.color), surface) : over(parse(style.borderTopColor), background);
            const value = ratio(foreground, surface);
            row.push({ target: item.name, foreground: hex(foreground), background: hex(surface), ratio: Math.round(value * 100) / 100, minimum: item.minimum, passed: value >= item.minimum });
        }
        return row;
    }, target);
}

const COMMON_TARGET = [
    { name: "Page heading", selector: "main h1", kind: "text" as const, minimum: 4.5 },
    { name: "Introduction text", selector: "main header > p", kind: "text" as const, minimum: 4.5 },
    { name: "Form heading", selector: "#workflow-form-title", kind: "text" as const, minimum: 4.5 },
    { name: "Field label", selector: "label[for=workflow-source]", kind: "text" as const, minimum: 4.5 },
    { name: "Muted hint text", selector: "#workflow-max-bytes-hint", kind: "text" as const, minimum: 4.5 },
    { name: "Text input", selector: "#workflow-max-bytes", kind: "text" as const, minimum: 4.5 },
    { name: "Text input boundary", selector: "#workflow-max-bytes", kind: "border" as const, minimum: 3 },
    { name: "Select boundary", selector: "#workflow-format", kind: "border" as const, minimum: 3 },
    { name: "Primary action text", selector: "form[aria-labelledby=workflow-form-title] button[type=submit]", kind: "text" as const, minimum: 4.5 },
    { name: "Secondary action text", selector: "form[aria-labelledby=workflow-form-title] button[type=button]", kind: "text" as const, minimum: 4.5 },
    { name: "Secondary action boundary", selector: "form[aria-labelledby=workflow-form-title] button[type=button]", kind: "border" as const, minimum: 3 },
    { name: "Status text", selector: "[data-workflow-status]", kind: "text" as const, minimum: 4.5 },
    { name: "Stage name", selector: "[data-stage=validate] > span:last-child > span:first-child", kind: "text" as const, minimum: 4.5 },
    { name: "Stage description", selector: "[data-stage=validate] > span:last-child > span:last-child", kind: "text" as const, minimum: 4.5 },
];
const SUCCESS_TARGET = [
    { name: "Result heading", selector: ".tool-result .tool-heading", kind: "text" as const, minimum: 4.5 },
    { name: "Comparison table text", selector: "[data-workflow-prepared] td", kind: "text" as const, minimum: 4.5 },
    { name: "Check list text", selector: "[data-workflow-check-list] li", kind: "text" as const, minimum: 4.5 },
    { name: "Download action text", selector: "[data-workflow-download]", kind: "text" as const, minimum: 4.5 },
];
const FAILURE_TARGET = [
    { name: "Failure alert text", selector: "[data-workflow-failure] strong", kind: "text" as const, minimum: 4.5 },
    { name: "Failure detail text", selector: "[data-workflow-failure] li", kind: "text" as const, minimum: 4.5 },
];

test.describe("prepare-image-for-upload: appearance, screenshots and computed contrast", () => {
    for (const appearance of APPEARANCE) {
        test(`appearance ${appearance.id}: computed contrast and semantic role consumption`, async ({ page }, testInfo) => {
            await useAppearance(page, appearance);
            await instrument(page);
            await openWorkflow(page);
            await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
            const captureThis = CAPTURE_APPEARANCE.includes(appearance.id);

            await chooseSource(page, NOISY_JPEG);
            if (captureThis) await capture(page, "initial", appearance.id);
            const initialRow = await measureContrast(page, COMMON_TARGET);

            await setRequirement(page, { format: "jpeg", bytes: "20000" });
            await armGate(page);
            await processButton(page).click();
            await expect(page.locator('[data-stage][data-state="running"]')).toHaveCount(1);
            if (captureThis) await capture(page, "busy", appearance.id);
            await releaseGate(page);
            await expect(page.locator("[data-workflow-download]")).toBeVisible();
            if (captureThis) await capture(page, "success", appearance.id);
            const successRow = await measureContrast(page, SUCCESS_TARGET);

            await setRequirement(page, { bytes: "50" });
            await processButton(page).click();
            await expect(page.locator('[data-workflow-failure="UNMET_REQUIREMENT"]')).toBeVisible();
            if (captureThis) await capture(page, "unmet", appearance.id);
            const failureRow = await measureContrast(page, FAILURE_TARGET);

            const role = await page.evaluate(() => {
                const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
                return {
                    bodyBackground: style("body").backgroundColor,
                    failureBackground: style("[data-workflow-failure]").backgroundColor,
                    failureBorder: style("[data-workflow-failure]").borderTopColor,
                    runningBorder: document.querySelector("[data-stage][data-state=failed]") ? style("[data-stage][data-state=failed]").borderTopColor : "none",
                    tokenDanger: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
                };
            });
            const everyRow = [...initialRow, ...successRow, ...failureRow];
            await testInfo.attach(`contrast-${appearance.id}`, { body: JSON.stringify({ appearance: appearance.id, viewport: page.viewportSize(), role, row: everyRow }, null, 2), contentType: "application/json" });
            const failed = everyRow.filter(item => !item.passed);
            expect(failed, `${appearance.id}: every measured text and control boundary meets WCAG`).toEqual([]);
            expect(role.failureBackground, "the failure surface consumes a real (non-transparent) semantic role").not.toBe("rgba(0, 0, 0, 0)");
            expect(role.tokenDanger.length, "the danger token exists in this appearance").toBeGreaterThan(0);
            await expectNoHorizontalOverflow(page, `${appearance.id} failure state`);
        });
    }
});

/* =====================================================================================================
   Multi-file workflows: HEIC photos to PDF, assemble PDF packet, PDF pages for slides.
   Every happy path runs the real processors in the browser; PDF content is read back with PDF.js.
   ===================================================================================================== */

const HEIC_ROUTE = "/workflows/heic-photos-to-pdf";
const PACKET_ROUTE = "/workflows/assemble-pdf-packet";
const SLIDES_ROUTE = "/workflows/pdf-pages-for-slides";
const HEIC_FIXTURE = fixturePath("heic-source.heic");
const HEIC_OVERSIZE = fixturePath("heic-over-30mp.heic");
const pdfFixture = (name: string) => path.resolve("test/fixtures/pdf", `${name}.pdf`);
const HEIC_LABEL = "HEIC or HEIF photos (up to 20)";
const PACKET_FILES_LABEL = "PDFs and images (JPEG or PNG)";
const SLIDES_FILE_LABEL = "PDF file";

interface PdfPageFact { width: number; height: number; rotation: number; text: string }

/** Reads a PDF back with PDF.js: geometry, rotation and the text that identifies each page. */
async function readPdf(bytes: Uint8Array): Promise<PdfPageFact[]> {
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    const task = getDocument({
        data: new Uint8Array(bytes), verbosity: 0, stopAtErrors: true, useSystemFonts: false,
        standardFontDataUrl: path.resolve("public/vendor/pdfjs/6.4.299/standard_fonts").replace(/\\/g, "/") + "/",
    });
    const document = await task.promise;
    try {
        const result: PdfPageFact[] = [];
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index);
            const viewport = page.getViewport({ scale: 1, rotation: 0 });
            const content = await page.getTextContent();
            result.push({ width: viewport.width, height: viewport.height, rotation: page.rotate, text: content.items.map(value => "str" in value ? value.str : "").join(" ").trim() });
            page.cleanup();
        }
        return result;
    } finally { await task.destroy(); }
}
const readPdfFile = async (file: string) => readPdf(new Uint8Array(await readFile(file)));
const pngDimension = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
function jpegDimension(bytes: Buffer) {
    let index = 2;
    while (index + 8 < bytes.length) {
        if (bytes[index] !== 0xff) { index += 1; continue; }
        const marker = bytes[index + 1];
        if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(index + 5), width: bytes.readUInt16BE(index + 7) };
        index += 2 + bytes.readUInt16BE(index + 2);
    }
    throw new Error("the JPEG has no frame header");
}

interface GateWindow extends Window { __workerGate: Promise<void> | null; __releaseWorker: () => void }

/** Holds back every worker message and blob read until released, so busy states are deterministic with the real processors. */
async function gateWorkers(page: Page) {
    await page.addInitScript(() => {
        const target = window as unknown as GateWindow;
        target.__workerGate = null;
        target.__releaseWorker = () => undefined;
        const post = Worker.prototype.postMessage as (...args: unknown[]) => void;
        Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
            const gate = target.__workerGate;
            if (!gate) return post.apply(this, args);
            void gate.then(() => post.apply(this, args));
        } as typeof Worker.prototype.postMessage;
        const read = Blob.prototype.arrayBuffer;
        Blob.prototype.arrayBuffer = function (this: Blob) {
            const gate = target.__workerGate;
            return gate ? gate.then(() => read.call(this)) : read.call(this);
        };
    });
}
async function armWorkerGate(page: Page) {
    await page.evaluate(() => {
        const target = window as unknown as GateWindow;
        let open!: () => void;
        target.__workerGate = new Promise<void>(release => { open = release; });
        target.__releaseWorker = () => { target.__workerGate = null; open(); };
    });
}
async function releaseWorkerGate(page: Page) { await page.evaluate(() => (window as unknown as GateWindow).__releaseWorker()); }

const runButton = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function saveLink(page: Page, link: Locator): Promise<{ name: string; bytes: Buffer }> {
    const waiting = page.waitForEvent("download");
    await link.click();
    const download = await waiting;
    return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}
async function saveAll(page: Page): Promise<Array<{ name: string; bytes: Buffer }>> {
    const link = page.locator("[data-workflow-download]");
    const count = await link.count();
    const saved: Array<{ name: string; bytes: Buffer }> = [];
    for (let index = 0; index < count; index++) saved.push(await saveLink(page, link.nth(index)));
    return saved;
}
async function expectFailureAlert(page: Page, code: string) {
    const alert = page.locator(`[data-workflow-failure="${code}"]`);
    await expect(alert).toBeVisible({ timeout: 90_000 });
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("No file is offered for download.");
    await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
    return alert;
}

async function addHeic(page: Page, ...file: Array<string | { name: string; mimeType: string; buffer: Buffer }>) {
    await page.getByLabel(HEIC_LABEL).setInputFiles(file as string[]);
}
async function addPacketFile(page: Page, ...file: Array<string | { name: string; mimeType: string; buffer: Buffer }>) {
    await page.getByLabel(PACKET_FILES_LABEL).setInputFiles(file as string[]);
}
async function addPacketPage(page: Page, sourceId: string, expression?: string) {
    await page.getByLabel("Add pages from").selectOption(sourceId);
    if (expression !== undefined) await page.getByLabel("Pages to add", { exact: true }).fill(expression);
    await page.getByRole("button", { name: "Add page", exact: true }).click();
}
async function addSlidePage(page: Page, expression: string) {
    await page.getByLabel("Pages to add", { exact: true }).fill(expression);
    await page.getByRole("button", { name: "Add page", exact: true }).click();
}

test.describe("heic-photos-to-pdf: real HEIC conversion into one PDF", () => {
    test("turns one real HEIC photo into a one-page PDF at the photo's pixel size, with every stage passed", async ({ page }) => {
        await page.goto(HEIC_ROUTE);
        await expect(page.locator("[data-workflow-status]")).toContainText("Nothing has run yet");
        await expect(page.locator('[data-stage][data-state="pending"]')).toHaveCount(6);
        await addHeic(page, HEIC_FIXTURE);
        await expect(page.locator("[data-workflow-list]")).toContainText("Page 1: heic-source.heic");
        await runButton(page, "Create PDF").click();
        const link = page.locator("[data-workflow-download]");
        await expect(link).toBeVisible({ timeout: 90_000 });
        const output = await saveLink(page, link);
        expect(output.name).toBe("heic-photos.pdf");
        expect(await readPdf(output.bytes)).toEqual([{ width: 480, height: 320, rotation: 0, text: "" }]);
        for (const stage of ["validate", "inspect", "convert", "assemble", "verify", "complete"]) {
            await expect(page.locator(`[data-stage="${stage}"]`), stage).toHaveAttribute("data-state", "passed");
        }
        await expect(page.locator("[data-workflow-output]")).toContainText(`heic-photos.pdf: 1 page, ${output.bytes.length.toLocaleString("en-US")} bytes`);
        await expect(page.locator("[data-workflow-check-list]")).toContainText("Passed: Page count. Expected 1, observed 1.");
        await expect(page.locator("[data-workflow-check-list]")).not.toContainText("Failed:");
        await expect(page.locator("[data-workflow-status]")).toContainText("Done.");
    });

    test("builds one page per selected photo, in the displayed order, for JPEG and PNG, and JPEG quality changes the PDF size", async ({ page }) => {
        test.setTimeout(240_000);
        await page.goto(HEIC_ROUTE);
        await addHeic(page, HEIC_FIXTURE);
        await addHeic(page, HEIC_FIXTURE);
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(2);
        await expect(page.locator("[data-workflow-list] li").nth(0)).toContainText("Page 1:");
        await expect(page.locator("[data-workflow-list] li").nth(1)).toContainText("Page 2:");
        await page.getByRole("button", { name: /^Move photo 1, heic-source\.heic, down$/ }).click();
        await expect(page.locator("[data-workflow-list] li").nth(0)).toContainText("Page 1: heic-source.heic");

        const size: Record<string, number> = {};
        for (const [quality, key] of [["10", "Home"], ["100", "End"]] as const) {
            await page.getByLabel(/^JPEG quality:/).focus();
            await page.keyboard.press(key);
            await expect(page.getByLabel(`JPEG quality: ${quality}%`)).toBeVisible();
            await runButton(page, "Create PDF").click();
            await expect(page.locator("[data-workflow-download]")).toBeVisible({ timeout: 120_000 });
            const output = await saveLink(page, page.locator("[data-workflow-download]"));
            expect(await readPdf(output.bytes)).toHaveLength(2);
            size[quality] = output.bytes.length;
        }
        expect(size["100"], "higher JPEG quality gives a larger PDF").toBeGreaterThan(size["10"]);

        await page.getByLabel("Image format inside the PDF").selectOption("png");
        await expect(page.getByLabel(/^JPEG quality:/)).toHaveCount(0);
        await runButton(page, "Create PDF").click();
        await expect(page.locator("[data-workflow-download]")).toBeVisible({ timeout: 120_000 });
        const png = await saveLink(page, page.locator("[data-workflow-download]"));
        expect(await readPdf(png.bytes)).toEqual([{ width: 480, height: 320, rotation: 0, text: "" }, { width: 480, height: 320, rotation: 0, text: "" }]);
    });

    test("stops at the unreadable later photo, names it, and offers no PDF and no intermediate download", async ({ page }) => {
        await instrument(page);
        await page.goto(HEIC_ROUTE);
        await addHeic(page, HEIC_FIXTURE);
        await addHeic(page, { name: "broken.heic", mimeType: "image/heic", buffer: Buffer.from("this is not a heic image at all") });
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(2);
        await runButton(page, "Create PDF").click();
        const alert = await expectFailureAlert(page, "UNSUPPORTED_FORMAT");
        await expect(alert).toContainText("Photo 2:");
        await expect(alert).toContainText("not valid HEIC or HEIF");
        await expect(alert).toContainText("Stopped at: Inspect");
        await expect(page.locator("[data-stage=inspect]")).toHaveAttribute("data-state", "failed");
        await expect(page.locator("[data-stage=convert]")).toHaveAttribute("data-state", "pending");
        expect(await createdUrl(page), "no object URL was created for any output").toEqual([]);
    });

    test("rejects a later photo over 30 megapixels with its own ordinal and no output", async ({ page }) => {
        test.setTimeout(240_000);
        await page.goto(HEIC_ROUTE);
        await addHeic(page, HEIC_FIXTURE, HEIC_OVERSIZE);
        await runButton(page, "Create PDF").click();
        const alert = await expectFailureAlert(page, "RESOURCE_LIMIT");
        await expect(alert).toContainText("Photo 2:");
        await expect(alert).toContainText("30,000,000 pixels");
    });

    test("limits the list to 20 photos and blocks an oversize photo or an empty photo before any run", async ({ page }) => {
        await page.goto(HEIC_ROUTE);
        const make = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `p${index + 1}.heic`, mimeType: "image/heic", buffer: Buffer.from(`photo ${index + 1}`) }));
        await addHeic(page, ...make(21));
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(20);
        await expect(page.getByRole("alert").filter({ hasText: "at most 20 photos" })).toContainText("1 photo was not added");
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await addHeic(page, { name: "empty.heic", mimeType: "image/heic", buffer: Buffer.alloc(0) });
        await expect(page.getByRole("alert").filter({ hasText: "is empty" })).toBeVisible();
        await expect(runButton(page, "Create PDF")).toBeDisabled();
    });
});

test.describe("assemble-pdf-packet: ordered mixed PDF and image pages", () => {
    test("assembles pages from PDFs and images in the exact requested order, repeats included, and the PDF content proves it", async ({ page }) => {
        test.setTimeout(180_000);
        const ordering = await readPdfFile(pdfFixture("ordering"));
        const mixed = await readPdfFile(pdfFixture("mixed-dimensions"));
        const rotated = await readPdfFile(pdfFixture("rotated"));
        const png = pngDimension(await readFile(fixturePath("resizer-source.png")));
        expect(new Set(ordering.map(item => item.text)).size, "the ordering fixture has distinguishable pages").toBe(ordering.length);

        await page.goto(PACKET_ROUTE);
        await addPacketFile(page, pdfFixture("ordering"), pdfFixture("mixed-dimensions"), fixturePath("resizer-source.png"), pdfFixture("rotated"), fixturePath("resizer-source.jpg"));
        await expect(page.locator("[data-workflow-source-list] li")).toHaveCount(5);
        await addPacketPage(page, "source-2", "2");
        await addPacketPage(page, "source-1", "3");
        await addPacketPage(page, "source-3");
        await addPacketPage(page, "source-1", "1");
        await addPacketPage(page, "source-1", "3");
        await addPacketPage(page, "source-4", "1");
        await addPacketPage(page, "source-5");
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(7);
        await page.getByRole("button", { name: "Move packet page 7 up", exact: true }).click();
        await expect(page.locator("[data-workflow-list] li").nth(5)).toContainText("source 5");
        await expect(page.locator("[data-workflow-list] li").nth(6)).toContainText("source 4");

        await runButton(page, "Assemble packet").click();
        await expect(page.locator("[data-workflow-download]")).toBeVisible({ timeout: 90_000 });
        const output = await saveLink(page, page.locator("[data-workflow-download]"));
        expect(output.name).toBe("assembled-packet.pdf");
        const result = await readPdf(output.bytes);
        const jpeg = jpegDimension(await readFile(fixturePath("resizer-source.jpg")));
        expect(result).toHaveLength(7);
        expect(result[0]).toEqual(mixed[1]);
        expect(result[1]).toEqual(ordering[2]);
        expect(result[2]).toMatchObject({ ...png, rotation: 0, text: "" });
        expect(result[3]).toEqual(ordering[0]);
        expect(result[4]).toEqual(ordering[2]);
        expect(result[5]).toMatchObject({ ...jpeg, rotation: 0, text: "" });
        expect(result[6]).toEqual(rotated[0]);
        expect(result[6].rotation).toBe(90);
        expect(result[1].text, "repeating a page copies the same content again").toBe(result[4].text);
        expect(result[1].text).not.toBe(result[3].text);
        await expect(page.locator("[data-workflow-output]")).toContainText("assembled-packet.pdf: 7 pages");
        await expect(page.locator('[data-stage="compress"]')).toHaveAttribute("data-state", "skipped");
        await expect(page.locator('[data-stage="compress"]')).toContainText("not requested");
        for (const stage of ["validate", "inspect", "select-pages", "assemble", "verify", "complete"]) {
            await expect(page.locator(`[data-stage="${stage}"]`), stage).toHaveAttribute("data-state", "passed");
        }
        await expect(page.locator("[data-workflow-check-list]")).not.toContainText("Failed:");
        await expect(page.locator("[data-workflow-check-list]")).toContainText("Lossless compression. Expected not requested, observed skipped");
    });

    test("reports compression honestly: a real saving or an explicit no-reduction, and the downloaded bytes agree", async ({ page }) => {
        test.setTimeout(240_000);
        await page.goto(PACKET_ROUTE);
        await addPacketFile(page, pdfFixture("compression-multipage"));
        await addPacketPage(page, "source-1", "1-100");
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(100);

        await runButton(page, "Assemble packet").click();
        await expect(page.locator("[data-workflow-download]")).toBeVisible({ timeout: 120_000 });
        const plain = await saveLink(page, page.locator("[data-workflow-download]"));
        expect(await readPdf(plain.bytes)).toHaveLength(100);

        await page.getByLabel("Try lossless compression").check();
        await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
        await runButton(page, "Assemble packet").click();
        await expect(page.locator("[data-workflow-download]")).toBeVisible({ timeout: 180_000 });
        const compressed = await saveLink(page, page.locator("[data-workflow-download]"));
        const stage = page.locator('[data-stage="compress"]');
        await expect(stage).toHaveAttribute("data-state", "passed");
        expect(await readPdf(compressed.bytes)).toHaveLength(100);
        const description = (await stage.textContent()) ?? "";
        if (description.includes("Saved")) {
            expect(compressed.bytes.length, "a reported saving is a real saving").toBeLessThan(plain.bytes.length);
            await expect(page.locator("[data-workflow-check-list]")).toContainText("Lossless compression. Expected requested, observed saved");
        } else {
            expect(description).toContain("did not make the PDF smaller");
            await expect(page.locator("[data-workflow-check-list]")).toContainText("observed no reduction");
        }
    });

    test("fails closed, naming the source, for an encrypted PDF, a page beyond the real page count and a damaged PDF", async ({ page }) => {
        await page.goto(PACKET_ROUTE);
        await addPacketFile(page, pdfFixture("encrypted"));
        await addPacketPage(page, "source-1", "1");
        await runButton(page, "Assemble packet").click();
        const encrypted = await expectFailureAlert(page, "UNSUPPORTED_FORMAT");
        await expect(encrypted).toContainText("Encrypted or password-protected");
        await expect(encrypted).toContainText("Stopped at: Inspect");

        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await addPacketFile(page, pdfFixture("ordering"));
        await addPacketPage(page, "source-1", "5");
        await runButton(page, "Assemble packet").click();
        const beyond = await expectFailureAlert(page, "INVALID_INPUT");
        await expect(beyond).toContainText('Source "source-1" has 4 pages, so page 5 does not exist.');
        await expect(beyond).toContainText("Stopped at: Select pages");

        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await addPacketFile(page, pdfFixture("truncated"));
        await addPacketPage(page, "source-1", "1");
        await runButton(page, "Assemble packet").click();
        await expectFailureAlert(page, "UNSUPPORTED_FORMAT");
    });

    test("rejects an image declared by its extension but encoded as another format, and explains bad page expressions", async ({ page }) => {
        await page.goto(PACKET_ROUTE);
        await addPacketFile(page, { name: "scan.png", mimeType: "image/png", buffer: await readFile(fixturePath("resizer-source.jpg")) });
        await addPacketPage(page, "source-1");
        await runButton(page, "Assemble packet").click();
        const alert = await expectFailureAlert(page, "UNSUPPORTED_FORMAT");
        await expect(alert).toContainText("the file is JPEG, not PNG");

        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await addPacketFile(page, pdfFixture("ordering"));
        for (const [expression, message] of [["two", "page numbers and ranges"], ["4-2", "lower page to a higher page"], ["0", "start at 1"], ["1-101", "at most 100 pages"]] as const) {
            await page.getByLabel("Pages to add", { exact: true }).fill(expression);
            await page.getByRole("button", { name: "Add page", exact: true }).click();
            await expect(page.getByLabel("Pages to add", { exact: true })).toHaveAttribute("aria-invalid", "true");
            await expect(page.locator("#packet-add-error")).toContainText(message);
        }
        await expect(page.locator("[data-workflow-list]")).toHaveCount(0);
    });
});

test.describe("pdf-pages-for-slides: ordered slide images from a real PDF", () => {
    async function pdfPageSize(file: string, pageNumber: number, dpi: number) {
        const task = getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0, useSystemFonts: false });
        const document = await task.promise;
        try {
            const viewport = (await document.getPage(pageNumber)).getViewport({ scale: dpi / 72 });
            return { width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) };
        } finally { await task.destroy(); }
    }

    test("exports pages 3 then 1 in that order as named PNGs of the right size, and each file is the page its name says", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("ordering"));
        await addSlidePage(page, "3");
        await addSlidePage(page, "1");
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(2);
        await page.getByLabel("Resolution").selectOption("72");
        await runButton(page, "Export slide images").click();
        await expect(page.locator("[data-workflow-output]")).toHaveCount(2, { timeout: 90_000 });
        const saved = await saveAll(page);
        expect(saved.map(item => item.name)).toEqual(["ordering-page-003.png", "ordering-page-001.png"]);
        const expected3 = await pdfPageSize(pdfFixture("ordering"), 3, 72), expected1 = await pdfPageSize(pdfFixture("ordering"), 1, 72);
        expect(pngDimension(saved[0].bytes)).toEqual(expected3);
        expect(pngDimension(saved[1].bytes)).toEqual(expected1);
        expect(saved[0].bytes.equals(saved[1].bytes), "the two slides are different pages").toBe(false);
        await expect(page.locator("[data-workflow-output]").nth(0).locator("img")).toHaveAttribute("alt", "Slide 1: PDF page 3");
        await expect(page.locator("[data-workflow-output]").nth(1)).toContainText("page 1");

        /* Identity is independent of order: the same page renders to the same bytes when requested in the other order. */
        await page.getByRole("button", { name: "Move slide 2, page 1, up", exact: true }).click();
        await runButton(page, "Export slide images").click();
        await expect(page.locator("[data-workflow-output]")).toHaveCount(2, { timeout: 90_000 });
        const swapped = await saveAll(page);
        expect(swapped.map(item => item.name)).toEqual(["ordering-page-001.png", "ordering-page-003.png"]);
        expect(swapped[0].bytes.equals(saved[1].bytes)).toBe(true);
        expect(swapped[1].bytes.equals(saved[0].bytes)).toBe(true);
        await expect(page.locator("[data-workflow-check-list]")).not.toContainText("Failed:");
    });

    test("renders at 72, 150 and 300 DPI with the dimensions the page size implies, and keeps a rotated page rotated", async ({ page }) => {
        test.setTimeout(240_000);
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("rotated"));
        await addSlidePage(page, "1");
        const size: number[] = [];
        for (const dpi of [72, 150, 300]) {
            await page.getByLabel("Resolution").selectOption(String(dpi));
            await runButton(page, "Export slide images").click();
            await expect(page.locator("[data-workflow-output]")).toHaveCount(1, { timeout: 90_000 });
            const [output] = await saveAll(page);
            const dimension = pngDimension(output.bytes);
            const expected = await pdfPageSize(pdfFixture("rotated"), 1, dpi);
            expect(dimension, `${dpi} DPI`).toEqual(expected);
            size.push(dimension.width);
        }
        expect(size[1]).toBeGreaterThan(size[0]);
        expect(size[2]).toBeGreaterThan(size[1]);
        const unrotated = (await readPdfFile(pdfFixture("rotated")))[0];
        expect(unrotated.rotation).toBe(90);
        const rendered72 = await pdfPageSize(pdfFixture("rotated"), 1, 72);
        expect(rendered72, "a page rotated by 90 degrees renders with width and height swapped").toEqual({ width: Math.ceil(unrotated.height), height: Math.ceil(unrotated.width) });
    });

    test("produces JPEG files with the chosen quality, and a higher quality gives larger images", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("mixed"));
        await addSlidePage(page, "1");
        await page.getByLabel("Image format").selectOption("jpeg");
        await page.getByLabel("Resolution").selectOption("150");
        const length: number[] = [];
        for (const quality of ["50", "100"]) {
            await page.getByLabel("JPEG quality (percent)").fill(quality);
            await runButton(page, "Export slide images").click();
            await expect(page.locator("[data-workflow-output]")).toHaveCount(1, { timeout: 90_000 });
            const [output] = await saveAll(page);
            expect(output.name).toBe("mixed-page-001.jpg");
            expect([output.bytes[0], output.bytes[1]]).toEqual([0xff, 0xd8]);
            length.push(output.bytes.length);
        }
        expect(length[1]).toBeGreaterThan(length[0]);
    });

    test("returns no image at all when one page misses the byte limit, naming each failing slide", async ({ page }) => {
        await instrument(page);
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("ordering"));
        await addSlidePage(page, "1-2");
        await page.getByLabel("Largest allowed image (bytes, optional)").fill("100");
        await runButton(page, "Export slide images").click();
        const alert = await expectFailureAlert(page, "UNMET_REQUIREMENT");
        await expect(alert).toContainText("Failed: Slide 1: size in bytes. Expected at most 100, observed");
        await expect(alert).toContainText("Failed: Slide 2: size in bytes");
        await expect(alert).toContainText("Stopped at: Verify");
        expect(await createdUrl(page), "no URL exists for any rendered image").toEqual([]);

        await page.getByLabel("Largest allowed image (bytes, optional)").fill("5000000");
        await runButton(page, "Export slide images").click();
        await expect(page.locator("[data-workflow-output]")).toHaveCount(2, { timeout: 90_000 });
    });

    test("fails a page that exceeds the render limit instead of lowering the DPI, and succeeds at the lower DPI", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("render-dpi-limit"));
        await addSlidePage(page, "2");
        await page.getByLabel("Resolution").selectOption("300");
        await runButton(page, "Export slide images").click();
        const alert = await expectFailureAlert(page, "RESOURCE_LIMIT");
        await expect(alert).toContainText("Stopped at: Render");
        await page.getByLabel("Resolution").selectOption("150");
        await runButton(page, "Export slide images").click();
        await expect(page.locator("[data-workflow-output]")).toHaveCount(1, { timeout: 90_000 });
        const [output] = await saveAll(page);
        const expected = await pdfPageSize(pdfFixture("render-dpi-limit"), 2, 150);
        expect(Math.abs(expected.width - 2500) + Math.abs(expected.height - 1875), "the 1200 x 900 point page is about 2500 x 1875 pixels at 150 DPI").toBeLessThanOrEqual(2);
        expect(pngDimension(output.bytes)).toEqual(expected);
    });

    test("rejects an encrypted or damaged PDF, a page beyond the page count and a repeated page, with no image", async ({ page }) => {
        await page.goto(SLIDES_ROUTE);
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("encrypted"));
        await addSlidePage(page, "1");
        await runButton(page, "Export slide images").click();
        await expect(await expectFailureAlert(page, "UNSUPPORTED_FORMAT")).toContainText("Encrypted or password-protected");

        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("ordering"));
        await addSlidePage(page, "9");
        await runButton(page, "Export slide images").click();
        await expect(await expectFailureAlert(page, "INVALID_INPUT")).toContainText("page 9 does not exist");

        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("ordering"));
        await addSlidePage(page, "2");
        await addSlidePage(page, "2");
        await expect(page.locator("#slides-add-error")).toContainText("Page 2 is already in the list");
        await expect(page.locator("[data-workflow-list] li")).toHaveCount(1);
    });
});

interface WorkflowFlow {
    slug: string;
    route: string;
    run: string;
    stage: number;
    ready(page: Page): Promise<void>;
    change(page: Page): Promise<void>;
    breakIt(page: Page): Promise<void>;
    failure: string;
}

const FLOW: WorkflowFlow[] = [
    {
        slug: "heic-photos-to-pdf", route: HEIC_ROUTE, run: "Create PDF", stage: 6, failure: "UNSUPPORTED_FORMAT",
        ready: async page => { await addHeic(page, HEIC_FIXTURE); },
        change: async page => { await page.getByLabel("Image format inside the PDF").selectOption("png"); },
        breakIt: async page => { await addHeic(page, { name: "broken.heic", mimeType: "image/heic", buffer: Buffer.from("not a heic image") }); },
    },
    {
        slug: "assemble-pdf-packet", route: PACKET_ROUTE, run: "Assemble packet", stage: 7, failure: "UNSUPPORTED_FORMAT",
        ready: async page => {
            await addPacketFile(page, pdfFixture("ordering"), fixturePath("resizer-source.png"));
            await addPacketPage(page, "source-1", "1-2");
            await addPacketPage(page, "source-2");
        },
        change: async page => { await page.getByLabel("Try lossless compression").check(); },
        breakIt: async page => {
            await addPacketFile(page, pdfFixture("encrypted"));
            await addPacketPage(page, "source-3", "1");
        },
    },
    {
        slug: "pdf-pages-for-slides", route: SLIDES_ROUTE, run: "Export slide images", stage: 6, failure: "UNMET_REQUIREMENT",
        ready: async page => {
            await page.getByLabel(SLIDES_FILE_LABEL).setInputFiles(pdfFixture("ordering"));
            await addSlidePage(page, "3");
            await addSlidePage(page, "1");
        },
        change: async page => { await page.getByLabel("Resolution").selectOption("150"); },
        breakIt: async page => { await page.getByLabel("Largest allowed image (bytes, optional)").fill("100"); },
    },
];

for (const flow of FLOW) {
    test.describe(`${flow.slug}: run lifecycle, privacy and accessibility in the browser`, () => {
        test.beforeEach(async ({ page }) => {
            await instrument(page);
            await gateWorkers(page);
            await page.goto(flow.route);
        });

        test("starts idle, runs only on Process, shows a busy state with Cancel, then a verified result", async ({ page }) => {
            await expect(runButton(page, flow.run)).toBeDisabled();
            await expect(page.locator("[data-workflow-hint]")).toBeVisible();
            await flow.ready(page);
            expect((await stageLog(page)).filter(entry => !entry.endsWith(":pending")), "nothing ran before Process").toEqual([]);
            await expect(runButton(page, flow.run)).toBeEnabled();
            await armWorkerGate(page);
            await runButton(page, flow.run).click();
            await expect(page.locator('[data-stage][data-state="running"]')).toHaveCount(1);
            await expect(runButton(page, "Processing...")).toBeDisabled();
            await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeDisabled();
            await expect(page.locator("[data-workflow-status]")).toContainText("stages finished");
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
            await releaseWorkerGate(page);
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
            await expect(page.locator('[data-stage][data-state="passed"]')).toHaveCount(flow.stage - (flow.slug === "assemble-pdf-packet" ? 1 : 0));
            await expect(page.locator("[data-workflow-status]")).toContainText("Done.");
        });

        test("cancel discards the run, creates no output URL, and a retry then succeeds", async ({ page }) => {
            await flow.ready(page);
            await armWorkerGate(page);
            await runButton(page, flow.run).click();
            await expect(page.locator('[data-stage][data-state="running"]')).toHaveCount(1);
            await page.getByRole("button", { name: "Cancel", exact: true }).click();
            await releaseWorkerGate(page);
            await expect(page.locator("[data-workflow-cancelled]")).toBeVisible();
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
            await expect(page.locator("[data-workflow-status]")).toContainText("Cancelled.");
            expect(await createdUrl(page), "the cancelled run created no URL").toEqual([]);
            await expect(runButton(page, flow.run)).toBeEnabled();
            await runButton(page, flow.run).click();
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
        });

        test("revokes every output URL when an input changes and when the form is reset", async ({ page }) => {
            await flow.ready(page);
            await runButton(page, flow.run).click();
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
            const first = await page.locator("[data-workflow-download]").evaluateAll(list => list.map(item => item.getAttribute("href")!));
            expect(first.length).toBeGreaterThan(0);
            for (const href of first) expect(href.startsWith("blob:")).toBe(true);
            await flow.change(page);
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
            await expect(page.locator('[data-stage][data-state="pending"]')).toHaveCount(flow.stage);
            expect(await revokedUrl(page)).toEqual(expect.arrayContaining(first));

            await runButton(page, flow.run).click();
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
            const second = await page.locator("[data-workflow-download]").evaluateAll(list => list.map(item => item.getAttribute("href")!));
            await page.getByRole("button", { name: "Reset", exact: true }).click();
            await expect(page.locator("[data-workflow-download]")).toHaveCount(0);
            expect(await revokedUrl(page)).toEqual(expect.arrayContaining(second));
            await expect(runButton(page, flow.run)).toBeDisabled();
        });

        test("shows a typed failure as an alert, offers no file, and recovers after a change", async ({ page }) => {
            await flow.ready(page);
            await flow.breakIt(page);
            await runButton(page, flow.run).click();
            await expectFailureAlert(page, flow.failure);
            await expect(page.locator("[data-workflow-status]")).toContainText("stopped without producing a file");
            expect(await createdUrl(page)).toEqual([]);
            await expectNoHorizontalOverflow(page, `${flow.slug} failure`);
        });

        test("sends no file content, name or page mapping over the network and persists nothing", async ({ page }) => {
            const storage = () => page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
            const before = await storage();
            const request: Array<{ method: string; url: string; body: string | null }> = [];
            page.context().on("request", item => request.push({ method: item.method(), url: item.url(), body: item.postData() }));
            const url = page.url();
            await flow.ready(page);
            await runButton(page, flow.run).click();
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
            expect(page.url(), "no query or hash is written").toBe(url);
            const origin = new URL(url).origin;
            for (const item of request) {
                expect(item.method, item.url).toBe("GET");
                expect(item.body, item.url).toBeNull();
                expect(item.url.startsWith(origin) || item.url.startsWith("blob:") || item.url.startsWith("data:"), item.url).toBe(true);
                expect(item.url, "no file name in a request").not.toMatch(/heic-source|resizer-source|ordering\.pdf|source-\d/);
            }
            const after = await storage();
            expect(after, "local and session storage are unchanged by a run").toBe(before);
        });

        test("every control meets the 44px target size, keeps visible focus and runs from the keyboard", async ({ page }) => {
            await flow.ready(page);
            const control = page.locator("main form button, main form select, main form input:not([type=file]):not([type=checkbox]):not([type=range]), main form input[type=file]");
            for (const item of await control.all()) {
                if (!(await item.isVisible())) continue;
                const box = (await item.boundingBox())!;
                const label = (await item.textContent())?.trim() || (await item.getAttribute("id")) || "control";
                expect(box.height, `${label} is at least 44px tall`).toBeGreaterThanOrEqual(43.5);
                if ((await item.evaluate(element => element.tagName)) === "BUTTON") expect(box.width, `${label} is at least 44px wide`).toBeGreaterThanOrEqual(43.5);
            }
            await expectNoHorizontalOverflow(page, `${flow.slug} ready`);
            await runButton(page, flow.run).focus();
            const focusStyle = await runButton(page, flow.run).evaluate(element => { const style = getComputedStyle(element); return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow }; });
            expect(focusStyle.outline !== "none" && focusStyle.width > 0 || focusStyle.shadow !== "none", "visible focus indicator").toBe(true);
            await page.keyboard.press("Enter");
            await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
            await page.locator("[data-workflow-download]").first().focus();
            await expect(page.locator("[data-workflow-download]").first()).toBeFocused();
            await expectNoHorizontalOverflow(page, `${flow.slug} success`);
            const download = page.locator("[data-workflow-download]");
            for (const item of await download.all()) {
                const box = (await item.boundingBox())!;
                expect(box.height).toBeGreaterThanOrEqual(43.5);
            }
        });
    });
}

/* ---- Visual lane for the three multi-file workflows: 3 routes x 4 states x 3 appearances x 2 viewports, and contrast over all 13 appearances ---- */

interface ContrastTarget { name: string; selector: string; kind: "text" | "border"; minimum: number }

async function captureRoute(page: Page, slug: string, state: string, appearanceId: string) {
    if (!SCREENSHOT_DIR) return;
    const viewport = page.viewportSize()!;
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${slug}__${state}__${appearanceId}__${viewport.width}x${viewport.height}.png`), fullPage: true });
}

const SHARED_TARGET: ContrastTarget[] = [
    { name: "Page heading", selector: "main h1", kind: "text", minimum: 4.5 },
    { name: "Introduction text", selector: "main header > p", kind: "text", minimum: 4.5 },
    { name: "Form heading", selector: "#workflow-form-title", kind: "text", minimum: 4.5 },
    { name: "Primary action text", selector: "form[aria-labelledby=workflow-form-title] button[type=submit]", kind: "text", minimum: 4.5 },
    { name: "Secondary action text", selector: "form[aria-labelledby=workflow-form-title] button[type=button]:not(:disabled)", kind: "text", minimum: 4.5 },
    { name: "Secondary action boundary", selector: "form[aria-labelledby=workflow-form-title] button[type=button]:not(:disabled)", kind: "border", minimum: 3 },
    { name: "Status text", selector: "[data-workflow-status]", kind: "text", minimum: 4.5 },
    { name: "Stage name", selector: "[data-stage=validate] > span:last-child > span:first-child", kind: "text", minimum: 4.5 },
    { name: "Stage description", selector: "[data-stage=validate] > span:last-child > span:last-child", kind: "text", minimum: 4.5 },
    { name: "List item text", selector: "[data-workflow-list] li p", kind: "text", minimum: 4.5 },
];
const ROUTE_TARGET: Record<string, ContrastTarget[]> = {
    "heic-photos-to-pdf": [
        { name: "Field label", selector: "label[for=heic-photos]", kind: "text", minimum: 4.5 },
        { name: "Muted hint text", selector: "#heic-photos-hint", kind: "text", minimum: 4.5 },
        { name: "File input boundary", selector: "#heic-photos", kind: "border", minimum: 3 },
        { name: "Select text", selector: "#heic-format", kind: "text", minimum: 4.5 },
        { name: "Select boundary", selector: "#heic-format", kind: "border", minimum: 3 },
    ],
    "assemble-pdf-packet": [
        { name: "Field label", selector: "label[for=packet-files]", kind: "text", minimum: 4.5 },
        { name: "Muted hint text", selector: "#packet-files-hint", kind: "text", minimum: 4.5 },
        { name: "Select text", selector: "#packet-add-source", kind: "text", minimum: 4.5 },
        { name: "Select boundary", selector: "#packet-add-source", kind: "border", minimum: 3 },
        { name: "File input boundary", selector: "#packet-files", kind: "border", minimum: 3 },
    ],
    "pdf-pages-for-slides": [
        { name: "Field label", selector: "label[for=slides-file]", kind: "text", minimum: 4.5 },
        { name: "Muted hint text", selector: "#slides-add-hint", kind: "text", minimum: 4.5 },
        { name: "Text input", selector: "#slides-bytes", kind: "text", minimum: 4.5 },
        { name: "Text input boundary", selector: "#slides-bytes", kind: "border", minimum: 3 },
        { name: "Select boundary", selector: "#slides-dpi", kind: "border", minimum: 3 },
    ],
};
const SUCCESS_ROUTE_TARGET: ContrastTarget[] = [
    { name: "Result heading", selector: ".tool-result .tool-heading", kind: "text", minimum: 4.5 },
    { name: "Result text", selector: "[data-workflow-output] p", kind: "text", minimum: 4.5 },
    { name: "Check list text", selector: "[data-workflow-check-list] li", kind: "text", minimum: 4.5 },
    { name: "Download action text", selector: "[data-workflow-download]", kind: "text", minimum: 4.5 },
];
const FAILURE_ROUTE_TARGET: ContrastTarget[] = [
    { name: "Failure alert text", selector: "[data-workflow-failure] strong", kind: "text", minimum: 4.5 },
    { name: "Failure detail text", selector: "[data-workflow-failure] p.text-sm", kind: "text", minimum: 4.5 },
];

test.describe("multi-file workflows: appearance, screenshots and computed contrast", () => {
    for (const flow of FLOW) {
        for (const appearance of APPEARANCE) {
            test(`${flow.slug} in ${appearance.id}: computed contrast and four captured states`, async ({ page }, testInfo) => {
                test.setTimeout(240_000);
                await useAppearance(page, appearance);
                await instrument(page);
                await gateWorkers(page);
                await page.goto(flow.route);
                await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
                const captureThis = CAPTURE_APPEARANCE.includes(appearance.id);

                if (captureThis) await captureRoute(page, flow.slug, "initial", appearance.id);
                await flow.ready(page);
                const readyRow = await measureContrast(page, [...SHARED_TARGET, ...ROUTE_TARGET[flow.slug]]);

                await armWorkerGate(page);
                await runButton(page, flow.run).click();
                await expect(page.locator('[data-stage][data-state="running"]')).toHaveCount(1);
                if (captureThis) await captureRoute(page, flow.slug, "busy", appearance.id);
                await releaseWorkerGate(page);
                await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 90_000 });
                if (captureThis) await captureRoute(page, flow.slug, "success", appearance.id);
                const successRow = await measureContrast(page, SUCCESS_ROUTE_TARGET);
                await expectNoHorizontalOverflow(page, `${flow.slug} ${appearance.id} success`);

                await flow.breakIt(page);
                await runButton(page, flow.run).click();
                await expect(page.locator(`[data-workflow-failure="${flow.failure}"]`)).toBeVisible({ timeout: 90_000 });
                if (captureThis) await captureRoute(page, flow.slug, "error", appearance.id);
                const failureRow = await measureContrast(page, FAILURE_ROUTE_TARGET);
                await expectNoHorizontalOverflow(page, `${flow.slug} ${appearance.id} failure`);

                const everyRow = [...readyRow, ...successRow, ...failureRow];
                await testInfo.attach(`contrast-${flow.slug}-${appearance.id}`, { body: JSON.stringify({ route: flow.slug, appearance: appearance.id, viewport: page.viewportSize(), row: everyRow }, null, 2), contentType: "application/json" });
                const failed = everyRow.filter(item => !item.passed);
                expect(failed, `${flow.slug} ${appearance.id}: every measured text and control boundary meets WCAG`).toEqual([]);
            });
        }
    }
});
