import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/* Prompt 8: tool-page content order, one-tool categories, Privacy contents list, Contact truthfulness, tool messages,
   workflow links, Guide recommendation surface and screenshots/contrast of the content states.
   Expectations are typed here independently of the production registry and guide data.
   Optional: P08_SHOT_DIR receives <state>__<appearance>__<viewport>.png (never overwritten); contrast rows go to
   test-report/e2e/<E2E_RUN_ID>/p08-data/contrast-content.json. */

type Rgb = [number, number, number];
interface Appearance { id: string; palette: string; mode: "light" | "dark"; }

const TOOL_SLUG = [
    "merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf", "slugify", "calculator", "length-converter", "html-text-extractor",
    "weight-converter", "time-arithmetic", "image-resizer", "image-compressor", "image-converter", "heic-converter", "json-formatter",
    "word-character-counter", "qr-code-generator",
];
const WITH_EXAMPLE = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter", "merge-pdf", "split-pdf", "image-compressor", "heic-converter"];
const WORKFLOW_SLUG = ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"];
const PRIVACY_SECTION = [
    ["privacy-tool-inputs", "Tool inputs and local processing"],
    ["privacy-browser-storage", "Browser storage and offline use"],
    ["privacy-measurements", "Site measurements and diagnostics"],
    ["privacy-reports", "Problem reports and suggestions"],
    ["privacy-contact", "Contact Us messages"],
    ["privacy-providers", "Vercel Web Analytics and service providers"],
    ["privacy-advertising", "Google advertising and your choices"],
    ["privacy-choices", "Your browser choices and policy updates"],
];
const PALETTE = ["original", "mineral", "oxblood", "signal", "cobalt", "amber"];
const APPEARANCE: Appearance[] = [
    ...PALETTE.flatMap(palette => [
        { id: `${palette}-light`, palette, mode: "light" as const },
        { id: `${palette}-dark`, palette, mode: "dark" as const },
    ]),
    { id: "onedark", palette: "onedark", mode: "dark" },
];
const FOCUS_APPEARANCE = ["original-light", "original-dark", "onedark"];
const VIEWPORT = [
    { id: "desktop1280", width: 1280, height: 720 },
    { id: "mobile390", width: 390, height: 844 },
];
const WIDTH = [320, 360, 390, 768, 1280];

const shotDir = process.env.P08_SHOT_DIR;
const dataDir = path.join("test-report", "e2e", process.env.E2E_RUN_ID ?? "unnamed", "p08-data");
const pdf = (name: string) => path.resolve("test/fixtures/pdf", `${name}.pdf`);

// ---- contrast arithmetic (WCAG 2.x) ----
const channel = (value: number) => { const unit = value / 255; return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function ratio(a: Rgb, b: Rgb): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
const isLarge = (size: number, weight: number) => size >= 24 || (size >= 18.66 && weight >= 700);

interface TextPaint { text: string; element: string; fg: Rgb; bg: Rgb; size: number; weight: number; gradient: boolean; }

async function textPaint(page: Page, selector: string): Promise<TextPaint[]> {
    return page.evaluate(css => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const read = () => { const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] as [number, number, number]; };
        const result: TextPaint[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(css))) {
            const isField = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
            const own = isField ? (el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? "" : el.value || el.placeholder) : el.textContent ?? "";
            const text = own.replace(/\s+/g, " ").trim();
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

interface Row { appearance: string; viewport: string; check: string; element: string; text: string; ratio: number; threshold: number; pass: boolean }
const rows: Row[] = [];
function writeRows(): void {
    if (rows.length === 0) return;
    mkdirSync(dataDir, { recursive: true });
    const target = path.join(dataDir, "contrast-content.json");
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

async function shot(page: Page, state: string, appearance: string, viewport: string): Promise<void> {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const file = path.join(shotDir, `${state}__${appearance}__${viewport}.png`);
    if (existsSync(file)) throw new Error(`Screenshot collision, refusing to overwrite ${file}`);
    await page.screenshot({ path: file });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function openRecommendation(page: Page): Promise<void> {
    await page.goto("/guide");
    const finder = page.locator("[data-guide-finder]");
    await finder.getByRole("button", { name: "Image", exact: true }).click();
    await finder.getByRole("button", { name: "Change width or height", exact: true }).click();
    await expect(page.locator("[data-guide-recommendation]")).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
test.describe("tool page content order and hierarchy (AUD-009, 017, 018, 037)", () => {
    for (const slug of TOOL_SLUG) {
        test(`/tool/${slug}: tool, How to use, ${WITH_EXAMPLE.includes(slug) ? "Worked example, " : ""}details, Related tools`, async ({ page }) => {
            await page.goto(`/tool/${slug}`);
            await expect(page.locator("h1")).toHaveCount(1);
            const heading = (name: string) => page.locator("main h2", { hasText: new RegExp(`^${name}$`) });
            const order = ["How to use", ...(WITH_EXAMPLE.includes(slug) ? ["Worked example"] : []), "Details and limits", "Related tools"];
            for (const name of order) await expect(heading(name), name).toHaveCount(1);
            await expect(heading("Worked example")).toHaveCount(WITH_EXAMPLE.includes(slug) ? 1 : 0);
            const position = await page.evaluate(names => {
                const nodes = [document.querySelector("[data-tool-ui]")!, ...names.map(name => Array.from(document.querySelectorAll("main h2")).find(h => h.textContent?.trim() === name)!)];
                return nodes.map((node, index) => index === 0 ? true : Boolean(nodes[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
            }, order);
            expect(position.every(Boolean), "document order").toBe(true);
            await expect(page.locator("main h2", { hasText: /^Related (text|developer|image|document|converter|math|time) tools$/ })).toHaveCount(0);
            await expect(page.locator("[data-tool-reference] h3").first()).toBeVisible();
            const toolTop = (await page.locator("[data-tool-ui]").boundingBox())!.y;
            const howTop = (await heading("How to use").boundingBox())!.y;
            expect(toolTop, "the working tool precedes long-form copy").toBeLessThan(howTop);

            const measure = await page.evaluate(() => {
                const paragraph = document.querySelector<HTMLElement>("[data-tool-reference] p")!;
                const style = getComputedStyle(paragraph);
                const context = document.createElement("canvas").getContext("2d")!;
                context.font = style.font;
                const ch = context.measureText("0").width;
                return { chars: paragraph.clientWidth / ch, size: parseFloat(style.fontSize) };
            });
            expect(measure.chars, "explanatory prose is limited to roughly 75ch").toBeLessThanOrEqual(80);
            expect(await noOverflow(page)).toBe(true);
        });
    }

    test("quoted interface strings and the calm no-reduction explanation appear in the guides", async ({ page }) => {
        await page.goto("/tool/compress-pdf");
        const compress = page.locator("[data-tool-reference]");
        await expect(compress).toContainText("“NO REDUCTION ACHIEVED”");
        await expect(compress).toContainText("expected outcome, not an error");
        await page.goto("/tool/length-converter");
        await expect(page.locator("[data-tool-reference]")).toContainText("“Invalid input: enter a number.”");
        await expect(page.locator("[data-tool-reference]")).toContainText("“Result is out of range for this conversion.”");
        await page.goto("/tool/calculator");
        await expect(page.locator("[data-tool-reference]")).toContainText("“Mismatched parentheses.”");
        await page.goto("/tool/html-text-extractor");
        await expect(page.locator("[data-tool-reference]")).toContainText("“Enter HTML to extract text.”");
    });
});

test.describe("categories and single-tool pages (AUD-010, 011, 024)", () => {
    test("all seven canonical categories and 18 plain-language descriptions are intact", async ({ page }) => {
        await page.goto("/discover");
        const title = await page.locator("#discover-category-title ~ ul h3").allTextContents();
        expect(title).toEqual(["PDF Tools", "Text Tools", "Math Tools", "Converters", "Time Tools", "Image Tools", "Developer Tools"]);
        await page.goto("/");
        const description = await page.locator('main a[href^="/tool/"]').evaluateAll(list => list.map(a => (a.textContent ?? "").replace(/\s+/g, " ").trim()));
        expect(description).toHaveLength(18);
        expect(description.filter(text => text.includes("locally in your browser")), "the repeated local-processing suffix is gone from the catalog copy").toEqual([]);
        await page.goto("/tool/merge-pdf");
        await expect(page.getByText("Combine several PDF files into one PDF, in the order you choose.").first()).toBeVisible();
    });

    for (const category of ["math", "time"]) {
        test(`/category/${category}: the single tool card is reachable in the first viewport and the prose is not restated`, async ({ page }) => {
            await page.goto(`/category/${category}`);
            const view = page.viewportSize()!;
            const card = page.locator('main a[href^="/tool/"]');
            await expect(card).toHaveCount(1);
            const box = (await card.boundingBox())!;
            expect(box.y + box.height, "the card is fully inside the first viewport").toBeLessThanOrEqual(view.height);
            await expect(page.locator("#category-guidance-title")).toHaveText("Before you use it");
            await expect(page.locator("#category-guidance-title ~ ul")).toHaveCount(0);
            await expect(page.locator("#category-guidance-title").locator("..")).toContainText("Keep in mind:");
            const guidance = (await page.locator("#category-guidance-title").locator("..").innerText()).toLowerCase();
            const intro = (await page.locator("h1 + p").innerText()).toLowerCase();
            expect(guidance).not.toContain(intro.slice(0, 30));
            expect(await noOverflow(page)).toBe(true);
        });
    }

    test("a multi-tool category keeps its choice list", async ({ page }) => {
        await page.goto("/category/converter");
        await expect(page.locator("#category-guidance-title")).toHaveText("Choosing a tool");
        await expect(page.locator("#category-guidance-title ~ ul li")).toHaveCount(2);
    });
});

test.describe("Privacy contents list (AUD-034)", () => {
    test("lists the eight policy sections, lands each target clear of the fixed header and keeps focus on it", async ({ page }) => {
        await page.goto("/privacy");
        const nav = page.getByRole("navigation", { name: "On this page", exact: true });
        await expect(nav.getByRole("link")).toHaveCount(8);
        await expect(page.locator("main h2")).toHaveCount(8);
        for (const [id, title] of PRIVACY_SECTION) {
            await expect(nav.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `#${id}`);
            await expect(page.locator(`#${id}`)).toHaveCount(1);
            await expect(page.locator(`#${id}`)).toHaveText(title);
        }
        await expect(page.getByText("Last updated: October 27, 2026")).toBeVisible();
        for (const [id] of PRIVACY_SECTION) {
            await page.goto("/privacy");
            await nav.locator(`a[href="#${id}"]`).focus();
            await page.keyboard.press("Enter");
            await expect(page.locator(`#${id}`)).toBeFocused();
            const headerBottom = await page.evaluate(() => {
                const header = document.querySelector("header");
                const box = header?.getBoundingClientRect();
                return box && getComputedStyle(header!).position !== "static" ? box.bottom : 0;
            });
            const top = (await page.locator(`#${id}`).boundingBox())!.y;
            expect(top, `${id} is not covered by the fixed header`).toBeGreaterThanOrEqual(headerBottom - 1);
            expect(await noOverflow(page)).toBe(true);
        }
    });
});

test.describe("Contact copy (AUD-033)", () => {
    test("names the footer Report Issues control only if it is actually visible, and always shows the form", async ({ page }) => {
        await page.goto("/contact");
        const control = await page.getByRole("button", { name: /Report Issues/ }).count();
        const text = await page.locator("main").innerText();
        await expect(page.locator("form")).toHaveCount(1);
        if (control > 0) {
            expect(text).toContain("Report Issues control in the footer");
        } else {
            expect(text).not.toContain("Report Issues");
            expect(text).toContain("use the form below and name the tool");
        }
        expect(await noOverflow(page)).toBe(true);
    });
});

test.describe("tool messages (AUD-036, 045, 046)", () => {
    test("HTML Text Extractor: an empty source gives accessible feedback, no-text markup is distinguished, normal input is unchanged", async ({ page }) => {
        await page.goto("/tool/html-text-extractor");
        await page.getByRole("button", { name: "Convert", exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Enter HTML to extract text." })).toHaveCount(1);
        await expect(page.getByLabel("Extracted Text")).toHaveValue("");
        await page.getByLabel("HTML Input").fill("   \n ");
        await page.getByRole("button", { name: "Convert", exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Enter HTML to extract text." })).toHaveCount(1);
        await page.getByLabel("HTML Input").fill("<script>ignored()</script><!-- note -->");
        await page.getByRole("button", { name: "Convert", exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Enter HTML to extract text." })).toHaveCount(0);
        await expect(page.getByRole("status").filter({ hasText: "No visible text was found in this HTML." })).toHaveCount(1);
        await expect(page.getByLabel("Extracted Text")).toHaveValue("");
        await page.getByLabel("HTML Input").fill("<p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script>");
        await page.getByRole("button", { name: "Convert", exact: true }).click();
        await expect(page.getByLabel("Extracted Text")).toHaveValue("Hello world\nNext line");
        await expect(page.getByRole("status").filter({ hasText: "No visible text" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
    });

    test("Time Arithmetic: field errors are associated, invalid and announced once; calculations are unchanged", async ({ page }) => {
        await page.goto("/tool/time-arithmetic");
        const a = page.getByLabel("Time A", { exact: true });
        const b = page.getByLabel("Time B", { exact: true });
        await a.fill("1:5");
        await expect(a).toHaveAttribute("aria-invalid", "true");
        await expect(a).toHaveAttribute("aria-describedby", /time-a-error/);
        const error = page.locator("#time-a-error");
        await expect(error).toHaveText("Use HH:MM with two-digit minutes, such as 01:50.");
        await expect(error).toHaveAttribute("role", "alert");
        await expect(page.locator('[data-tool-ui] [role="alert"]')).toHaveCount(1);
        await expect(page.getByLabel("Time B", { exact: true })).toHaveAttribute("aria-invalid", "false");
        await expect(page.locator("main").getByText("--:--", { exact: true })).toBeVisible();
        await a.fill("01:50");
        await b.fill("00:61");
        await expect(b).toHaveAttribute("aria-invalid", "true");
        await expect(b).toHaveAttribute("aria-describedby", /time-b-error/);
        await expect(page.locator("#time-b-error")).toHaveAttribute("role", "alert");
        await expect(page.locator('[data-tool-ui] [role="alert"]')).toHaveCount(1);
        await b.fill("00:20");
        await expect(page.locator("main").getByText("02:10", { exact: true })).toBeVisible();
        await expect(a).toHaveAttribute("aria-invalid", "false");
        await expect(page.locator('[data-tool-ui] [role="alert"]')).toHaveCount(0);
        await page.getByLabel("Operation").selectOption("subtract");
        await a.fill("00:45");
        await b.fill("02:00");
        await expect(page.getByRole("alert").filter({ hasText: "Subtraction cannot produce a negative time value." })).toHaveCount(1);
        await a.fill("02:00");
        await b.fill("00:45");
        await expect(page.locator("main").getByText("01:15", { exact: true })).toBeVisible();
    });

    test("Split PDF uses 1 PDF verified and 2 PDFs verified", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Document processing is verified once, on desktop");
        test.setTimeout(120_000);
        await page.goto("/tool/split-pdf");
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
        await page.getByLabel("Pages for output group 1", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Split PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Split PDFs ready", exact: true })).toBeFocused({ timeout: 60_000 });
        await expect(page.getByRole("status").filter({ hasText: "verified" })).toHaveText("1 PDF verified. Download the file.");
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
        await page.getByLabel("Pages for output group 1", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Add output group", exact: true }).click();
        await page.getByLabel("Pages for output group 2", { exact: true }).fill("2");
        await page.getByRole("button", { name: "Split PDF", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Split PDFs ready", exact: true })).toBeFocused({ timeout: 60_000 });
        await expect(page.getByRole("status").filter({ hasText: "verified" })).toHaveText("2 PDFs verified. Download each file individually.");
    });

    test("PDF to JPG / PNG uses 1 image verified and 2 images verified", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Document processing is verified once, on desktop");
        test.setTimeout(120_000);
        await page.goto("/tool/pdf-to-image");
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
        await page.getByLabel("Pages to convert", { exact: true }).fill("1");
        await page.getByRole("button", { name: "Convert pages", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeFocused({ timeout: 60_000 });
        await expect(page.getByRole("status").filter({ hasText: "verified" })).toHaveText("1 image verified. Download the image.");
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
        await page.getByLabel("Pages to convert", { exact: true }).fill("1-2");
        await page.getByRole("button", { name: "Convert pages", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeFocused({ timeout: 60_000 });
        await expect(page.getByRole("status").filter({ hasText: "verified" })).toHaveText("2 images verified. Download each image individually.");
    });
});

test.describe("workflow links and Guide recommendation (Prompt 7 carry-forward)", () => {
    for (const slug of WORKFLOW_SLUG) {
        test(`/workflows/${slug}: no self-redirecting guide link, one finder link, and the old URL still redirects`, async ({ page, request }) => {
            await page.goto(`/workflows/${slug}`);
            await expect(page.locator(`main a[href="/guide/${slug}"]`)).toHaveCount(0);
            await expect(page.locator('main a[href^="/guide/"]')).toHaveCount(0);
            const link = page.getByRole("link", { name: "Find another tool or workflow", exact: true });
            await expect(link).toHaveCount(1);
            await expect(link).toHaveAttribute("href", "/guide");
            await link.click();
            await expect(page).toHaveURL(/\/guide$/);
            await expect(page.locator("[data-guide-finder]")).toBeVisible();
            const response = await request.get(`/guide/${slug}`, { maxRedirects: 0 });
            expect(response.status()).toBe(308);
            expect(new URL(response.headers()["location"], "http://127.0.0.1").pathname).toBe(`/workflows/${slug}`);
        });
    }

    test("the Workflows hub speaks of operational workflows and points to the finder, not manual guides", async ({ page }) => {
        await page.goto("/workflows");
        await expect(page.locator("main")).not.toContainText(/manual guide/i);
        await expect(page.getByRole("link", { name: /Find the right tool or workflow/ })).toHaveAttribute("href", "/guide");
        for (const slug of WORKFLOW_SLUG) await expect(page.locator(`main a[href="/workflows/${slug}"]`)).toHaveCount(1);
    });

    test("the Guide recommendation uses the neutral preview surface and wrapped choice labels stay left aligned", async ({ page }) => {
        await page.goto("/guide");
        const finder = page.locator("[data-guide-finder]");
        await finder.getByRole("button", { name: "Image", exact: true }).click();
        const alignment = await finder.locator("[data-guide-choice]").evaluateAll(list => list.map(button => {
            const style = getComputedStyle(button);
            const range = document.createRange();
            range.selectNodeContents(button);
            const left = range.getBoundingClientRect().left - button.getBoundingClientRect().left;
            const content = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
            return { justify: style.justifyContent, text: style.textAlign, offset: Math.round((left - content) * 10) / 10 };
        }));
        expect(alignment.length).toBeGreaterThan(3);
        for (const item of alignment) {
            expect(item.justify).toBe("flex-start");
            expect(["left", "start"]).toContain(item.text);
            expect(Math.abs(item.offset), "label starts at the content edge").toBeLessThanOrEqual(2);
        }
        await finder.getByRole("button", { name: "Change width or height", exact: true }).click();
        const section = page.locator("[data-guide-recommendation]");
        await expect(section).toHaveClass(/tool-preview/);
        await expect(section).not.toHaveClass(/tool-result/);
        await expect(section.getByRole("link", { name: "Open Image Resizer" })).toHaveAttribute("href", "/tool/image-resizer");
    });

    test("all 28 nodes remain reachable: the decision graph still has seven families", async ({ page }) => {
        await page.goto("/guide");
        const finder = page.locator("[data-guide-finder]");
        for (const family of ["Image", "PDF", "Text", "Converters", "Developer", "Math", "Time"]) await expect(finder.getByRole("button", { name: family, exact: true })).toBeVisible();
    });
});

test.describe("responsive layout and keyboard (320, 360, 390, 768, 1280)", () => {
    test("content pages have no horizontal overflow at every audited width", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "This test sets its own viewport widths");
        for (const width of WIDTH) {
            await page.setViewportSize({ width, height: 844 });
            for (const route of ["/privacy", "/contact", "/category/math", "/category/time", "/tool/image-resizer", "/tool/time-arithmetic", "/workflows/prepare-image-for-upload", "/guide"]) {
                await page.goto(route);
                expect(await noOverflow(page), `${route} at ${width}`).toBe(true);
            }
        }
    });
});

// ---------------------------------------------------------------------------------------------
test.describe("thirteen appearances: recommendation surface and content-state screenshots", () => {
    test.beforeEach(async ({}, info) => { test.skip(info.project.name !== "desktop-chromium", "The matrix sets its own desktop and mobile viewports"); });
    test.setTimeout(240_000);

    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: recommendation, tool panel and content states`, async ({ page }) => {
            await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
            await page.addInitScript(({ palette, mode }) => {
                localStorage.setItem("palette", JSON.stringify(palette));
                localStorage.setItem("theme", JSON.stringify(palette === "onedark" ? "onedark" : mode));
            }, { palette: appearance.palette, mode: appearance.mode });
            const withShots = FOCUS_APPEARANCE.includes(appearance.id);

            for (const viewport of VIEWPORT) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                const key = [appearance.id, viewport.id] as const;

                await openRecommendation(page);
                await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
                if (withShots) await shot(page, "guide-recommendation", ...key);
                await checkText(page, ...key, "guide recommendation surface", "[data-guide-recommendation] h2, [data-guide-recommendation] p, [data-guide-recommendation] a", 3);
                await page.goto("/guide");
                await page.locator("[data-guide-finder]").getByRole("button", { name: "Image", exact: true }).click();
                await checkText(page, ...key, "guide choice buttons", "[data-guide-choice]", 4);

                if (!withShots) continue;

                for (const category of ["math", "time"]) {
                    await page.goto(`/category/${category}`);
                    await shot(page, `${category}-category`, ...key);
                    await checkText(page, ...key, `${category} category text`, "main h1, main h1 + p, main a[href^='/tool/'] h3, main a[href^='/tool/'] p, #category-guidance-title, #category-guidance-title ~ p", 4);
                }

                await page.goto("/tool/image-resizer");
                await page.locator("main h2", { hasText: /^How to use$/ }).scrollIntoViewIfNeeded();
                await page.evaluate(() => window.scrollBy(0, -120));
                await shot(page, "tool-guide", ...key);
                await checkText(page, ...key, "tool guide prose", "[data-tool-guide] h2, [data-tool-guide] li, [data-tool-reference] h2, [data-tool-reference] h3, [data-tool-reference] p, [data-tool-related] h2", 6);

                await page.goto("/privacy");
                await page.getByRole("navigation", { name: "On this page" }).locator('a[href="#privacy-contact"]').focus();
                await page.keyboard.press("Enter");
                await expect(page.locator("#privacy-contact")).toBeFocused();
                await shot(page, "privacy-toc", ...key);
                await checkText(page, ...key, "privacy contents list", "nav[aria-label='On this page'] p, nav[aria-label='On this page'] a, #privacy-contact", 4);

                await page.goto("/contact");
                await shot(page, "contact", ...key);
                await checkText(page, ...key, "contact copy", "main h1, main header p, main section p, main label", 4);

                await page.goto("/tool/time-arithmetic");
                await page.getByLabel("Time A", { exact: true }).fill("1:5");
                await expect(page.locator("#time-a-error")).toBeVisible();
                await shot(page, "time-error", ...key);
                await checkText(page, ...key, "time field error", "#time-a-error, label[for='time-a']", 2);

                await page.goto("/tool/html-text-extractor");
                await page.getByRole("button", { name: "Convert", exact: true }).click();
                await expect(page.getByRole("alert").filter({ hasText: "Enter HTML to extract text." })).toBeVisible();
                await shot(page, "html-empty", ...key);
                await checkText(page, ...key, "html empty feedback", "[role='alert'].tool-feedback, label[for='html-input']", 2);

                await page.goto("/workflows/prepare-image-for-upload");
                await shot(page, "workflow-detail", ...key);
                await checkText(page, ...key, "workflow detail text", "main h1, main p", 2);
            }
        });
    }
});
