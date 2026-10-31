import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/* Prompt 8: natural multi-term search on Home and All tools, canonical labels, one result presentation, one tag control,
   short keyboard path, live status, privacy, and contrast/screenshot evidence in all thirteen appearances.
   Expectations are typed here independently of the production registry and matcher.
   Optional: P08_SHOT_DIR receives <state>__<appearance>__<viewport>.png (never overwritten); contrast rows go to
   test-report/e2e/<E2E_RUN_ID>/p08-data/contrast-search.json. */

type Rgb = [number, number, number];
interface Appearance { id: string; palette: string; mode: "light" | "dark"; }
interface ViewportSpec { id: "desktop1280" | "mobile390"; width: number; height: number }

const TOOL_SLUG = [
    "merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf", "slugify", "calculator", "length-converter", "html-text-extractor",
    "weight-converter", "time-arithmetic", "image-resizer", "image-compressor", "image-converter", "heic-converter", "json-formatter",
    "word-character-counter", "qr-code-generator",
];
const CATEGORY_TITLE: Record<string, string> = {
    document: "PDF Tools", text: "Text Tools", math: "Math Tools", converter: "Converters", time: "Time Tools", image: "Image Tools", developer: "Developer Tools",
};
const NO_RESULT = "No tools found. Try a different name or task.";
const PALETTE = ["original", "mineral", "oxblood", "signal", "cobalt", "amber"];
const APPEARANCE: Appearance[] = [
    ...PALETTE.flatMap(palette => [
        { id: `${palette}-light`, palette, mode: "light" as const },
        { id: `${palette}-dark`, palette, mode: "dark" as const },
    ]),
    { id: "onedark", palette: "onedark", mode: "dark" },
];
const FOCUS_APPEARANCE = ["original-light", "original-dark", "onedark"];
const VIEWPORT: ViewportSpec[] = [
    { id: "desktop1280", width: 1280, height: 720 },
    { id: "mobile390", width: 390, height: 844 },
];
const WIDTH = [320, 360, 390, 768, 1280];

const shotDir = process.env.P08_SHOT_DIR;
const dataDir = path.join("test-report", "e2e", process.env.E2E_RUN_ID ?? "unnamed", "p08-data");

// ---- contrast arithmetic (WCAG 2.x) ----
const channel = (value: number) => { const unit = value / 255; return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(a: Rgb, b: Rgb): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
const isLarge = (size: number, weight: number) => size >= 24 || (size >= 18.66 && weight >= 700);

test("contrast arithmetic matches WCAG reference pairs", () => {
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(ratio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.478, 2);
    expect(isLarge(24, 400)).toBe(true);
    expect(isLarge(16, 700)).toBe(false);
});

// ---- browser-side measurement over the actually painted, composited ancestors ----
interface TextPaint { text: string; element: string; fg: Rgb; bg: Rgb; size: number; weight: number; gradient: boolean; }
interface EdgePaint { element: string; border: Rgb; outer: Rgb; inner: Rgb; width: number; }
interface OutlinePaint { element: string; outline: Rgb; outer: Rgb; width: number; style: string; }

async function textPaint(page: Page, selector: string): Promise<TextPaint[]> {
    return page.evaluate(css => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const read = () => { const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] as [number, number, number]; };
        const result: TextPaint[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(css))) {
            const isField = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
            const text = (isField ? (el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? "" : el.value) : el.textContent ?? "").replace(/\s+/g, " ").trim();
            if (!text || el.getClientRects().length === 0) continue;
            const chain: HTMLElement[] = [];
            for (let node: HTMLElement | null = el; node; node = node.parentElement) chain.unshift(node);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, 1, 1);
            let gradient = false;
            for (const node of chain) {
                const style = getComputedStyle(node);
                if (style.backgroundImage !== "none") gradient = true;
                context.fillStyle = style.backgroundColor;
                context.fillRect(0, 0, 1, 1);
            }
            const bg = read();
            const style = getComputedStyle(el);
            context.fillStyle = `rgb(${bg.join(" ")})`;
            context.fillRect(0, 0, 1, 1);
            context.fillStyle = style.color;
            context.fillRect(0, 0, 1, 1);
            result.push({ text: text.slice(0, 50), element: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`, fg: read(), bg, size: parseFloat(style.fontSize), weight: Number(style.fontWeight) || 400, gradient });
        }
        return result;
    }, selector);
}

async function edgePaint(page: Page, selector: string): Promise<EdgePaint[]> {
    return page.evaluate(css => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const read = () => { const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] as [number, number, number]; };
        const backdrop = (el: HTMLElement, includeSelf: boolean) => {
            const chain: HTMLElement[] = [];
            for (let node: HTMLElement | null = includeSelf ? el : el.parentElement; node; node = node.parentElement) chain.unshift(node);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, 1, 1);
            for (const node of chain) { context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1); }
            return read();
        };
        const result: EdgePaint[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(css))) {
            if (el.getClientRects().length === 0) continue;
            const style = getComputedStyle(el);
            const outer = backdrop(el, false);
            const inner = backdrop(el, true);
            context.fillStyle = `rgb(${outer.join(" ")})`;
            context.fillRect(0, 0, 1, 1);
            context.fillStyle = style.borderTopColor;
            context.fillRect(0, 0, 1, 1);
            result.push({ element: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`, border: read(), outer, inner, width: parseFloat(style.borderTopWidth) });
        }
        return result;
    }, selector);
}

async function outlinePaint(locator: Locator): Promise<OutlinePaint> {
    return locator.evaluate(el => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const read = () => { const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] as [number, number, number]; };
        const chain: HTMLElement[] = [];
        for (let node: HTMLElement | null = el.parentElement; node; node = node.parentElement) chain.unshift(node);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 1, 1);
        for (const node of chain) { context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1); }
        const outer = read();
        const style = getComputedStyle(el);
        context.fillStyle = `rgb(${outer.join(" ")})`;
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = style.outlineColor;
        context.fillRect(0, 0, 1, 1);
        return { element: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`, outline: read(), outer, width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
}

interface Row { appearance: string; viewport: string; check: string; element: string; text: string; ratio: number; threshold: number; pass: boolean }
const rows: Row[] = [];
function writeRows(): void {
    if (rows.length === 0) return;
    mkdirSync(dataDir, { recursive: true });
    const target = path.join(dataDir, "contrast-search.json");
    const previous: Row[] = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : [];
    writeFileSync(target, JSON.stringify([...previous, ...rows], null, 1));
    rows.length = 0;
}
test.afterEach(() => writeRows());

async function checkText(page: Page, appearance: string, viewport: string, check: string, selector: string, minimum = 1): Promise<void> {
    const found = await textPaint(page, selector);
    expect(found.length, `${check}: ${selector} paints text (${appearance}, ${viewport})`).toBeGreaterThanOrEqual(minimum);
    for (const item of found) {
        const threshold = isLarge(item.size, item.weight) ? 3 : 4.5;
        const value = ratio(item.fg, item.bg);
        rows.push({ appearance, viewport, check, element: item.element, text: item.text, ratio: Math.round(value * 100) / 100, threshold, pass: value >= threshold && !item.gradient });
    }
    const failed = rows.filter(row => row.check === check && row.appearance === appearance && row.viewport === viewport && !row.pass);
    expect.soft(failed.map(row => `${row.element} "${row.text}" ${row.ratio}<${row.threshold}`), `${check} text contrast (${appearance}, ${viewport})`).toEqual([]);
}

async function checkEdge(page: Page, appearance: string, viewport: string, check: string, selector: string): Promise<void> {
    const found = await edgePaint(page, selector);
    expect(found.length, `${check}: ${selector} painted (${appearance}, ${viewport})`).toBeGreaterThan(0);
    for (const item of found) {
        expect.soft(item.width, `${check} ${item.element} draws a visible border`).toBeGreaterThanOrEqual(1);
        const outer = ratio(item.border, item.outer);
        const inner = ratio(item.border, item.inner);
        rows.push({ appearance, viewport, check: `${check} (border vs surrounding panel)`, element: item.element, text: "", ratio: Math.round(outer * 100) / 100, threshold: 3, pass: outer >= 3 });
        rows.push({ appearance, viewport, check: `${check} (border vs field fill)`, element: item.element, text: "", ratio: Math.round(inner * 100) / 100, threshold: 3, pass: inner >= 3 });
        expect.soft(outer, `${check} ${item.element} border against its surrounding panel (${appearance}, ${viewport})`).toBeGreaterThanOrEqual(3);
        expect.soft(inner, `${check} ${item.element} border against its field fill (${appearance}, ${viewport})`).toBeGreaterThanOrEqual(3);
    }
}

async function checkFocus(appearance: string, viewport: string, check: string, locator: Locator): Promise<void> {
    const paint = await outlinePaint(locator);
    const value = ratio(paint.outline, paint.outer);
    rows.push({ appearance, viewport, check, element: paint.element, text: `outline ${paint.style} ${paint.width}px`, ratio: Math.round(value * 100) / 100, threshold: 3, pass: value >= 3 && paint.width >= 2 && paint.style !== "none" });
    expect.soft(paint.style, `${check} focus outline is drawn`).not.toBe("none");
    expect.soft(paint.width, `${check} focus outline is at least 2px`).toBeGreaterThanOrEqual(2);
    expect.soft(value, `${check} focus outline against its surroundings (${appearance}, ${viewport})`).toBeGreaterThanOrEqual(3);
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const resultLink = (page: Page) => page.locator("main .ds-results li a");
const statusText = (page: Page) => page.locator('main [role="status"]').first();
const search = (page: Page) => page.getByLabel("Search", { exact: true });

async function shot(page: Page, state: string, appearance: string, viewport: string): Promise<void> {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const file = path.join(shotDir, `${state}__${appearance}__${viewport}.png`);
    if (existsSync(file)) throw new Error(`Screenshot collision, refusing to overwrite ${file}`);
    await page.screenshot({ path: file });
}

// ---------------------------------------------------------------------------------------------
test.describe("natural-language search behaviour", () => {
    test("Home with a blank query keeps seven category entries and exactly 18 catalog cards, with no result list", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#home-categories-title ~ ul a")).toHaveCount(7);
        const href = await page.locator('main a[href^="/tool/"]').evaluateAll(list => list.map(a => a.getAttribute("href")));
        expect(href).toHaveLength(18);
        expect(new Set(href).size).toBe(18);
        expect([...href].sort()).toEqual(TOOL_SLUG.map(slug => `/tool/${slug}`).sort());
        await expect(page.locator(".ds-results")).toHaveCount(0);
        await expect(statusText(page)).toHaveText("");
    });

    test("Home: a query swaps the category entries and catalog for ONE filtered list, and clearing restores them", async ({ page }) => {
        await page.goto("/");
        await search(page).fill("resize image");
        await expect(page.locator(".ds-results")).toHaveCount(1);
        await expect(resultLink(page)).toHaveCount(1);
        await expect(resultLink(page).first()).toHaveAttribute("href", "/tool/image-resizer");
        await expect(page.locator("[data-home-board]")).toHaveCount(0);
        await expect(page.locator("#home-categories-title")).toHaveCount(0);
        await expect(page.locator('main a[href^="/tool/"]')).toHaveCount(1);
        await expect(statusText(page)).toHaveText("1 tool found");
        await expect(resultLink(page).first()).toContainText("Image Tools");
        await search(page).fill("");
        await expect(page.locator(".ds-results")).toHaveCount(0);
        await expect(page.locator('main a[href^="/tool/"]')).toHaveCount(18);
        await expect(page.locator("[data-home-board]")).toHaveCount(7);
        await expect(statusText(page)).toHaveText("");
    });

    const INTENT: [string, string][] = [
        ["resize image", "image-resizer"],
        ["pdf to image", "pdf-to-image"],
        ["images to pdf", "images-to-pdf"],
        ["heif", "heic-converter"],
        ["merge pdf files", "merge-pdf"],
        ["count words", "word-character-counter"],
        ["calculate", "calculator"],
        ["extract text from html", "html-text-extractor"],
        ["reduce image size", "image-compressor"],
        ["compressing pdfs", "compress-pdf"],
    ];
    for (const [query, slug] of INTENT) {
        test(`/discover: "${query}" ranks ${slug} first`, async ({ page }) => {
            await page.goto("/discover");
            await search(page).fill(query);
            await expect(resultLink(page).first()).toHaveAttribute("href", `/tool/${slug}`);
            await expect(page.locator(".ds-results")).toHaveCount(1);
            await expect(page.locator('main a[href^="/tool/"]')).toHaveCount(await resultLink(page).count());
        });
    }

    test("an unmatched query announces a calm empty state, with no alert and no guessed results", async ({ page }) => {
        await page.goto("/discover");
        await search(page).fill("zzzz-no-such-tool");
        await expect(statusText(page)).toHaveText(NO_RESULT);
        await expect(page.locator(".ds-results")).toHaveCount(0);
        await expect(page.locator('main a[href^="/tool/"]')).toHaveCount(0);
        await expect(page.locator('main [role="alert"]')).toHaveCount(0);
        await search(page).fill("");
        await expect(statusText(page)).toHaveText("18 tools found");
    });

    test("/discover shows ONE filterable list of 18 tools with canonical category labels, search first and the category overview after", async ({ page }) => {
        await page.goto("/discover");
        await expect(page.locator(".ds-results")).toHaveCount(1);
        await expect(page.locator('main a[href^="/tool/"]')).toHaveCount(18);
        await expect(statusText(page)).toHaveText("18 tools found");
        const order = await page.evaluate(() => {
            const position = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            const input = document.querySelector("#tool-search")!;
            const list = document.querySelector(".ds-results")!;
            const overview = document.querySelector("#discover-category-title")!;
            return { searchBeforeList: position(input, list), listBeforeOverview: position(list, overview) };
        });
        expect(order).toEqual({ searchBeforeList: true, listBeforeOverview: true });
        await expect(page.locator('main a[href^="/category/"]')).toHaveCount(7);
        const badge = await page.locator(".ds-results li a > div > div:last-child").allTextContents();
        expect(badge).toHaveLength(18);
        for (const text of badge) expect(Object.values(CATEGORY_TITLE)).toContain(text.trim());
        for (const raw of Object.keys(CATEGORY_TITLE)) expect(badge).not.toContain(raw);
    });

    test("exactly one labelled tag control replaces per-tag buttons and combines with a query", async ({ page }) => {
        await page.goto("/discover");
        const select = page.getByLabel("Filter by tag", { exact: true });
        await expect(select).toHaveCount(1);
        await expect(select).toHaveAttribute("id", "tool-tag-filter");
        const option = await select.locator("option").allTextContents();
        expect(option[0]).toBe("All tags");
        expect(option.slice(1)).toEqual([...option.slice(1)].sort());
        expect(option).toContain("heif");
        await expect(page.locator("main button")).toHaveCount(0);
        await select.selectOption("heif");
        await expect(statusText(page)).toHaveText("1 tool found");
        await expect(resultLink(page).first()).toHaveAttribute("href", "/tool/heic-converter");
        await search(page).fill("convert");
        await expect(statusText(page)).toHaveText("1 tool found");
        await search(page).fill("resize");
        await expect(statusText(page)).toHaveText(NO_RESULT);
        await search(page).fill("");
        await select.selectOption("");
        await expect(statusText(page)).toHaveText("18 tools found");
    });

    test("the keyboard path from search to the first result needs at most three Tab presses", async ({ page }) => {
        await page.goto("/discover");
        await search(page).focus();
        let presses = 0;
        for (; presses < 5; presses++) {
            await page.keyboard.press("Tab");
            const onResult = await page.evaluate(() => document.activeElement?.matches('.ds-results li a[href^="/tool/"]') ?? false);
            if (onResult) { presses++; break; }
        }
        expect(presses).toBeLessThanOrEqual(3);
        expect(await page.evaluate(() => document.activeElement?.matches('.ds-results li a[href^="/tool/"]'))).toBe(true);

        await page.goto("/");
        await search(page).fill("pdf");
        await search(page).focus();
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.activeElement?.matches('.ds-results li a[href^="/tool/"]'))).toBe(true);
    });

    test("Enter on a focused result opens the real tool page, and browser Back returns to a usable search page", async ({ page }) => {
        await page.goto("/discover");
        await search(page).fill("resize image");
        await resultLink(page).first().focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/tool\/image-resizer$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/discover$/);
        await expect(search(page)).toBeVisible();
        await search(page).fill("calculate");
        await expect(statusText(page)).toHaveText("1 tool found");
    });

    test("Header Search focuses the input on arrival, and an ordinary /discover visit takes no focus", async ({ page }) => {
        await page.goto("/discover#tool-search");
        await expect(search(page)).toBeFocused();
        await page.goto("/discover");
        await expect(search(page)).not.toBeFocused();
    });

    test("the first mobile or desktop viewport holds the labelled search, a readable placeholder and the first result", async ({ page }) => {
        await page.goto("/discover");
        const view = page.viewportSize()!;
        const box = (await search(page).boundingBox())!;
        expect(box.y + box.height, "search input sits inside the first viewport").toBeLessThanOrEqual(view.height);
        const first = (await resultLink(page).first().boundingBox())!;
        expect(first.y, "the first result starts inside the first viewport").toBeLessThan(view.height);
        await expect(page.locator('label[for="tool-search"]')).toHaveText("Search");
        await expect(search(page)).toHaveAttribute("placeholder", "Search tools or tasks");
        const fits = await search(page).evaluate(el => {
            const input = el as HTMLInputElement;
            const style = getComputedStyle(input);
            const context = document.createElement("canvas").getContext("2d")!;
            context.font = style.font;
            const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return context.measureText(input.placeholder).width <= available;
        });
        expect(fits, "the full placeholder is legible without truncation").toBe(true);
    });

    test("result descriptions are complete sentences: no line clamp, no clipping, no overflow", async ({ page }) => {
        await page.goto("/discover");
        await expect(page.locator(".line-clamp-2")).toHaveCount(0);
        const problems = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".ds-results li a")).flatMap(link => {
            const description = link.querySelectorAll<HTMLElement>("div")[2];
            const clamp = getComputedStyle(description).webkitLineClamp;
            const clipped = description.scrollHeight > description.clientHeight + 1 || description.scrollWidth > description.clientWidth + 1;
            return clamp !== "none" || clipped ? [link.getAttribute("href")] : [];
        }));
        expect(problems).toEqual([]);
        expect(await noOverflow(page)).toBe(true);
    });

    test("search stays client-local: no request, URL, storage or log carries the query", async ({ page }) => {
        await page.goto("/discover");
        await page.waitForLoadState("networkidle");
        const seen: string[] = [];
        page.on("request", request => seen.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));
        await search(page).fill("resize image");
        await page.waitForTimeout(600);
        // Next.js may prefetch visible same-origin links (GET ?_rsc=); the query must appear in no request, URL or body, and nothing may be POSTed.
        expect(seen.filter(entry => entry.toLowerCase().replace("image-resizer", "").includes("resiz") || entry.startsWith("POST") || entry.includes("/api/"))).toEqual([]);
        expect(page.url()).not.toMatch(/resize|[?#]q=/);
        const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
        expect(stored).not.toContain("resize");
    });

    test("route inventory stays at 36 canonical URLs", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        expect(xml.match(/<loc>/g)).toHaveLength(36);
        for (const slug of TOOL_SLUG) expect(xml).toContain(`/tool/${slug}</loc>`);
        for (const category of Object.keys(CATEGORY_TITLE)) expect(xml).toContain(`/category/${category}</loc>`);
        expect(xml).not.toMatch(/\/guide\/[a-z-]+<\/loc>/);
    });

    test("no horizontal overflow at 320, 360, 390, 768 and 1280 on Home and All tools, blank, matching and empty", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "This test sets its own viewport widths");
        for (const width of WIDTH) {
            await page.setViewportSize({ width, height: 844 });
            for (const route of ["/", "/discover"]) {
                await page.goto(route);
                expect(await noOverflow(page), `${route} blank at ${width}`).toBe(true);
                await search(page).fill("pdf");
                expect(await noOverflow(page), `${route} "pdf" at ${width}`).toBe(true);
                await search(page).fill("zzzz");
                expect(await noOverflow(page), `${route} empty at ${width}`).toBe(true);
            }
        }
    });
});

// ---------------------------------------------------------------------------------------------
test.describe("thirteen appearances: contrast, boundaries, focus and screenshots", () => {
    test.beforeEach(async ({}, info) => { test.skip(info.project.name !== "desktop-chromium", "The matrix sets its own desktop and mobile viewports"); });
    test.setTimeout(240_000);

    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: search surfaces, empty state, One Dark/tool input border and focus`, async ({ page }) => {
            await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
            await page.addInitScript(({ palette, mode }) => {
                localStorage.setItem("palette", JSON.stringify(palette));
                localStorage.setItem("theme", JSON.stringify(palette === "onedark" ? "onedark" : mode));
            }, { palette: appearance.palette, mode: appearance.mode });
            const withShots = FOCUS_APPEARANCE.includes(appearance.id);

            for (const viewport of VIEWPORT) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                const where = `${appearance.id}/${viewport.id}`;

                await page.goto("/discover");
                await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
                await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.palette === "onedark" ? "onedark" : appearance.mode);
                await expect(statusText(page)).toHaveText("18 tools found");
                await shot(page, "discover-default", appearance.id, viewport.id);
                await checkText(page, appearance.id, viewport.id, "search label and status", 'label[for="tool-search"], label[for="tool-tag-filter"], main [role="status"]', 3);
                await checkText(page, appearance.id, viewport.id, "search and tag fields", "#tool-search, #tool-tag-filter");
                await checkText(page, appearance.id, viewport.id, "result title, description and category badge", ".ds-results li a div", 3);
                await checkEdge(page, appearance.id, viewport.id, "search field boundary", "#tool-search, #tool-tag-filter");
                await checkText(page, appearance.id, viewport.id, "category overview", "#discover-category-title, #discover-category-title ~ ul h3", 2);

                await search(page).fill("resize image");
                await expect(statusText(page)).toHaveText("1 tool found");
                await shot(page, "discover-multi", appearance.id, viewport.id);
                await checkText(page, appearance.id, viewport.id, "multi-term result", ".ds-results li a div", 3);
                await search(page).focus();
                await checkFocus(appearance.id, viewport.id, "search input focus", search(page));
                await page.keyboard.press("Tab");
                await page.keyboard.press("Tab");
                await checkFocus(appearance.id, viewport.id, "result link focus", page.locator(".ds-results li a").first());

                await search(page).fill("zzzz-no-such-tool");
                await expect(statusText(page)).toHaveText(NO_RESULT);
                if (withShots) await shot(page, "discover-empty", appearance.id, viewport.id);
                await checkText(page, appearance.id, viewport.id, "empty state status", 'main [role="status"]');

                if (withShots) {
                    await page.goto("/");
                    await search(page).fill("resize image");
                    await expect(statusText(page)).toHaveText("1 tool found");
                    await shot(page, "home-search", appearance.id, viewport.id);
                    await checkText(page, appearance.id, viewport.id, "home result", ".ds-results li a div", 3);
                }

                // The shared tool input boundary (One Dark must reach 3:1 against the work panel that contains it).
                await page.goto("/tool/html-text-extractor");
                await checkEdge(page, appearance.id, viewport.id, "tool input boundary", "#html-input");
                await checkText(page, appearance.id, viewport.id, "tool panel text", "label[for='html-input'], label[for='text-output'], .tool-work button", 2);
                expect(where).toBeTruthy();
            }
        });
    }
});
