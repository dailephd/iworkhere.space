import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/* Prompt 7: the interactive Guide finder and the legacy /guide/<slug> redirects.
   Expectations are typed here independently of the production graph and registries. */

interface Outcome { family: string; task?: string; href: string; workflowTitle?: string }

const OUTCOME: Outcome[] = [
    { family: "Image", task: "Change the file format", href: "/tool/image-converter" },
    { family: "Image", task: "Change width or height", href: "/tool/image-resizer" },
    { family: "Image", task: "Try to reduce file size", href: "/tool/image-compressor" },
    { family: "Image", task: "Convert one HEIC or HEIF photo", href: "/tool/heic-converter" },
    { family: "Image", task: "Meet format, dimensions and maximum-byte rules", href: "/workflows/prepare-image-for-upload", workflowTitle: "Prepare an Image for Upload" },
    { family: "Image", task: "Combine HEIC photos into one PDF", href: "/workflows/heic-photos-to-pdf", workflowTitle: "HEIC Photos to PDF" },
    { family: "PDF", task: "Join entire PDF documents", href: "/tool/merge-pdf" },
    { family: "PDF", task: "Extract selected pages into separate PDFs", href: "/tool/split-pdf" },
    { family: "PDF", task: "Turn PDF pages into JPG or PNG images", href: "/tool/pdf-to-image" },
    { family: "PDF", task: "Make a PDF from JPEG or PNG images", href: "/tool/images-to-pdf" },
    { family: "PDF", task: "Try lossless PDF size reduction", href: "/tool/compress-pdf" },
    { family: "PDF", task: "Assemble selected PDF pages and images in a chosen order", href: "/workflows/assemble-pdf-packet", workflowTitle: "Assemble a PDF Packet" },
    { family: "PDF", task: "Prepare PDF pages as images for slides", href: "/workflows/pdf-pages-for-slides", workflowTitle: "PDF Pages for Slides" },
    { family: "Text", task: "Make URL-safe text", href: "/tool/slugify" },
    { family: "Text", task: "Extract text from HTML", href: "/tool/html-text-extractor" },
    { family: "Text", task: "Count words and characters", href: "/tool/word-character-counter" },
    { family: "Converters", task: "Length or distance", href: "/tool/length-converter" },
    { family: "Converters", task: "Weight or mass", href: "/tool/weight-converter" },
    { family: "Developer", task: "Format or validate JSON", href: "/tool/json-formatter" },
    { family: "Developer", task: "Generate a QR code", href: "/tool/qr-code-generator" },
    { family: "Math", href: "/tool/calculator" },
    { family: "Time", href: "/tool/time-arithmetic" },
];
const WORKFLOW_SLUG = ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"];
const FAMILY = ["Image", "PDF", "Text", "Converters", "Developer", "Math", "Time"];
const WIDTH = [320, 390, 768, 1280];

const finder = (page: Page) => page.locator("[data-guide-finder]");
const choice = (page: Page, name: string) => finder(page).getByRole("button", { name, exact: true });
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function chooseOutcome(page: Page, outcome: Outcome) {
    await choice(page, outcome.family).click();
    if (outcome.task) await choice(page, outcome.task).click();
}

test.describe("legacy guide redirects (TST-006)", () => {
    for (const slug of WORKFLOW_SLUG) {
        test(`/guide/${slug} answers 308 to /workflows/${slug} and the target works`, async ({ request, page }) => {
            const response = await request.get(`/guide/${slug}`, { maxRedirects: 0 });
            expect(response.status()).toBe(308);
            expect(new URL(response.headers()["location"], "http://127.0.0.1").pathname).toBe(`/workflows/${slug}`);
            expect(new URL(response.headers()["location"], "http://127.0.0.1").search).toBe("");

            const withQuery = await request.get(`/guide/${slug}?utm=1#x`, { maxRedirects: 0 });
            expect(withQuery.status()).toBe(308);
            expect(new URL(withQuery.headers()["location"], "http://127.0.0.1").search, "no query leakage").toBe("");

            const target = await request.get(`/workflows/${slug}`, { maxRedirects: 0 });
            expect(target.status()).toBe(200);
            const html = await (await request.get(`/guide/${slug}`)).text();
            expect(html).toContain(`rel="canonical" href="https://iworkhere.space/workflows/${slug}"`);
            expect(html).not.toContain(`href="https://iworkhere.space/guide/${slug}"`);

            await page.goto(`/guide/${slug}`);
            await expect(page).toHaveURL(new RegExp(`/workflows/${slug}$`));
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        });
    }

    test("unknown and malformed guide slugs stay 404", async ({ request }) => {
        for (const slug of ["unknown", "Prepare-Image-For-Upload", "prepare-image-for-upload-2", "prepare-image-for-upload%2Fextra", "__proto__"]) {
            expect((await request.get(`/guide/${slug}`, { maxRedirects: 0 })).status(), slug).toBe(404);
        }
    });
});

test.describe("hub metadata, sitemap and direct links (TST-007)", () => {
    test("serves the unbranded finder title once, the /guide canonical, one H1 and server-visible choices without JavaScript", async ({ request, browser, baseURL }) => {
        const html = await (await request.get("/guide")).text();
        expect(html.match(/<title>([^<]*)<\/title>/g)).toEqual(["<title>Find the Right Tool or Workflow - iworkhere</title>"]);
        expect(html).toContain('rel="canonical" href="https://iworkhere.space/guide"');
        expect(html.match(/<h1[ >]/g)).toHaveLength(1);
        expect(html).toMatch(/content="index, follow"/);

        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        try {
            await page.goto(new URL("/guide", baseURL).toString());
            await expect(page.getByRole("heading", { level: 1, name: "Find the Right Tool or Workflow" })).toBeVisible();
            await expect(finder(page).getByRole("button")).toHaveCount(FAMILY.length);
            await expect(page.getByRole("main").getByRole("link", { name: "all tools" })).toHaveAttribute("href", "/discover");
            await expect(page.getByRole("main").getByRole("link", { name: "working workflows" })).toHaveAttribute("href", "/workflows");
        } finally { await context.close(); }
    });

    test("the sitemap has exactly 36 unique canonical URLs: no redirecting guide URL, hubs once, four workflows, 18 tools, 7 categories", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        const location = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        expect(location).toHaveLength(36);
        expect(new Set(location).size).toBe(36);
        expect(location.filter(url => url.includes("/guide"))).toEqual(["https://iworkhere.space/guide"]);
        expect(location.filter(url => url === "https://iworkhere.space/workflows")).toHaveLength(1);
        expect(location.filter(url => /\/workflows\/[^/]+$/.test(url))).toEqual(WORKFLOW_SLUG.map(slug => `https://iworkhere.space/workflows/${slug}`));
        expect(location.filter(url => url.includes("/tool/"))).toHaveLength(18);
        expect(location.filter(url => url.includes("/category/"))).toHaveLength(7);
        for (const url of ["/", "/discover", "/privacy", "/about", "/contact"]) expect(location).toContain(`https://iworkhere.space${url}`);
    });

    test("category and tool pages link straight to the working workflows and never to a /guide/<slug> redirect", async ({ request }) => {
        const pageList = ["/category/document", "/category/image", "/tool/merge-pdf", "/tool/image-resizer", "/tool/heic-converter", "/tool/images-to-pdf", "/tool/pdf-to-image"];
        for (const route of pageList) {
            const html = await (await request.get(route)).text();
            expect(html, route).not.toMatch(/href="\/guide\/[a-z-]+"/);
        }
        const document = await (await request.get("/category/document")).text();
        expect(document).toContain("Automated workflows");
        expect(document).toContain('href="/workflows/assemble-pdf-packet"');
        expect(document).toContain('href="/workflows/pdf-pages-for-slides"');
    });
});

test.describe("finder behavior (TST-003, TST-005)", () => {
    for (const outcome of OUTCOME) {
        test(`${outcome.family}${outcome.task ? ` > ${outcome.task}` : ""} recommends ${outcome.href} and Open reaches a working page`, async ({ page, request }) => {
            await page.goto("/guide");
            await chooseOutcome(page, outcome);
            const recommendation = page.locator("[data-guide-recommendation]");
            await expect(recommendation).toBeVisible();
            const open = recommendation.locator("[data-guide-open]");
            await expect(open).toHaveAttribute("href", outcome.href);
            const name = (await open.innerText()).replace(/^Open /, "");
            expect(name.length).toBeGreaterThan(2);
            await expect(recommendation.getByRole("heading", { level: 2 })).toHaveText(`Recommended: ${name}`);
            if (outcome.workflowTitle) expect(name).toBe(outcome.workflowTitle);
            expect((await recommendation.locator("p").first().innerText()).trim().endsWith(".")).toBe(true);
            expect(await recommendation.getByRole("link").count(), "exactly one link").toBe(1);
            expect((await request.get(outcome.href, { maxRedirects: 0 })).status()).toBe(200);
            expect(page.url(), "no URL state or automatic navigation").toMatch(/\/guide$/);

            await open.click();
            await expect(page).toHaveURL(new RegExp(`${outcome.href}$`));
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            if (outcome.workflowTitle) await expect(page).toHaveTitle(`${outcome.workflowTitle} - iworkhere`);
        });
    }

    test("every branch needs only one task choice after the family, and Math and Time need none", async ({ page }) => {
        await page.goto("/guide");
        for (const family of ["Math", "Time"]) {
            await choice(page, family).click();
            await expect(page.locator("[data-guide-recommendation]")).toBeVisible();
            await finder(page).getByRole("button", { name: "Start over" }).click();
        }
        for (const [family, count] of [["Image", 6], ["PDF", 7], ["Text", 3], ["Converters", 2], ["Developer", 2]] as const) {
            await choice(page, family).click();
            await expect(finder(page).locator("[data-guide-choice]")).toHaveCount(count);
            await expect(page.locator("[data-guide-recommendation]")).toHaveCount(0);
            await finder(page).getByRole("button", { name: "Start over" }).click();
        }
    });
});

test.describe("state, keyboard and accessibility (TST-004)", () => {
    test("Back keeps earlier choices, Start over resets, and no stale recommendation is shown", async ({ page }) => {
        await page.goto("/guide");
        await expect(page.locator("[data-guide-recommendation]")).toHaveCount(0);
        await expect(finder(page).getByRole("button", { name: "Back" })).toHaveCount(0);
        await choice(page, "PDF").click();
        await expect(finder(page).locator("[data-guide-chosen]")).toHaveText("You chose: PDF");
        await choice(page, "Prepare PDF pages as images for slides").click();
        await expect(page.locator("[data-guide-recommendation] h2")).toHaveText("Recommended: PDF Pages for Slides");
        await expect(finder(page).locator("[data-guide-chosen]")).toHaveText("You chose: PDF > Prepare PDF pages as images for slides");
        await finder(page).getByRole("button", { name: "Back" }).click();
        await expect(page.locator("[data-guide-recommendation]")).toHaveCount(0);
        await expect(finder(page).locator("h2")).toHaveText("What do you want to do with a PDF?");
        await expect(finder(page).locator("[data-guide-chosen]")).toHaveText("You chose: PDF");
        await finder(page).getByRole("button", { name: "Back" }).click();
        await expect(finder(page).locator("h2")).toHaveText("What do you need to do?");
        await choice(page, "Image").click();
        await choice(page, "Change the file format").click();
        await finder(page).getByRole("button", { name: "Start over" }).click();
        await expect(finder(page).locator("h2")).toHaveText("What do you need to do?");
        await expect(page.locator("[data-guide-recommendation]")).toHaveCount(0);
        await expect(finder(page).locator("[data-guide-chosen]")).toHaveCount(0);
        await page.reload();
        await expect(finder(page).locator("h2")).toHaveText("What do you need to do?");
    });

    test("keyboard: Tab reaches the choices with a visible focus ring, Enter and Space activate, and focus lands on the new heading", async ({ page }) => {
        await page.goto("/guide");
        const first = choice(page, "Image");
        await first.focus();
        await page.keyboard.press("Tab");
        await expect(choice(page, "PDF")).toBeFocused();
        const outline = await choice(page, "PDF").evaluate(element => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThan(0);

        await first.focus();
        await page.keyboard.press("Enter");
        await expect(finder(page).locator("h2")).toHaveText("What do you want to do with an image?");
        await expect(finder(page).locator("h2")).toBeFocused();
        await choice(page, "Change width or height").focus();
        await page.keyboard.press("Space");
        await expect(page.locator("[data-guide-recommendation] h2")).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.locator("[data-guide-open]")).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(finder(page).getByRole("button", { name: "Back" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(finder(page).locator("h2")).toBeFocused();
        await expect(finder(page).locator("h2")).toHaveText("What do you want to do with an image?");
    });

    test("semantics: one H1, a polite live region, real buttons, no nested interactive elements and no file or form control", async ({ page }) => {
        await page.goto("/guide");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.locator("[data-guide-announcement]")).toHaveAttribute("aria-live", "polite");
        await expect(page.locator("[data-guide-announcement]")).toHaveAttribute("role", "status");
        await expect(page.locator("[data-guide-announcement]")).toHaveText("");
        await choice(page, "Math").click();
        await expect(page.locator("[data-guide-announcement]")).toContainText("Recommendation: Calculator");
        await finder(page).getByRole("button", { name: "Start over" }).click();
        await expect(page.locator("[data-guide-announcement]")).toHaveText("");
        for (const state of [async () => undefined, async () => choice(page, "PDF").click(), async () => choice(page, "Join entire PDF documents").click()]) {
            await state();
            expect(await page.locator("button a, a button, button button, a a, button input, a input").count()).toBe(0);
            expect(await page.locator("main form, main input[type=file], main [type=submit]").count()).toBe(0);
            const heading = await page.locator("main h1, main h2, main h3").evaluateAll(list => list.map(item => Number(item.tagName.slice(1))));
            expect(heading[0]).toBe(1);
            for (let index = 1; index < heading.length; index++) expect(heading[index] - heading[index - 1], "no skipped heading level").toBeLessThanOrEqual(1);
        }
    });

    for (const width of WIDTH) {
        test(`reads without horizontal overflow or header clipping at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await page.goto("/guide");
            expect(await noOverflow(page), "root").toBe(true);
            await choice(page, "PDF").click();
            expect(await noOverflow(page), "pdf choices").toBe(true);
            for (const button of await finder(page).locator("[data-guide-choice]").all()) {
                const box = (await button.boundingBox())!;
                expect(box.x, "no clipped choice").toBeGreaterThanOrEqual(0);
                expect(box.x + box.width, "no clipped choice").toBeLessThanOrEqual(width);
                expect(box.height).toBeGreaterThanOrEqual(43);
            }
            await choice(page, "Assemble selected PDF pages and images in a chosen order").click();
            expect(await noOverflow(page), "recommendation").toBe(true);
            const focusedClearance = await page.evaluate(() => document.querySelector("[data-guide-recommendation] h2")!.getBoundingClientRect().top - document.querySelector("header")!.getBoundingClientRect().bottom);
            expect(focusedClearance, "the focused heading is not hidden behind the fixed header").toBeGreaterThanOrEqual(-1);
            await page.evaluate(() => window.scrollTo(0, 0));
            const clearance = await page.evaluate(() => document.querySelector("h1")!.getBoundingClientRect().top - document.querySelector("header")!.getBoundingClientRect().bottom);
            expect(clearance).toBeGreaterThanOrEqual(-1);
        });
    }
});

test.describe("privacy and preservation (TST-008)", () => {
    test("the finder makes no non-GET request, no off-origin request and no storage or URL change while it is used", async ({ page }) => {
        const request: { method: string; url: string }[] = [];
        page.on("request", item => request.push({ method: item.method(), url: item.url() }));
        await page.goto("/guide", { waitUntil: "networkidle" });
        const storage = () => page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
        const before = await storage();
        const mark = request.length;
        for (const outcome of OUTCOME.slice(0, 8)) {
            await chooseOutcome(page, outcome);
            await finder(page).getByRole("button", { name: "Start over" }).click();
        }
        expect(request.slice(mark), "no request while choosing").toEqual([]);
        expect(request.every(item => item.method === "GET")).toBe(true);
        expect(request.every(item => new URL(item.url).origin === new URL(page.url()).origin || item.url.startsWith("data:") || item.url.startsWith("blob:"))).toBe(true);
        expect(await storage()).toBe(before);
        expect(page.url()).toMatch(/\/guide$/);
    });

    test("the authored manual records and example assets still exist and the sample files still serve", async ({ request }) => {
        for (const file of ["/examples/v0.4.4/merge-pdf/result.pdf", "/examples/v0.4.4/merge-pdf/source-001.pdf"]) expect((await request.get(file)).status(), file).toBe(200);
    });
});

/* ---- Appearance lane: computed contrast in all 13 appearances and opt-in screenshots ---- */

const SCREENSHOT_DIR = process.env.GUIDE_SCREENSHOT_DIR;
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
    const width = page.viewportSize()!.width;
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${state}__${appearanceId}__${width >= 1000 ? "desktop1280" : "mobile390"}.png`), fullPage: true });
}

interface ContrastRow { target: string; foreground: string; background: string; ratio: number; minimum: number; passed: boolean }
interface ContrastTarget { name: string; selector: string; kind: "text" | "border"; minimum: number }

/** WCAG contrast from the browser's resolved colors, compositing translucent backgrounds up the ancestor chain. */
async function measureContrast(page: Page, target: ContrastTarget[]): Promise<ContrastRow[]> {
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

const ROOT_TARGET: ContrastTarget[] = [
    { name: "Page heading", selector: "main h1", kind: "text", minimum: 4.5 },
    { name: "Introduction text", selector: "main header > p", kind: "text", minimum: 4.5 },
    { name: "Question heading", selector: "[data-guide-finder] h2", kind: "text", minimum: 4.5 },
    { name: "Choice text", selector: "[data-guide-choice]", kind: "text", minimum: 4.5 },
    { name: "Choice boundary", selector: "[data-guide-choice]", kind: "border", minimum: 3 },
    { name: "Browse text link", selector: "main a[href='/discover']", kind: "text", minimum: 4.5 },
];
const QUESTION_TARGET: ContrastTarget[] = [
    { name: "Chosen path text", selector: "[data-guide-chosen]", kind: "text", minimum: 4.5 },
    { name: "Task heading", selector: "[data-guide-finder] h2", kind: "text", minimum: 4.5 },
    { name: "Task choice text", selector: "[data-guide-choice]", kind: "text", minimum: 4.5 },
    { name: "Task choice boundary", selector: "[data-guide-choice]", kind: "border", minimum: 3 },
    { name: "Back text", selector: "[data-guide-back]", kind: "text", minimum: 4.5 },
    { name: "Back boundary", selector: "[data-guide-back]", kind: "border", minimum: 3 },
    { name: "Start over text", selector: "[data-guide-restart]", kind: "text", minimum: 4.5 },
    { name: "Start over boundary", selector: "[data-guide-restart]", kind: "border", minimum: 3 },
];
const RECOMMENDATION_TARGET: ContrastTarget[] = [
    { name: "Recommendation heading", selector: "[data-guide-recommendation] h2", kind: "text", minimum: 4.5 },
    { name: "Rationale text", selector: "[data-guide-recommendation] p", kind: "text", minimum: 4.5 },
    { name: "Open link text", selector: "[data-guide-open]", kind: "text", minimum: 4.5 },
    { name: "Chosen path text", selector: "[data-guide-chosen]", kind: "text", minimum: 4.5 },
    { name: "Back text", selector: "[data-guide-back]", kind: "text", minimum: 4.5 },
    { name: "Back boundary", selector: "[data-guide-back]", kind: "border", minimum: 3 },
];

test.describe("appearances: computed contrast, reading and screenshots (TST-009)", () => {
    for (const appearance of APPEARANCE) {
        test(`appearance ${appearance.id}: root, question and recommendation meet WCAG with no overflow`, async ({ page }, testInfo) => {
            await useAppearance(page, appearance);
            await page.goto("/guide");
            await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
            const captureThis = CAPTURE_APPEARANCE.includes(appearance.id);
            const rootRow = await measureContrast(page, ROOT_TARGET);
            if (captureThis) await capture(page, "root", appearance.id);
            expect(await noOverflow(page), "root overflow").toBe(true);

            const row: ContrastRow[] = [...rootRow];
            const questionRow: ContrastRow[] = [];
            for (const [family, state] of [["Image", "image-choices"], ["PDF", "pdf-choices"], ["Text", "text-choices"], ["Converters", "converter-choices"], ["Developer", "developer-choices"]] as const) {
                await choice(page, family).click();
                if (family === "Image") questionRow.push(...await measureContrast(page, QUESTION_TARGET));
                if (captureThis) await capture(page, state, appearance.id);
                expect(await noOverflow(page), `${state} overflow`).toBe(true);
                await finder(page).getByRole("button", { name: "Start over" }).click();
            }
            row.push(...questionRow);

            const recommendationRow: ContrastRow[] = [];
            const result: Array<[Outcome, string]> = [
                [{ family: "Math", href: "" }, "math-result"],
                [{ family: "Time", href: "" }, "time-result"],
                [{ family: "Image", task: "Meet format, dimensions and maximum-byte rules", href: "" }, "workflow-prepare-image-result"],
                [{ family: "Image", task: "Combine HEIC photos into one PDF", href: "" }, "workflow-heic-photos-result"],
                [{ family: "PDF", task: "Assemble selected PDF pages and images in a chosen order", href: "" }, "workflow-assemble-packet-result"],
                [{ family: "PDF", task: "Prepare PDF pages as images for slides", href: "" }, "workflow-slides-result"],
            ];
            for (const [outcome, state] of result) {
                await chooseOutcome(page, outcome);
                await expect(page.locator("[data-guide-recommendation]")).toBeVisible();
                if (state === "math-result") recommendationRow.push(...await measureContrast(page, RECOMMENDATION_TARGET));
                if (captureThis) await capture(page, state, appearance.id);
                expect(await noOverflow(page), `${state} overflow`).toBe(true);
                await finder(page).getByRole("button", { name: "Start over" }).click();
            }
            row.push(...recommendationRow);

            await testInfo.attach(`contrast-${appearance.id}`, { body: JSON.stringify({ appearance: appearance.id, viewport: page.viewportSize(), row }, null, 2), contentType: "application/json" });
            expect(row.filter(item => !item.passed), `${appearance.id}: every measured text and control boundary meets WCAG`).toEqual([]);
        });
    }
});
