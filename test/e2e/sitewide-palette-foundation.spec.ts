import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/*
 * Prompt 3 palette foundation: thirteen resolved appearances, shared semantic roles, category identity,
 * contrast over actually composited backgrounds and the theme picker. Contrast helpers stay private to this file.
 * Optional evidence: P03_EVIDENCE_DIR receives contrast-matrix.json and appearance-token-matrix.json;
 * P03_SHOT_DIR receives screenshots named <route-id>__<appearance-id>__<viewport-id>.png and never overwrites one.
 */

type Rgb = [number, number, number];
type RouteId = "home" | "discover" | "category-document" | "tool-merge-pdf" | "theme-popover";
type ViewportId = "desktop1440x900" | "mobile390x844";

interface Appearance { id: string; palette: string; mode: "light" | "dark" | "system"; dark: boolean; }
interface ContrastRow {
    key: string; check: string; route: string; appearance: string; element: string; text: string;
    foreground: Rgb; background: Rgb; fontSizePx: number; fontWeight: number;
    ratio: number; threshold: number; large: boolean; pass: boolean;
}
interface Sample { text: string; element: string; foreground: Rgb; background: Rgb; fontSizePx: number; fontWeight: number; gradient: boolean; }

const PALETTE = ["original", "mineral", "oxblood", "signal", "cobalt", "amber"] as const;
const CATEGORY = ["document", "text", "math", "converter", "time", "image", "developer"] as const;
const APPEARANCE: Appearance[] = [
    ...PALETTE.flatMap(palette => [
        { id: `${palette}-light`, palette, mode: "light" as const, dark: false },
        { id: `${palette}-dark`, palette, mode: "dark" as const, dark: true },
    ]),
    { id: "onedark", palette: "onedark", mode: "system", dark: true },
];
const VIEWPORT: Record<ViewportId, { width: number; height: number }> = {
    desktop1440x900: { width: 1440, height: 900 },
    mobile390x844: { width: 390, height: 844 },
};
const SHOT_APPEARANCE = ["original-light", "original-dark", "onedark"];
const POPOVER_APPEARANCE = ["original-light", "mineral-light", "onedark"];
const WEAK_DARK_PAIR: [string, string][] = [["text", "math"], ["time", "developer"]];

const evidenceDir = process.env.P03_EVIDENCE_DIR;
const shotDir = process.env.P03_SHOT_DIR;

// ---- contrast arithmetic (WCAG 2.x), validated against elementary reference pairs below ----
function channel(value: number): number {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: Rgb): number { return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); }
function ratio(a: Rgb, b: Rgb): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
function distance(a: Rgb, b: Rgb): number { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function isLarge(fontSizePx: number, fontWeight: number): boolean { return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700); }

test("contrast arithmetic matches WCAG reference pairs", () => {
    expect.soft(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect.soft(ratio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    expect.soft(ratio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.478, 2);
    expect.soft(ratio([118, 118, 118], [255, 255, 255])).toBeGreaterThan(4.5);
    expect(isLarge(16, 600)).toBe(false);
    expect(isLarge(24, 400)).toBe(true);
    expect(isLarge(18.66, 700)).toBe(true);
});

// ---- browser helpers: colours resolved by the browser, backgrounds composited through every ancestor ----
async function resolveColor(page: Page, value: string): Promise<Rgb> {
    return page.evaluate(css => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = css;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b] as [number, number, number];
    }, value);
}
async function rootToken(page: Page, name: string): Promise<Rgb> {
    const value = await page.evaluate(token => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), name);
    expect(value, `${name} defined`).not.toBe("");
    return resolveColor(page, value);
}
async function sample(page: Page, selector: string, scope?: string): Promise<Sample[]> {
    return page.evaluate(({ css, within }) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const read = () => { const d = context.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]] as [number, number, number]; };
        const root = within ? document.querySelector(within) : document;
        if (!root) return [];
        const result: Sample[] = [];
        for (const el of Array.from(root.querySelectorAll<HTMLElement>(css))) {
            const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
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
            const background = read();
            const style = getComputedStyle(el);
            context.fillStyle = `rgb(${background.join(" ")})`;
            context.fillRect(0, 0, 1, 1);
            context.fillStyle = style.color;
            context.fillRect(0, 0, 1, 1);
            result.push({
                text: text.slice(0, 60), element: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`,
                foreground: read(), background, fontSizePx: parseFloat(style.fontSize), fontWeight: Number(style.fontWeight) || 400, gradient,
            });
        }
        return result;
    }, { css: selector, within: scope ?? null });
}

const contrastRows: ContrastRow[] = [];
async function checkText(page: Page, appearance: Appearance, check: string, route: string, selector: string, scope?: string, minimum = 1): Promise<void> {
    const found = await sample(page, selector, scope);
    expect(found.length, `${check}: ${selector} renders text on ${route} (${appearance.id})`).toBeGreaterThanOrEqual(minimum);
    for (const item of found) {
        expect(item.gradient, `${check}: no gradient backgrounds are measured as flat colours (${item.element})`).toBe(false);
        const large = isLarge(item.fontSizePx, item.fontWeight);
        const threshold = large ? 3 : 4.5;
        const value = ratio(item.foreground, item.background);
        const row: ContrastRow = {
            key: `${check}|${route}|${appearance.id}|${item.element}|${item.text}`, check, route, appearance: appearance.id, element: item.element, text: item.text,
            foreground: item.foreground, background: item.background, fontSizePx: item.fontSizePx, fontWeight: item.fontWeight,
            ratio: Math.round(value * 100) / 100, threshold, large, pass: value >= threshold,
        };
        contrastRows.push(row);
    }
    const failed = contrastRows.filter(row => row.check === check && row.appearance === appearance.id && row.route === route && !row.pass);
    expect.soft(failed.map(row => `${row.element} "${row.text}" ${row.ratio}<${row.threshold}`), `${check} contrast in ${appearance.id}`).toEqual([]);
}

function writeEvidence(file: string, rows: { key: string }[]): void {
    if (!evidenceDir) return;
    mkdirSync(evidenceDir, { recursive: true });
    const target = path.join(evidenceDir, file);
    const previous: { key: string }[] = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : [];
    const merged = new Map(previous.map(row => [row.key, row]));
    for (const row of rows) merged.set(row.key, row);
    writeFileSync(target, JSON.stringify([...merged.values()], null, 1));
}
test.afterEach(() => { writeEvidence("contrast-matrix.json", contrastRows); contrastRows.length = 0; });

async function applyAppearance(page: Page, appearance: Appearance, viewport: ViewportId = "desktop1440x900"): Promise<void> {
    await page.setViewportSize(VIEWPORT[viewport]);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(({ palette, mode }) => {
        localStorage.setItem("palette", JSON.stringify(palette));
        localStorage.setItem("theme", JSON.stringify(mode === "system" ? "onedark" : mode));
    }, { palette: appearance.palette, mode: appearance.mode });
}
async function open(page: Page, appearance: Appearance, route: string): Promise<void> {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
    await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.id === "onedark" ? "onedark" : appearance.mode);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}
async function shot(page: Page, route: RouteId, appearance: Appearance, viewport: ViewportId, fullPage: boolean): Promise<void> {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const file = path.join(shotDir, `${route}__${appearance.id}__${viewport}.png`);
    if (existsSync(file)) throw new Error(`Screenshot collision, refusing to overwrite ${file}`);
    await page.screenshot({ path: file, fullPage });
}

test.describe("thirteen appearances", () => {
    test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== "desktop-chromium", "Appearance matrix sets its own desktop and mobile viewports"); });
    test.setTimeout(120_000);

    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: roles, hierarchy, category identity and contrast`, async ({ page }) => {
            await applyAppearance(page, appearance);
            const tokenRows: Record<string, unknown>[] = [];

            // ---- Home: hero, boards, cards, chips ----
            await open(page, appearance, "/");
            expect(await page.locator('a[href^="/tool/"]').evaluateAll(list => new Set(list.map(a => a.getAttribute("href"))).size), "18 unique Home tools").toBe(18);
            const hero = await sample(page, "[data-home-hero] h1, [data-home-hero] p");
            expect(hero.length).toBeGreaterThan(0);
            await checkText(page, appearance, "home-hero", "/", "[data-home-hero] h1, [data-home-hero] p");
            await checkText(page, appearance, "home-card", "/", ".home-card h3, .home-card p, .home-card span");
            await checkText(page, appearance, "home-board-heading", "/", ".home-board h2, .home-board > div > p");
            await checkText(page, appearance, "home-chip", "/", ".home-chip");
            const heroBg = hero[0].background;
            const canvas = await rootToken(page, "--background");
            const panel = await rootToken(page, "--panel-bg");
            const support = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--home-support-panel-bg").trim());
            expect.soft(distance(await resolveColor(page, support), panel), "supporting panels start from --panel-bg, not the hero").toBeLessThan(2);
            if (!appearance.dark) expect.soft(distance(heroBg, [245, 165, 146]), "no fixed coral hero").toBeGreaterThan(30);

            const board: Record<string, { bg: Rgb; card: Rgb; border: Rgb; accent: Rgb }> = {};
            for (const id of CATEGORY) {
                const info = await page.evaluate(category => {
                    const section = document.querySelector<HTMLElement>(`[data-home-board="${category}"] .section-island`);
                    const card = document.querySelector<HTMLElement>(`[data-home-board="${category}"] .home-card`);
                    if (!section || !card) return null;
                    return { bg: getComputedStyle(section).backgroundColor, card: getComputedStyle(card).backgroundColor, border: getComputedStyle(card).borderTopColor,
                        accent: getComputedStyle(document.querySelector(`[data-home-board="${category}"]`)!).getPropertyValue("--category-color").trim() };
                }, id);
                expect(info, `Home board for ${id}`).not.toBeNull();
                board[id] = { bg: await resolveColor(page, info!.bg), card: await resolveColor(page, info!.card), border: await resolveColor(page, info!.border), accent: await resolveColor(page, info!.accent) };
                // One authoritative category accent: Home board computes the root role for this appearance.
                expect.soft(distance(board[id].accent, await rootToken(page, `--category-${id}`)), `${id} accent on Home`).toBeLessThan(2);
                const chip = await page.evaluate(category => {
                    const el = document.querySelector<HTMLElement>(`.home-chip[data-category="${category}"]`);
                    return el ? getComputedStyle(el).color : null;
                }, id);
                if (!appearance.dark) expect.soft(distance(await resolveColor(page, chip!), board[id].accent), `${id} chip colour is the canonical accent`).toBeLessThan(2);
                // Cards are a distinct tier with a visible boundary on their section.
                expect.soft(distance(board[id].card, board[id].bg), `${id} card separates from its section`).toBeGreaterThanOrEqual(appearance.dark ? 12 : 6);
                expect.soft(ratio(board[id].border, board[id].bg), `${id} card boundary against its section`).toBeGreaterThanOrEqual(1.5);
                tokenRows.push({ key: `${appearance.id}|board|${id}`, appearance: appearance.id, role: `home-board-${id}`, section: board[id].bg, card: board[id].card, cardBorder: board[id].border, categoryAccent: board[id].accent,
                    cardVsSectionRgbDistance: Math.round(distance(board[id].card, board[id].bg) * 10) / 10, cardBorderVsSectionContrast: Math.round(ratio(board[id].border, board[id].bg) * 100) / 100 });
            }
            if (appearance.dark) {
                for (const [a, b] of WEAK_DARK_PAIR) {
                    expect.soft(distance(board[a].accent, board[b].accent), `${a} vs ${b} dark identity accents stay apart`).toBeGreaterThanOrEqual(20);
                    for (const id of [a, b]) expect.soft(ratio(board[id].accent, board[id].bg), `${id} identity edge against its section`).toBeGreaterThanOrEqual(3);
                    tokenRows.push({ key: `${appearance.id}|pair|${a}-${b}`, appearance: appearance.id, role: `dark-pair-${a}-${b}`, rgbDistance: Math.round(distance(board[a].bg, board[b].bg) * 10) / 10 });
                }
            }
            const heroBorder = await rootToken(page, "--home-hero-border");
            tokenRows.push({ key: `${appearance.id}|roles`, appearance: appearance.id, role: "resolved-roles", canvas, panel, hero: heroBg, heroBorder, heroTextContrast: Math.round(ratio(hero[0].foreground, heroBg) * 100) / 100,
                accent: await rootToken(page, "--accent"), focusRing: await rootToken(page, "--focus-ring"), cardBg: await rootToken(page, "--card-bg"), inputBg: await rootToken(page, "--input-bg"), inputBorder: await rootToken(page, "--input-border"),
                success: await rootToken(page, "--success"), warning: await rootToken(page, "--warning"), danger: await rootToken(page, "--danger"),
                category: Object.fromEntries(await Promise.all(CATEGORY.map(async id => [id, await rootToken(page, `--category-${id}`)]))) });
            expect.soft(ratio(await rootToken(page, "--focus-ring"), panel), "focus ring against panel").toBeGreaterThanOrEqual(3);
            for (const id of CATEGORY) {
                const accent = await rootToken(page, `--category-${id}`);
                expect.soft(ratio(accent, panel), `--category-${id} as label text on --panel-bg`).toBeGreaterThanOrEqual(4.5);
                expect.soft(ratio(accent, await rootToken(page, "--card-bg")), `--category-${id} as label text on --card-bg`).toBeGreaterThanOrEqual(4.5);
            }
            expect.soft(ratio(await rootToken(page, "--input-border"), await rootToken(page, "--input-bg")), "input boundary").toBeGreaterThanOrEqual(3);
            await shot(page, "home", appearance, "desktop1440x900", true);

            // ---- Discover: result descriptions (AUD-040) and category links ----
            await open(page, appearance, "/discover");
            await checkText(page, appearance, "discover-result-description", "/discover", ".ds-results li a .mt-1", undefined, 18);
            await checkText(page, appearance, "discover-result-name", "/discover", ".ds-results li a .font-semibold");
            await checkText(page, appearance, "discover-result-category", "/discover", ".ds-results a > div > div:last-child");
            await checkText(page, appearance, "discover-category-card", "/discover", ".ds-card h3, .ds-card p");
            for (const id of CATEGORY) {
                const accent = await page.evaluate(category => getComputedStyle(document.querySelector(`a.ds-card[data-category="${category}"]`)!).getPropertyValue("--category-color").trim(), id);
                expect.soft(distance(await resolveColor(page, accent), await rootToken(page, `--category-${id}`)), `${id} accent on Discover`).toBeLessThan(2);
            }
            await shot(page, "discover", appearance, "desktop1440x900", true);

            // ---- Category route: guidance panel (AUD-041) and route-level category accent ----
            await open(page, appearance, "/category/document");
            await checkText(page, appearance, "category-guidance", "/category/document", "#category-guidance-title, #category-guidance-title ~ p, #category-guidance-title ~ ul li, #category-guidance-title ~ ul strong, #category-guidance-title ~ p strong", undefined, 4);
            const documentAccent = await page.evaluate(() => getComputedStyle(document.querySelector('[data-category="document"]')!).getPropertyValue("--category-color").trim());
            expect.soft(distance(await resolveColor(page, documentAccent), await rootToken(page, "--category-document")), "document accent on its category route").toBeLessThan(2);
            if (SHOT_APPEARANCE.includes(appearance.id)) {
                await shot(page, "category-document", appearance, "desktop1440x900", true);
                await page.setViewportSize(VIEWPORT.mobile390x844);
                await shot(page, "category-document", appearance, "mobile390x844", true);
                await page.setViewportSize(VIEWPORT.desktop1440x900);
            }

            // ---- Guide summary (AUD-041) ----
            await open(page, appearance, "/guide");
            await checkText(page, appearance, "guide-finder", "/guide", "[data-guide-finder] h2, [data-guide-finder] button", undefined, 3);

            // ---- PDF tool section labels (AUD-042): 16px semibold is normal text ----
            await open(page, appearance, "/tool/merge-pdf");
            await checkText(page, appearance, "pdf-section-label", "/tool/merge-pdf", "#merge-source-title", undefined, 1);
            const label = await page.evaluate(() => { const el = document.querySelector("#merge-source-title")!; const s = getComputedStyle(el); return { color: s.color, size: parseFloat(s.fontSize), weight: Number(s.fontWeight) }; });
            expect(label.size).toBeLessThan(18.66);
            expect.soft(distance(await resolveColor(page, label.color), await rootToken(page, "--category-document")), "tool label uses the canonical document accent").toBeLessThan(2);
            await checkText(page, appearance, "pdf-muted-text", "/tool/merge-pdf", "main p.text-text-muted");
            if (SHOT_APPEARANCE.includes(appearance.id)) {
                await shot(page, "tool-merge-pdf", appearance, "desktop1440x900", true);
                await page.setViewportSize(VIEWPORT.mobile390x844);
                await shot(page, "tool-merge-pdf", appearance, "mobile390x844", true);
            }

            // ---- Home on mobile, geometry smoke at 320, 390 and 1440 ----
            await page.setViewportSize(VIEWPORT.mobile390x844);
            await open(page, appearance, "/");
            const header = await page.locator("header").first().boundingBox();
            expect(header!.height, "collapsed mobile header").toBeLessThanOrEqual(72);
            await shot(page, "home", appearance, "mobile390x844", false);
            if (POPOVER_APPEARANCE.includes(appearance.id)) {
                await page.getByRole("button", { name: "Themes", exact: true }).click();
                await expect(page.getByRole("dialog", { name: "Appearance settings" })).toBeVisible();
                await shot(page, "theme-popover", appearance, "mobile390x844", false);
                await page.keyboard.press("Escape");
            }
            for (const width of [320, 390, 1440]) {
                await page.setViewportSize({ width, height: 800 });
                await page.goto("/");
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                expect(overflow, `no horizontal overflow at ${width}px in ${appearance.id}`).toBeLessThanOrEqual(0);
            }
            writeEvidence("appearance-token-matrix.json", tokenRows as { key: string }[]);
        });
    }
});

test("six light palettes own their hero and support roles and look different", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport comparison");
    const hero = new Map<string, Rgb>();
    for (const appearance of APPEARANCE.filter(item => !item.dark)) {
        await applyAppearance(page, appearance);
        await open(page, appearance, "/");

        const actual = (await sample(page, "[data-home-hero] h1"))[0].background;
        expect.soft(ratio((await sample(page, "[data-home-hero] h1"))[0].foreground, actual), `${appearance.id} hero title contrast`).toBeGreaterThanOrEqual(4.5);

        expect.soft(distance(actual, [245, 165, 146]), `${appearance.id} is not the fixed coral`).toBeGreaterThan(30);
        const support = await rootToken(page, "--home-support-panel-bg");
        expect.soft(distance(support, actual), `${appearance.id} support panel is not hero-tinted`).toBeGreaterThan(8);
        hero.set(appearance.id, actual);
    }
    const ids = [...hero.keys()];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        expect.soft(distance(hero.get(ids[i])!, hero.get(ids[j])!), `${ids[i]} vs ${ids[j]} hero`).toBeGreaterThanOrEqual(10);
    }
});

test("One Dark hero, active navigation and focus share the purple action family; severity stays separate", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport comparison");
    const oneDark = APPEARANCE.find(item => item.id === "onedark")!;
    await applyAppearance(page, oneDark);
    await open(page, oneDark, "/");
    const hue = ([r, g, b]: Rgb): number => {
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        if (d === 0) return 0;
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (h * 60 + 360) % 360;
    };
    const active = (await sample(page, "header a[aria-current=page]"))[0];
    expect(active, "active primary navigation item").toBeTruthy();
    const family = [(await sample(page, "[data-home-hero] h1"))[0].background, active.background, await rootToken(page, "--accent"), await rootToken(page, "--focus-ring")];
    for (const color of family) {
        expect(hue(color), `hue of ${color}`).toBeGreaterThanOrEqual(255);
        expect(hue(color), `hue of ${color}`).toBeLessThanOrEqual(320);
    }
    expect(ratio(active.foreground, active.background), "active navigation text").toBeGreaterThanOrEqual(4.5);
    for (const token of ["--success", "--warning", "--danger"]) {
        const value = await rootToken(page, token);
        expect(hue(value) < 255 || hue(value) > 320, `${token} is not purple`).toBe(true);
    }
});

test("switching appearance changes colours only: same elements and the same 18 tool links", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport comparison");
    const shape = new Set<string>();
    for (const appearance of APPEARANCE) {
        await applyAppearance(page, appearance);
        await open(page, appearance, "/");
        shape.add(await page.evaluate(() => JSON.stringify({
            elements: document.querySelectorAll("main *, header *").length,
            tool: Array.from(document.querySelectorAll('a[href^="/tool/"]')).map(a => a.getAttribute("href")),
        })));
    }
    expect(shape.size, "identical structure in all thirteen appearances").toBe(1);
});

test("category roles are defined once per appearance and no home-only category palette remains", async () => {
    const theme = readFileSync("src/style/theme.css", "utf8");
    const global = readFileSync("src/app/global.css", "utf8");
    for (const id of CATEGORY) {
        expect(theme.match(new RegExp(`--category-${id}:`, "g"))?.length, `${id} accent declared for light, system-dark, dark and One Dark`).toBe(4);
        expect(theme.match(new RegExp(`--category-${id}-soft:`, "g"))?.length, `${id} soft declared for light, system-dark, dark and One Dark`).toBe(4);
        expect(theme, `${id} has no home-only board colour`).not.toContain(`--home-board-${id}`);
        expect(theme, `${id} has no home-only ink colour`).not.toContain(`--home-ink-${id}`);
        expect(theme).toContain(`[data-category="${id}"] { --category-color: var(--category-${id});`);
    }
    expect(theme).not.toContain("--home-chip-bg");
    expect(theme).not.toContain("#f5a592");
    expect(global).not.toContain("--home-ink-");
    expect(global).not.toContain("--home-board-document");
});

test.describe("theme picker", () => {
    test("seven choices with hero, section and action swatches; Default is the original palette", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/");
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Appearance settings" });
        const palette = dialog.getByRole("group", { name: "Palette", exact: true });
        await expect(palette.getByRole("radio")).toHaveCount(7);
        await expect(dialog.getByRole("group", { name: "Color mode", exact: true }).getByRole("radio")).toHaveCount(3);
        await expect(palette.getByText("Violet & Graphite")).toBeVisible();
        await expect(palette.getByText("Default", { exact: true })).toHaveCount(1);
        await expect(palette.getByRole("radio", { name: "Violet & Graphite" })).toHaveAccessibleDescription("Default");
        const signature = new Set<string>();
        for (const label of await palette.locator("label").all()) {
            const swatch = label.locator("[data-palette-swatch]");
            await expect(swatch).toHaveAttribute("aria-hidden", "true");
            const part = await swatch.locator("[data-swatch-part]").evaluateAll(list => list.map(el => getComputedStyle(el).backgroundColor));
            expect(part).toHaveLength(3);
            expect(new Set(part).size, "hero, section and action differ inside one swatch").toBe(3);
            signature.add(part.join("|"));
            expect(((await label.innerText()).trim().length)).toBeGreaterThan(3);
        }
        expect(signature.size, "seven distinct swatches in Light").toBe(7);
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        await dialog.getByRole("radio", { name: "Dark", exact: true }).check();
        const dark = new Set<string>();
        for (const label of await palette.locator("label").all()) dark.add((await label.locator("[data-swatch-part]").evaluateAll(list => list.map(el => getComputedStyle(el).backgroundColor))).join("|"));
        expect(dark.size, "seven distinct swatches in Dark").toBe(7);
        expect([...dark].filter(value => signature.has(value)), "only the fixed One Dark swatch is shared by Light and Dark").toHaveLength(1);
    });

    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: selected swatch reads the live hero, section and action roles`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== "desktop-chromium", "Role comparison is viewport independent");
            await applyAppearance(page, appearance);
            await open(page, appearance, "/");
            await page.getByRole("button", { name: "Themes", exact: true }).click();
            const part = await page.locator(`[data-palette-swatch="${appearance.palette}"] [data-swatch-part]`).evaluateAll(list => list.map(el => getComputedStyle(el).backgroundColor));
            const [heroSwatch, sectionSwatch, actionSwatch] = await Promise.all(part.map(value => resolveColor(page, value)));
            const heroLive = (await sample(page, "[data-home-hero] h1"))[0].background;
            expect.soft(distance(heroSwatch, heroLive), "hero swatch equals the live hero").toBeLessThan(2);
            expect.soft(distance(sectionSwatch, await rootToken(page, "--panel-bg")), "section swatch equals --panel-bg").toBeLessThan(2);
            expect.soft(distance(actionSwatch, await rootToken(page, "--accent")), "action swatch equals --accent").toBeLessThan(2);
            await checkText(page, appearance, "picker-text", "/", '[role="dialog"] legend, [role="dialog"] label span, [role="dialog"] button');
        });
    }

    test("One Dark disables color mode with a visible reason and restores the mode on return", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/");
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Appearance settings" });
        const note = dialog.getByText("One Dark uses a fixed dark appearance; color mode does not apply.");
        await expect(note).toHaveCount(0);
        await dialog.getByRole("radio", { name: "Light", exact: true }).check();
        await dialog.getByRole("radio", { name: "Oxblood Atelier" }).check();
        await dialog.getByRole("radio", { name: "One Dark", exact: true }).check();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
        await expect(note).toBeVisible();
        for (const mode of ["System", "Light", "Dark"]) await expect(dialog.getByRole("radio", { name: mode, exact: true })).toBeDisabled();
        expect(await dialog.getByRole("radio", { name: "Dark", exact: true }).evaluate(el => (el as HTMLInputElement).disabled)).toBe(true);
        await dialog.getByRole("radio", { name: "Mineral Research" }).check();
        await expect(note).toHaveCount(0);
        await expect(dialog.getByRole("radio", { name: "Light", exact: true })).toBeEnabled();
        await expect(dialog.getByRole("radio", { name: "Light", exact: true })).toBeChecked();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(JSON.stringify("light"));
    });

    test("stays inside a 320px viewport and keeps Escape focus return", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "Themes", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Appearance settings" });
        await dialog.getByRole("radio", { name: "One Dark", exact: true }).check();
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
    });
});

// ---- One Dark keeps the retained ordinary mode across reloads (AUD-012) ----
const correctionDir = process.env.P03C_EVIDENCE_DIR;
const correctionShotDir = process.env.P03C_SHOT_DIR;
interface PersistenceState { palette: string | null; theme: string | null; dataPalette: string | undefined; dataTheme: string | undefined; preference: string | undefined; dark: boolean; }

async function persistenceState(page: Page): Promise<PersistenceState> {
    return page.evaluate(() => {
        const root = document.documentElement;
        return { palette: localStorage.getItem("palette"), theme: localStorage.getItem("theme"), dataPalette: root.dataset.palette, dataTheme: root.dataset.theme, preference: root.dataset.themePreference, dark: root.classList.contains("dark") };
    });
}
function recordPersistence(row: Record<string, unknown>): void {
    if (!correctionDir) return;
    mkdirSync(correctionDir, { recursive: true });
    const target = path.join(correctionDir, "persistence-state-matrix.json");
    const rows: Record<string, unknown>[] = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : [];
    const index = rows.findIndex(item => item.key === row.key);
    if (index >= 0) rows[index] = row; else rows.push(row);
    writeFileSync(target, JSON.stringify(rows, null, 1));
}
async function openPicker(page: Page) {
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance settings" });
    await expect(dialog).toBeVisible();
    return dialog;
}
const MODE_LABEL = { system: "System", light: "Light", dark: "Dark" } as const;

test.describe("One Dark retains the ordinary color mode", () => {
    test.setTimeout(90_000);
    for (const mode of ["system", "light", "dark"] as const) {
        test(`${mode}: select, reload twice, leave One Dark, reload twice`, async ({ page }, testInfo) => {
            const mobile = testInfo.project.name === "mobile-chromium";
            const viewport: ViewportId = mobile ? "mobile390x844" : "desktop1440x900";
            await page.setViewportSize(VIEWPORT[viewport]);
            await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
            const expectedOrdinary = mode === "light" ? "light" : "dark";
            const trace: Record<string, unknown> = {};
            await page.goto("/");
            let dialog = await openPicker(page);
            await dialog.getByRole("radio", { name: "Oxblood Atelier" }).check();
            await dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true }).check();
            trace.ordinary = await persistenceState(page);
            expect(trace.ordinary).toMatchObject({ palette: JSON.stringify("oxblood"), theme: JSON.stringify(mode), dataTheme: expectedOrdinary });

            await dialog.getByRole("radio", { name: "One Dark", exact: true }).check();
            trace.selected = await persistenceState(page);
            expect(trace.selected, "mode is retained, not overwritten, when One Dark is chosen").toMatchObject({ palette: JSON.stringify("onedark"), theme: JSON.stringify(mode), dataPalette: "onedark", dataTheme: "onedark", dark: true });
            for (const label of Object.values(MODE_LABEL)) await expect(dialog.getByRole("radio", { name: label, exact: true })).toBeDisabled();

            for (const pass of ["reload1", "reload2"]) {
                await page.reload();
                trace[pass] = await persistenceState(page);
                expect(trace[pass], `${pass}: fixed dark and the same stored mode`).toMatchObject({ palette: JSON.stringify("onedark"), theme: JSON.stringify(mode), dataPalette: "onedark", dataTheme: "onedark", dark: true });
                dialog = await openPicker(page);
                await expect(dialog.getByRole("radio", { name: "One Dark", exact: true })).toBeChecked();
                await expect(dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true })).toBeChecked();
                await expect(dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true })).toBeDisabled();
                await expect(dialog.getByText("One Dark uses a fixed dark appearance; color mode does not apply.")).toBeVisible();
                if (pass === "reload1" && correctionShotDir) {
                    mkdirSync(correctionShotDir, { recursive: true });
                    const file = path.join(correctionShotDir, `onedark-reload__${mode}__${viewport}.png`);
                    if (existsSync(file)) throw new Error(`Screenshot collision, refusing to overwrite ${file}`);
                    await page.screenshot({ path: file });
                }
                await page.keyboard.press("Escape");
            }

            dialog = await openPicker(page);
            await dialog.getByRole("radio", { name: "Cobalt & Terracotta" }).check();
            trace.left = await persistenceState(page);
            expect(trace.left, "ordinary palette restores the retained mode").toMatchObject({ palette: JSON.stringify("cobalt"), theme: JSON.stringify(mode), dataPalette: "cobalt", dataTheme: expectedOrdinary });
            await expect(dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true })).toBeChecked();
            await expect(dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true })).toBeEnabled();
            for (const pass of ["leftReload1", "leftReload2"]) {
                await page.reload();
                trace[pass] = await persistenceState(page);
                expect(trace[pass]).toMatchObject({ palette: JSON.stringify("cobalt"), theme: JSON.stringify(mode), dataTheme: expectedOrdinary });
                if (mode === "system") expect(trace[pass]).toMatchObject({ preference: "system" });
                dialog = await openPicker(page);
                await expect(dialog.getByRole("radio", { name: MODE_LABEL[mode], exact: true })).toBeChecked();
                await page.keyboard.press("Escape");
            }
            recordPersistence({ key: `${testInfo.project.name}|${mode}`, project: testInfo.project.name, viewport, mode, osColorScheme: "dark", ...trace });
        });
    }

    test("fixed dark before hydration for every retained mode and for legacy bytes", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        const cases: [string | null, string | null][] = [["onedark", "system"], ["onedark", "light"], ["onedark", "dark"], [null, "onedark"], ["amber", "onedark"]];
        for (const [palette, theme] of cases) {
            const fresh = await page.context().newPage();
            await fresh.route("**/_next/**/*.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
            await fresh.addInitScript(([p, t]) => {
                localStorage.clear();
                if (p) localStorage.setItem("palette", JSON.stringify(p));
                if (t) localStorage.setItem("theme", JSON.stringify(t));
            }, [palette, theme]);
            await fresh.goto("/", { waitUntil: "domcontentloaded" });
            const state = await persistenceState(fresh);
            expect(state, `pre-paint ${palette}/${theme}`).toMatchObject({ dataPalette: "onedark", dataTheme: "onedark", dark: true });
            recordPersistence({ key: `prepaint|${palette}|${theme}`, kind: "prepaint-js-blocked", osColorScheme: "light", storedPalette: palette, storedTheme: theme, ...state });
            await fresh.close();
        }
    });

    test("legacy theme onedark renders after hydration and an ordinary choice falls back to dark", async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.addInitScript(() => {
            if (sessionStorage.getItem("seeded")) return;
            sessionStorage.setItem("seeded", "1");
            localStorage.clear();
            localStorage.setItem("theme", JSON.stringify("onedark"));
        });
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
        const dialog = await openPicker(page);
        await expect(dialog.getByRole("radio", { name: "One Dark", exact: true })).toBeChecked();
        await expect(dialog.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
        await expect(dialog.getByRole("radio", { name: "Dark", exact: true })).toBeDisabled();
        await dialog.getByRole("radio", { name: "Mineral Research" }).check();
        const state = await persistenceState(page);
        expect(state).toMatchObject({ palette: JSON.stringify("mineral"), theme: JSON.stringify("dark"), dataTheme: "dark" });
        recordPersistence({ key: `${testInfo.project.name}|legacy`, project: testInfo.project.name, kind: "legacy-theme-onedark", osColorScheme: "light", afterOrdinaryChoice: state });
    });

    test("invalid and absent storage keep the conservative fallbacks", async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.addInitScript(() => { localStorage.setItem("palette", "{bad"); localStorage.setItem("theme", JSON.stringify(42)); });
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-palette", "original");
        await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        recordPersistence({ key: `${testInfo.project.name}|invalid`, project: testInfo.project.name, kind: "invalid-storage", state: await persistenceState(page) });
    });

    test("System follows the OS on an ordinary palette; One Dark is unaffected; leaving it follows the OS again", async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/");
        const dialog = await openPicker(page);
        await dialog.getByRole("radio", { name: "Signal Green" }).check();
        await dialog.getByRole("radio", { name: "System", exact: true }).check();
        const root = page.locator("html");
        await expect(root).toHaveAttribute("data-theme", "light");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(root).toHaveAttribute("data-theme", "dark");
        await dialog.getByRole("radio", { name: "One Dark", exact: true }).check();
        await page.emulateMedia({ colorScheme: "light" });
        await expect(root).toHaveAttribute("data-theme", "onedark");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(root).toHaveAttribute("data-theme", "onedark");
        await page.emulateMedia({ colorScheme: "light" });
        await dialog.getByRole("radio", { name: "Signal Green" }).check();
        await expect(root).toHaveAttribute("data-theme", "light");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(root).toHaveAttribute("data-theme", "dark");
        recordPersistence({ key: `${testInfo.project.name}|os-change`, project: testInfo.project.name, kind: "system-live-follow", finalState: await persistenceState(page) });
    });
});
