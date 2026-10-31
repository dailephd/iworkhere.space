import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/*
 * Prompt 8V: seven art-directed palette families over thirteen resolved appearances.
 * Evidence capture is opt-in: P08V_EVIDENCE_DIR names the one authorised evidence directory and
 * P08V_PHASE (baseline | final) selects the matrix; without both, only the behavioural contracts below run.
 */

interface Appearance { id: string; palette: string; mode: "light" | "dark" | "onedark"; }
interface Viewport { id: string; width: number; height: number; fullPage: boolean; }

const PALETTE = ["original", "mineral", "oxblood", "signal", "cobalt", "amber"] as const;
const APPEARANCE: Appearance[] = [
    ...PALETTE.flatMap(palette => [
        { id: `${palette}-light`, palette, mode: "light" as const },
        { id: `${palette}-dark`, palette, mode: "dark" as const },
    ]),
    { id: "onedark", palette: "onedark", mode: "onedark" },
];
const MATRIX_ROUTE = [
    { id: "home", path: "/" },
    { id: "discover", path: "/discover" },
    { id: "guide", path: "/guide" },
    { id: "tool-merge-pdf", path: "/tool/merge-pdf" },
    { id: "workflow-prepare-image", path: "/workflows/prepare-image-for-upload" },
    { id: "category-image", path: "/category/image" },
];
const VIEWPORT: Viewport[] = [
    { id: "desktop1440x900", width: 1440, height: 900, fullPage: true },
    { id: "tablet768x1024", width: 768, height: 1024, fullPage: true },
    { id: "mobile390x844", width: 390, height: 844, fullPage: false },
];
const PERF_ROUTE = ["/", "/discover", "/tool/merge-pdf", "/workflows/prepare-image-for-upload"];

const evidenceDir = process.env.P08V_EVIDENCE_DIR;
const phase = process.env.P08V_PHASE;
const onlyAppearance = process.env.P08V_ONLY_APPEARANCE?.split(",");
const onlyRoute = process.env.P08V_ONLY_ROUTE?.split(",");
const onlyViewport = process.env.P08V_ONLY_VIEWPORT?.split(",");

async function applyAppearance(page: Page, appearance: Appearance): Promise<void> {
    await page.addInitScript(({ palette, mode }) => {
        localStorage.setItem("palette", JSON.stringify(palette));
        localStorage.setItem("theme", JSON.stringify(mode));
    }, { palette: appearance.palette, mode: appearance.mode });
}

async function openRoute(page: Page, appearance: Appearance, route: string): Promise<void> {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
    await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.mode);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().filter(item => item.timeline === document.timeline).map(item => item.finished.catch(() => undefined))));
}

test("category section indicator follows route independently of disclosure", async ({ page }) => {
    for (const appearance of APPEARANCE.filter(item => item.palette === "mineral" || item.palette === "oxblood")) {
        await applyAppearance(page, appearance);
        for (const viewport of VIEWPORT) {
            await page.setViewportSize(viewport);
            await openRoute(page, appearance, "/category/image");
            const trigger = page.locator("[data-category-button]");
            await expect(trigger).toHaveAttribute("data-current-section", "true");
            await expect(trigger).toHaveAttribute("aria-expanded", "false");
            if (viewport.width >= 1024) {
                await expect(trigger).toHaveCSS("box-shadow", /inset/);
                await trigger.focus();
                await expect(trigger).toBeFocused();
                await trigger.click();
                await expect(trigger).toHaveAttribute("aria-expanded", "true");
                await expect(trigger).toHaveAttribute("data-current-section", "true");
            } else {
                await page.getByRole("button", { name: "Menu" }).click();
                await expect(page.locator('[data-category-nav] a[aria-current="page"]')).toBeVisible();
            }
            for (const route of ["/", "/discover", "/tool/merge-pdf", "/guide"]) {
                await openRoute(page, appearance, route);
                await expect(trigger).not.toHaveAttribute("data-current-section", "true");
            }
        }
    }
});

if (evidenceDir && (phase === "baseline" || phase === "final")) {
    const shotDir = path.join(evidenceDir, phase);
    test.describe(`${phase} screenshot matrix`, () => {
        test.setTimeout(240_000);
        for (const appearance of APPEARANCE.filter(item => !onlyAppearance || onlyAppearance.includes(item.id))) {
            test(`${appearance.id}: 6 routes at 3 viewports`, async ({ page }, testInfo) => {
                test.skip(testInfo.project.name !== "desktop-chromium", "The matrix sets its own viewports");
                mkdirSync(shotDir, { recursive: true });
                await applyAppearance(page, appearance);
                for (const viewport of VIEWPORT.filter(item => !onlyViewport || onlyViewport.includes(item.id))) {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height });
                    for (const route of MATRIX_ROUTE.filter(item => !onlyRoute || onlyRoute.includes(item.id))) {
                        await openRoute(page, appearance, route.path);
                        const file = path.join(shotDir, `${route.id}__${appearance.id}__${viewport.id}.png`);
                        await page.screenshot({ path: file, fullPage: viewport.fullPage, animations: "disabled" });
                    }
                }
            });
        }
    });

    test(`${phase} performance samples`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium", "The sample sets its own viewports");
        test.setTimeout(240_000);
        const target = path.join(evidenceDir, "performance-and-assets.txt");
        for (const viewport of [VIEWPORT[0], VIEWPORT[2]]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            for (const route of PERF_ROUTE) {
                for (const motion of ["no-preference", "reduce"] as const) {
                    await page.emulateMedia({ reducedMotion: motion });
                    await page.goto(route, { waitUntil: "load" });
                    await page.waitForLoadState("networkidle");
                    const sample = await page.evaluate(async () => {
                        const longTask: number[] = [];
                        let cls = 0;
                        new PerformanceObserver(list => { for (const entry of list.getEntries()) longTask.push(Math.round(entry.duration)); }).observe({ type: "longtask", buffered: true });
                        new PerformanceObserver(list => { for (const entry of list.getEntries()) cls += (entry as PerformanceEntry & { value: number }).value; }).observe({ type: "layout-shift", buffered: true });
                        await new Promise(resolve => setTimeout(resolve, 400));
                        const resource = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
                        const paint = performance.getEntriesByName("first-contentful-paint")[0];
                        return {
                            fcpMs: paint ? Math.round(paint.startTime) : null,
                            longTaskMs: longTask, cls: Math.round(cls * 1000) / 1000,
                            cssBytes: resource.filter(item => item.name.endsWith(".css")).reduce((sum, item) => sum + item.decodedBodySize, 0),
                            jsBytes: resource.filter(item => item.name.includes(".js")).reduce((sum, item) => sum + item.decodedBodySize, 0),
                            resourceCount: resource.length,
                            runningAnimation: document.getAnimations().filter(item => item.playState === "running").length,
                        };
                    });
                    appendFileSync(target, `${JSON.stringify({ phase, viewport: viewport.id, route, motion, ...sample })}\n`);
                }
            }
        }
    });
}

// ---- contrast over actually composited pixels: text is hidden, the page is photographed, and each glyph box is sampled for its worst point ----
interface ContrastRow { role: string; text: string; color: string; ratio: number; threshold: number; pass: boolean; disabled: boolean; }

async function measureComposited(page: Page): Promise<ContrastRow[]> {
    const items = await page.evaluate(() => {
        const out: { role: string; text: string; color: string; size: number; weight: number; disabled: boolean; rects: number[][]; boundary?: boolean }[] = [];
        const visible = (el: Element) => { const s = getComputedStyle(el); return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
        const roleOf = (el: Element) => el.closest("[data-site-header]") ? "header" : el.closest("[data-site-footer]") ? "footer" : el.closest("[data-home-hero]") ? "hero"
            : el.closest(".home-card, .ds-card") ? "card" : el.closest(".tool-result, .tool-preview, .tool-feedback") ? "result" : el.closest(".tool-work, .section-island, .ds-section") ? "panel" : "canvas";
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;
            const text = (node.textContent ?? "").trim();
            if (!parent || !text || parent.closest("script, style, noscript, option, .sr-only") || !visible(parent)) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1).map(r => [r.x + scrollX, r.y + scrollY, r.width, r.height]);
            if (!rects.length) continue;
            const s = getComputedStyle(parent);
            out.push({ role: roleOf(parent), text: text.slice(0, 40), color: s.color, size: parseFloat(s.fontSize), weight: Number(s.fontWeight) || 400, disabled: Boolean(parent.closest(":disabled")), rects });
        }
        for (const el of document.querySelectorAll<HTMLElement>("input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea, .tool-action-secondary")) {
            const r = el.getBoundingClientRect();
            if (!visible(el) || r.width < 2) continue;
            // Sampled just outside the control, so the ratio is border against what actually surrounds it.
            out.push({ role: "boundary", text: el.id || el.tagName, color: getComputedStyle(el).borderTopColor, size: 16, weight: 400, disabled: (el as HTMLInputElement).disabled === true, boundary: true,
                rects: [[r.x + scrollX - 3, r.y + scrollY + r.height / 2, 1, 1], [r.x + scrollX + r.width / 2, r.y + scrollY - 3, 1, 1]] });
        }
        return out;
    });
    const hide = await page.addStyleTag({ content: "*, *::before, *::after, ::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }" });
    const png = await page.screenshot({ fullPage: true, animations: "disabled" });
    await hide.evaluate(node => (node as unknown as HTMLElement).remove());
    return page.evaluate(async ({ base64, items: list }) => {
        const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(bitmap, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const parse = (color: string, back: number[]) => {
            swatch.clearRect(0, 0, 1, 1); swatch.fillStyle = color; swatch.fillRect(0, 0, 1, 1);
            const d = swatch.getImageData(0, 0, 1, 1).data, a = d[3] / 255;
            return [0, 1, 2].map(i => d[i] * a + back[i] * (1 - a));
        };
        const lum = (c: number[]) => c.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        return list.map(item => {
            let worst = Infinity;
            for (const [x, y, w, h] of item.rects) {
                for (let i = 0; i < Math.max(1, Math.min(10, Math.ceil(w / 14))); i++) for (let j = 0; j < 3; j++) {
                    const px = Math.min(canvas.width - 1, Math.max(0, Math.round(x + (w * (i + 0.5)) / Math.max(1, Math.min(10, Math.ceil(w / 14))))));
                    const py = Math.min(canvas.height - 1, Math.max(0, Math.round(y + (h * (j + 0.5)) / 3)));
                    const at = (py * canvas.width + px) * 4;
                    const back = [data[at], data[at + 1], data[at + 2]];
                    worst = Math.min(worst, ratio(parse(item.color, back), back));
                }
            }
            const large = item.size >= 24 || (item.size >= 18.66 && item.weight >= 700);
            const threshold = item.boundary ? 3 : large ? 3 : 4.5;
            return { role: item.role, text: item.text, color: item.color, ratio: Math.round(worst * 100) / 100, threshold, pass: item.disabled || worst >= threshold, disabled: item.disabled };
        });
    }, { base64: png.toString("base64"), items });
}

const MEASURED_ROUTE = ["/", "/tool/merge-pdf"];
test.describe("composited contrast contract", () => {
    test.setTimeout(240_000);
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: every glyph and control boundary clears its threshold over real pixels`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== "desktop-chromium", "The matrix sets its own viewports");
            await page.emulateMedia({ reducedMotion: "reduce" });
            await applyAppearance(page, appearance);
            const failures: string[] = [];
            const summary: Record<string, unknown>[] = [];
            const routes = evidenceDir && phase === "final" ? MATRIX_ROUTE.map(item => item.path) : MEASURED_ROUTE;
            const sizes = evidenceDir && phase === "final" ? VIEWPORT : [VIEWPORT[0], VIEWPORT[2]];
            for (const viewport of sizes) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                for (const route of routes) {
                    await openRoute(page, appearance, route);
                    const rows = await measureComposited(page);
                    expect(rows.length, `${route} measured text`).toBeGreaterThan(5);
                    for (const row of rows) if (!row.pass) failures.push(`${viewport.id} ${route} ${row.role} "${row.text}" ${row.ratio}<${row.threshold}`);
                    const byRole = new Map<string, number>();
                    for (const row of rows) if (!row.disabled) byRole.set(row.role, Math.min(byRole.get(row.role) ?? Infinity, row.ratio));
                    summary.push({ appearance: appearance.id, viewport: viewport.id, route, measured: rows.length, failed: rows.filter(row => !row.pass).length, minimumByRole: Object.fromEntries(byRole) });
                }
            }
            if (evidenceDir && phase === "final") appendFileSync(path.join(evidenceDir, "contrast-measurements.json"), summary.map(row => JSON.stringify(row)).join("\n") + "\n");
            expect(failures).toEqual([]);
        });
    }
});

// ---- identity, persistence, motion and chrome contracts ----
async function familySignature(page: Page) {
    return page.evaluate(() => {
        const card = getComputedStyle(document.querySelector(".home-card")!);
        const h1 = getComputedStyle(document.querySelector("main h1")!);
        const canvas = getComputedStyle(document.querySelector("div.bg-background")!, "::before");
        const hero = getComputedStyle(document.querySelector(".home-hero")!, "::after");
        const root = getComputedStyle(document.documentElement);
        return {
            typography: `${h1.fontFamily}|${h1.fontWeight}|${h1.textTransform}`,
            shape: `${card.borderTopRightRadius}|${card.borderBottomLeftRadius}|${card.borderTopWidth}`,
            depth: card.boxShadow.replace(/rgba?\([^)]*\)/g, "c"),
            motif: `${canvas.backgroundImage.replace(/rgba?\([^)]*\)|#[0-9a-f]+/gi, "c").slice(0, 60)}|${hero.backgroundImage.replace(/rgba?\([^)]*\)|#[0-9a-f]+/gi, "c").slice(0, 60)}|${hero.content}`,
            motion: `${root.getPropertyValue("--art-motion-medium").trim()}|${root.getPropertyValue("--art-ease").trim()}|${root.getPropertyValue("--art-hover-lift").trim()}`,
        };
    });
}

test.describe("family identity", () => {
    test("any two palette families differ on at least three non-hue axes; light and dark of one family keep typography, shape and motion", async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium", "Computed styles are viewport independent at this width");
        test.setTimeout(120_000);
        const signature = new Map<string, Awaited<ReturnType<typeof familySignature>>>();
        for (const appearance of APPEARANCE) {
            await page.evaluate(() => localStorage.clear()).catch(() => undefined);
            await page.addInitScript(({ palette, mode }) => { localStorage.setItem("palette", JSON.stringify(palette)); localStorage.setItem("theme", JSON.stringify(mode)); }, { palette: appearance.palette, mode: appearance.mode });
            await openRoute(page, appearance, "/");
            signature.set(appearance.id, await familySignature(page));
        }
        for (const palette of PALETTE) {
            const light = signature.get(`${palette}-light`)!, dark = signature.get(`${palette}-dark`)!;
            for (const axis of ["typography", "shape", "motion"] as const) expect(dark[axis], `${palette} ${axis}`).toBe(light[axis]);
        }
        const family = [...PALETTE.map(palette => `${palette}-light`), "onedark"];
        for (let i = 0; i < family.length; i++) for (let j = i + 1; j < family.length; j++) {
            const a = signature.get(family[i])!, b = signature.get(family[j])!;
            const differing = (Object.keys(a) as (keyof typeof a)[]).filter(axis => a[axis] !== b[axis]);
            expect(differing.length, `${family[i]} vs ${family[j]}: ${differing.join(", ")}`).toBeGreaterThanOrEqual(3);
        }
    });

    test("selection persists in session and after reload for light, dark, system and fixed One Dark", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "Themes", exact: true });
        const root = page.locator("html");
        await trigger.click();
        await page.getByRole("radio", { name: "Signal Green", exact: true }).check();
        await page.getByRole("radio", { name: "Dark", exact: true }).check();
        await expect(root).toHaveAttribute("data-palette", "signal");
        await expect(root).toHaveAttribute("data-theme", "dark");
        await page.keyboard.press("Escape");
        await page.reload();
        await expect(root).toHaveAttribute("data-theme", "dark");
        await expect(trigger).toBeEnabled();
        await trigger.click();
        await page.getByRole("radio", { name: "System", exact: true }).check();
        await expect(root).toHaveAttribute("data-theme", "light");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(root).toHaveAttribute("data-theme", "dark");
        await page.getByRole("radio", { name: "One Dark", exact: true }).check();
        await expect(root).toHaveAttribute("data-theme", "onedark");
        await page.keyboard.press("Escape");
        await page.reload();
        await expect(root).toHaveAttribute("data-palette", "onedark");
        await expect(root).toHaveAttribute("data-theme", "onedark");
    });
});

test.describe("chrome and motion", () => {
    test.setTimeout(180_000);
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: opening the theme picker never hides the hero`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== "desktop-chromium", "The picker overlay is checked once");
            await applyAppearance(page, appearance);
            await openRoute(page, appearance, "/");
            await page.getByRole("button", { name: "Themes", exact: true }).click();
            await expect(page.getByRole("dialog", { name: "Appearance settings" })).toBeVisible();
            const report = () => page.evaluate(() => {
                const hero = document.querySelector<HTMLElement>(".home-hero")!;
                const box = hero.getBoundingClientRect();
                return {
                    opacity: getComputedStyle(hero).opacity, width: box.width, height: box.height,
                    animation: hero.getAnimations().map(item => `${item instanceof CSSAnimation ? item.animationName : "transition"}:${item.playState}:${item.currentTime}`),
                };
            });
            const early = await report();
            await page.waitForTimeout(900);
            const settled = await report();
            expect(settled.opacity, `hero settled, early=${JSON.stringify(early)} settled=${JSON.stringify(settled)}`).toBe("1");
            expect(settled.height).toBeGreaterThan(40);
        });
    }
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: header controls stay on screen at narrow widths and decoration never takes input`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== "desktop-chromium", "The check sets its own viewports");
            await applyAppearance(page, appearance);
            for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
                await page.setViewportSize({ width, height: 800 });
                await openRoute(page, appearance, "/");
                const box = await page.getByRole("button", { name: "Themes", exact: true }).boundingBox();
                const header = await page.locator("[data-site-header]").boundingBox();
                expect(box!.x + box!.width, `Themes on screen at ${width}`).toBeLessThanOrEqual(width);
                expect(header!.height, `collapsed header at ${width}`).toBeLessThanOrEqual(72);
                expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `no overflow at ${width}`).toBeLessThanOrEqual(0);
            }
            const decoration = await page.evaluate(() => [
                ["div.bg-background", "::before"], [".home-hero", "::before"], [".home-hero", "::after"], [".home-card", "::before"], [".home-card", "::after"], [".section-island", "::after"], ["[data-site-header]", "::after"],
            ].map(([selector, pseudo]) => getComputedStyle(document.querySelector(selector)!, pseudo).pointerEvents));
            expect(new Set(decoration)).toEqual(new Set(["none"]));
        });

        test(`${appearance.id}: reduced motion stops everything; hover and focus never move layout`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== "desktop-chromium", "Pointer hover is a desktop interaction");
            await applyAppearance(page, appearance);
            await page.emulateMedia({ reducedMotion: "reduce" });
            await openRoute(page, appearance, "/");
            expect(await page.evaluate(() => document.getAnimations().length), "no animation under reduced motion").toBe(0);
            const card = page.locator(".home-card").first();
            // Document coordinates: hovering a card below the fold scrolls it into view, which is not a layout move.
            const documentBox = () => card.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }; });
            const before = await documentBox();
            await card.hover();
            expect(await card.evaluate(element => getComputedStyle(element).transform)).toBe("none");
            expect(await documentBox()).toEqual(before);
            await page.emulateMedia({ reducedMotion: "no-preference" });
            await page.reload();
            await expect(card).toBeVisible();
            await page.evaluate(() => Promise.all(document.getAnimations().filter(item => item.timeline === document.timeline).map(item => item.finished.catch(() => undefined))));
            const rest = await card.boundingBox();
            await card.hover();
            await page.waitForTimeout(500);
            const hovered = await card.boundingBox();
            expect(hovered!.width, "hover does not resize the card").toBeCloseTo(rest!.width, 3);
            expect(hovered!.height, "hover does not resize the card").toBeCloseTo(rest!.height, 3);
            await card.focus();
            expect(await card.evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
            expect(await card.evaluate(element => getComputedStyle(element).boxShadow), "focus ring survives depth treatment").toContain("6px");
        });
    }
});

test("all 36 canonical routes load with landmarks, no overflow and unobstructed controls", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The sweep sets its own viewports");
    test.setTimeout(420_000);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const routes = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)].map(match => match[1] || "/");
    expect(new Set(routes).size).toBe(36);
    const sweep: string[] = [];
    for (const [index, route] of routes.entries()) {
        const appearance = APPEARANCE[index % APPEARANCE.length];
        await page.addInitScript(({ palette, mode }) => { localStorage.setItem("palette", JSON.stringify(palette)); localStorage.setItem("theme", JSON.stringify(mode)); }, { palette: appearance.palette, mode: appearance.mode });
        for (const viewport of [VIEWPORT[0], VIEWPORT[2]]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.emulateMedia({ reducedMotion: "reduce" });
            const response = await page.goto(route);
            expect(response?.status(), route).toBe(200);
            await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
            const facts = await page.evaluate(() => {
                const blocked: string[] = [];
                for (const control of document.querySelectorAll<HTMLElement>("main a, main button, main input, main select, main textarea")) {
                    const r = control.getBoundingClientRect();
                    if (r.width < 2 || r.height < 2 || r.top < 80 || r.bottom > innerHeight || getComputedStyle(control).visibility === "hidden") continue;
                    if ((control as HTMLInputElement).type === "file" || (control as HTMLInputElement).type === "hidden") continue;
                    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    if (hit && !control.contains(hit) && !hit.contains(control) && !hit.closest("label")) blocked.push(`${control.tagName}:${(control.textContent ?? "").slice(0, 24)} under ${hit.tagName}.${String(hit.className).slice(0, 24)}`);
                }
                return { header: !!document.querySelector("header[data-site-header]"), main: !!document.querySelector("main#main-content"), footer: !!document.querySelector("footer"), h1: document.querySelectorAll("main h1").length, overflow: document.documentElement.scrollWidth - innerWidth, blocked };
            });
            expect(facts.header && facts.main && facts.footer, `${route} landmarks`).toBe(true);
            expect(facts.h1, `${route} single h1`).toBe(1);
            expect(facts.overflow, `${route} ${viewport.id} overflow`).toBeLessThanOrEqual(0);
            expect(facts.blocked, `${route} ${viewport.id} obstructed controls`).toEqual([]);
            sweep.push(`${route} ${viewport.id} ${appearance.id} ok`);
        }
    }
    if (evidenceDir && phase === "final") appendFileSync(path.join(evidenceDir, "motion-and-accessibility.txt"), `ROUTE SWEEP (${sweep.length} checks)\n${sweep.join("\n")}\n`);
});

// ---- final-only evidence: 32 additional mobile routes in two contrasting appearances, plus interaction states ----
if (evidenceDir && phase === "final") {
    const TOOL_SLUG = ["merge-pdf", "split-pdf", "images-to-pdf", "pdf-to-image", "compress-pdf", "slugify", "calculator", "length-converter", "html-text-extractor", "weight-converter", "time-arithmetic", "image-resizer", "image-compressor", "image-converter", "heic-converter", "json-formatter", "word-character-counter", "qr-code-generator"];
    const WORKFLOW_SLUG = ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"];
    const CATEGORY_ID = ["document", "text", "math", "converter", "time", "image", "developer"];
    const EXTRA_ROUTE = [
        ...TOOL_SLUG.map(slug => ({ id: `tool-${slug}`, path: `/tool/${slug}` })),
        ...WORKFLOW_SLUG.map(slug => ({ id: `workflow-${slug}`, path: `/workflows/${slug}` })),
        ...CATEGORY_ID.map(id => ({ id: `category-${id}`, path: `/category/${id}` })),
        { id: "about", path: "/about" }, { id: "contact", path: "/contact" }, { id: "privacy", path: "/privacy" },
    ];
    const LIGHT = APPEARANCE.filter(item => item.mode === "light");
    const DARK = APPEARANCE.filter(item => item.mode !== "light");

    test("extra routes: native mobile in two contrasting appearances", async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium", "The capture sets its own viewport");
        test.setTimeout(420_000);
        await page.setViewportSize({ width: VIEWPORT[2].width, height: VIEWPORT[2].height });
        for (const [index, route] of EXTRA_ROUTE.entries()) {
            for (const appearance of [LIGHT[index % LIGHT.length], DARK[(index + 3) % DARK.length]]) {
                const context = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
                const one = await context.newPage();
                await applyAppearance(one, appearance);
                await openRoute(one, appearance, route.path);
                await one.screenshot({ path: path.join(evidenceDir, "final", `extra-${route.id}__${appearance.id}__mobile390x844.png`), animations: "disabled" });
                await context.close();
            }
        }
    });

    test.describe("interaction states", () => {
        test.setTimeout(180_000);
        const stateDir = path.join(evidenceDir, "states");
        const shot = async (page: Page, name: string, appearance: Appearance) => {
            // Entrance fades must be complete, or a result panel can be photographed part-way through.
            await page.evaluate(() => Promise.all(document.getAnimations().filter(item => item.timeline === document.timeline && item.playState === "running").map(item => item.finished.catch(() => undefined))));
            await page.screenshot({ path: path.join(stateDir, `${name}__${appearance.id}.png`), animations: "disabled" });
        };
        for (const appearance of APPEARANCE) {
            test(`${appearance.id}: states`, async ({ page }, testInfo) => {
                test.skip(testInfo.project.name !== "desktop-chromium", "The capture sets its own viewports");
                mkdirSync(stateDir, { recursive: true });
                await applyAppearance(page, appearance);
                await page.setViewportSize({ width: 1440, height: 900 });
                await openRoute(page, appearance, "/");
                await page.getByRole("button", { name: "Themes", exact: true }).click();
                await expect(page.getByRole("dialog", { name: "Appearance settings" })).toBeVisible();
                await shot(page, "theme-popover", appearance);
                await page.keyboard.press("Escape");
                await page.locator("#tool-search").focus();
                await page.keyboard.type("resize image");
                await shot(page, "search-focused-results", appearance);
                await page.locator("#tool-search").fill("");
                await page.locator(".home-card").nth(3).hover();
                await page.waitForTimeout(500);
                await shot(page, "card-hover", appearance);
                await openRoute(page, appearance, "/tool/image-resizer");
                await page.getByLabel("Choose image", { exact: true }).setInputFiles(path.resolve("test/fixtures/images/resizer-source.jpg"));
                await page.getByLabel("Width", { exact: true }).fill("40");
                await page.getByRole("button", { name: "Resize image", exact: true }).click();
                await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
                await page.getByRole("heading", { name: "Resized image ready" }).scrollIntoViewIfNeeded();
                await shot(page, "image-result", appearance);
                await openRoute(page, appearance, "/tool/time-arithmetic");
                await page.getByLabel("Time A", { exact: true }).fill("nope");
                await page.getByLabel("Time A", { exact: true }).blur();
                await expect(page.locator("#time-a-error")).toBeVisible();
                await shot(page, "field-error", appearance);
                await openRoute(page, appearance, "/guide");
                await page.locator("[data-guide-choice]").first().click();
                while (await page.locator("[data-guide-open]").count() === 0) await page.locator("[data-guide-choice]").first().click();
                await shot(page, "guide-recommendation", appearance);
                await openRoute(page, appearance, "/tool/merge-pdf");
                await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles([path.resolve("test/fixtures/pdf/text-vector.pdf"), path.resolve("test/fixtures/pdf/rotated.pdf")]);
                await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
                await expect(page.getByRole("heading", { name: /Merged PDF ready/ })).toBeVisible({ timeout: 60_000 });
                await page.getByRole("heading", { name: /Merged PDF ready/ }).scrollIntoViewIfNeeded();
                await shot(page, "pdf-result", appearance);
                await openRoute(page, appearance, "/workflows/prepare-image-for-upload");
                await page.getByLabel("Source image (JPEG, PNG or WebP)").setInputFiles(path.resolve("test/fixtures/images/compressor-source.jpg"));
                await expect(page.locator("[data-workflow-source]")).toBeVisible();
                await page.getByLabel("Maximum width (pixels)").fill("120");
                await page.getByRole("button", { name: /^(Process image|Processing\.\.\.)$/ }).click();
                await expect(page.locator("[data-workflow-download]").first()).toBeVisible({ timeout: 60_000 });
                await page.locator("[data-workflow-download]").first().scrollIntoViewIfNeeded();
                await shot(page, "workflow-result", appearance);
                await page.setViewportSize({ width: 390, height: 844 });
                await openRoute(page, appearance, "/");
                await page.getByRole("button", { name: "Menu", exact: true }).click();
                await expect(page.locator("[data-nav-panel]")).toBeVisible();
                await shot(page, "mobile-menu", appearance);
                await page.emulateMedia({ reducedMotion: "reduce" });
                await page.setViewportSize({ width: 1440, height: 900 });
                await openRoute(page, appearance, "/discover");
                await shot(page, "reduced-motion-discover", appearance);
            });
        }
    });
}

// ---- 8V closeout: measured Home first card and responsive category navigation ----
test.describe("closeout: Home first catalog card at 390x844", () => {
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: the first catalog card border box sits below the header and inside the viewport`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await applyAppearance(page, appearance);
            await openRoute(page, appearance, "/");
            const epsilon = 0.01;
            const measure = await page.evaluate(() => {
                const card = document.querySelector("a.catalog-card");
                const header = document.querySelector("[data-site-header]");
                if (!card || !header) return null;
                const c = card.getBoundingClientRect();
                const h = header.getBoundingClientRect();
                return { top: c.top, bottom: c.bottom, left: c.left, right: c.right, headerBottom: h.bottom, headerHeight: h.height, innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollY: window.scrollY };
            });
            expect(measure, "first catalog card and site header exist").not.toBeNull();
            const m = measure!;
            await testInfo.attach("home-first-card", { body: JSON.stringify({ appearance: appearance.id, ...m }, null, 1), contentType: "application/json" });
            expect(m.scrollY).toBe(0);
            expect(m.headerHeight, "collapsed mobile header").toBeLessThanOrEqual(72 + epsilon);
            expect(m.top).toBeGreaterThanOrEqual(m.headerBottom - epsilon);
            expect(m.bottom).toBeLessThanOrEqual(m.innerHeight + epsilon);
            expect(m.left).toBeGreaterThanOrEqual(-epsilon);
            expect(m.right).toBeLessThanOrEqual(m.innerWidth + epsilon);
        });
    }
});

test.describe("closeout: Oxblood and Mineral category navigation below and above the desktop breakpoint", () => {
    const targets = APPEARANCE.filter(item => item.palette === "mineral" || item.palette === "oxblood");
    for (const appearance of targets) {
        for (const viewport of VIEWPORT) {
            test(`${appearance.id} at ${viewport.id}`, async ({ page }) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await applyAppearance(page, appearance);
                for (const route of ["/category/text", "/discover"]) {
                    await openRoute(page, appearance, route);
                    const onCategory = route.startsWith("/category/");
                    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                    expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
                    if (viewport.width >= 1024) {
                        const trigger = page.locator("[data-category-button]");
                        await expect(trigger).toBeVisible();
                        if (onCategory) {
                            await expect(trigger).toHaveAttribute("data-current-section", "true");
                            await expect(trigger).toHaveCSS("box-shadow", /inset/);
                        } else {
                            await expect(trigger).not.toHaveAttribute("data-current-section", "true");
                        }
                        await trigger.focus();
                        await page.keyboard.press("Enter");
                        await expect(trigger).toHaveAttribute("aria-expanded", "true");
                        await page.keyboard.press("Escape");
                        await expect(trigger).toHaveAttribute("aria-expanded", "false");
                        await expect(trigger).toBeFocused();
                    } else {
                        const menu = page.getByRole("button", { name: "Menu" });
                        await expect(page.locator("[data-category-button]")).toBeHidden();
                        await menu.focus();
                        await page.keyboard.press("Enter");
                        await expect(menu).toHaveAttribute("aria-expanded", "true");
                        const links = page.locator("[data-category-nav] a");
                        expect(await links.count(), "category links present").toBeGreaterThan(0);
                        await expect(links.first()).toBeVisible();
                        const current = page.locator('[data-category-nav] a[aria-current="page"]');
                        if (onCategory) {
                            await expect(current).toHaveCount(1);
                            const cue = await current.evaluate(el => { const s = getComputedStyle(el); return { shadow: s.boxShadow, weight: s.fontWeight, deco: s.textDecorationLine, border: s.borderLeftWidth, bg: s.backgroundColor }; });
                            const parentBg = await current.evaluate(el => getComputedStyle(el.closest("[data-nav-panel]")!).backgroundColor);
                            const nonColorCue = cue.shadow !== "none" || Number(cue.weight) >= 600 || cue.deco !== "none" || parseFloat(cue.border) > 0 || cue.bg !== parentBg;
                            expect(nonColorCue, `current link has a visible cue ${JSON.stringify(cue)}`).toBe(true);
                        } else {
                            await expect(current).toHaveCount(0);
                        }
                        const lastBox = await links.last().boundingBox();
                        expect(lastBox!.x).toBeGreaterThanOrEqual(0);
                        expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(viewport.width + 0.01);
                        await page.keyboard.press("Escape");
                        await expect(menu).toHaveAttribute("aria-expanded", "false");
                        await expect(menu).toBeFocused();
                        await menu.click();
                        await expect(menu).toHaveAttribute("aria-expanded", "true");
                        await menu.click();
                        await expect(menu).toHaveAttribute("aria-expanded", "false");
                    }
                }
            });
        }
    }
});

// ---- 8V closeout: compact visual-review captures (opt-in via P08V_SHEET_DIR; native viewport screenshots only) ----
const sheetDir = process.env.P08V_SHEET_DIR;
const CLOSEOUT_INTERIOR: Record<string, { route: string; kind: string }> = {
    "original-light": { route: "/discover", kind: "search-pdf-to-image" },
    "original-dark": { route: "/guide", kind: "guide-recommendation" },
    "mineral-light": { route: "/tool/image-resizer", kind: "image-resizer-success" },
    "mineral-dark": { route: "/tool/image-converter", kind: "image-converter-success" },
    "oxblood-light": { route: "/tool/merge-pdf", kind: "merge-pdf-success" },
    "oxblood-dark": { route: "/tool/images-to-pdf", kind: "images-to-pdf-success" },
    "signal-light": { route: "/tool/json-formatter", kind: "json-valid" },
    "signal-dark": { route: "/tool/json-formatter", kind: "json-invalid" },
    "cobalt-light": { route: "/workflows/prepare-image-for-upload", kind: "workflow-prepare-success" },
    "cobalt-dark": { route: "/workflows/pdf-pages-for-slides", kind: "workflow-slides-success" },
    "amber-light": { route: "/workflows/heic-photos-to-pdf", kind: "workflow-heic-success" },
    "amber-dark": { route: "/workflows/assemble-pdf-packet", kind: "workflow-packet-success" },
    "onedark": { route: "/contact", kind: "contact-invalid-submit" },
};
if (sheetDir) {
    test.describe("closeout: visual review captures", () => {
        test.setTimeout(240_000);
        for (const appearance of APPEARANCE) {
            test(`${appearance.id}: home x3, states, real interior`, async ({ page }) => {
                const out = (name: string) => path.join(sheetDir, `${appearance.id}__${name}.png`);
                mkdirSync(sheetDir, { recursive: true });
                await applyAppearance(page, appearance);
                for (const viewport of VIEWPORT) {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height });
                    await openRoute(page, appearance, "/");
                    await page.screenshot({ path: out(`home-${viewport.id}`) });
                }
                await page.setViewportSize({ width: 768, height: 1024 });
                await openRoute(page, appearance, "/category/text");
                await page.getByRole("button", { name: "Menu", exact: true }).click();
                await expect(page.locator("[data-nav-panel]")).toBeVisible();
                await expect(page.locator("[data-nav-panel]")).toHaveCSS("opacity", "1");
                await page.screenshot({ path: out("state-menu-tablet768") });
                await page.setViewportSize({ width: 390, height: 844 });
                await openRoute(page, appearance, "/category/text");
                await page.getByRole("button", { name: "Menu", exact: true }).click();
                await expect(page.locator("[data-nav-panel]")).toBeVisible();
                await expect(page.locator("[data-nav-panel]")).toHaveCSS("opacity", "1");
                await page.screenshot({ path: out("state-menu-mobile390") });
                await openRoute(page, appearance, "/");
                await page.keyboard.press("Tab");
                await page.keyboard.press("Tab");
                await page.keyboard.press("Tab");
                await page.screenshot({ path: out("state-keyboard-focus-mobile390") });

                const interior = CLOSEOUT_INTERIOR[appearance.id];
                await openRoute(page, appearance, interior.route);
                const fixtureImage = (name: string) => path.resolve("test/fixtures/images", name);
                const fixturePdf = (name: string) => path.resolve("test/fixtures/pdf", name);
                let anchor = page.locator("main h1").first();
                switch (interior.kind) {
                    case "search-pdf-to-image":
                        await page.locator("#tool-search").fill("pdf to image");
                        anchor = page.locator("main a").nth(2);
                        break;
                    case "guide-recommendation":
                        await page.locator("[data-guide-choice]").first().click();
                        while (await page.locator("[data-guide-open]").count() === 0) await page.locator("[data-guide-choice]").first().click();
                        anchor = page.locator("[data-guide-open]").first();
                        break;
                    case "image-resizer-success":
                        await page.getByLabel("Choose image", { exact: true }).setInputFiles(fixtureImage("resizer-source.jpg"));
                        await page.getByLabel("Width", { exact: true }).fill("40");
                        await page.getByRole("button", { name: "Resize image", exact: true }).click();
                        anchor = page.getByRole("heading", { name: "Resized image ready" });
                        break;
                    case "image-converter-success":
                        await page.getByLabel("Choose image").setInputFiles(fixtureImage("resizer-source.jpg"));
                        await page.getByRole("button", { name: "Convert image", exact: true }).click();
                        anchor = page.getByRole("heading", { name: "Converted image ready" });
                        break;
                    case "merge-pdf-success":
                        await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles([fixturePdf("text-vector.pdf"), fixturePdf("rotated.pdf")]);
                        await page.getByRole("button", { name: "Merge PDF", exact: true }).click();
                        anchor = page.getByRole("heading", { name: /Merged PDF ready/ });
                        break;
                    case "images-to-pdf-success":
                        await page.getByLabel("Choose JPEG or PNG images", { exact: true }).setInputFiles([fixtureImage("resizer-source.jpg"), fixtureImage("compressor-source.jpg")]);
                        await page.getByRole("button", { name: "Create PDF", exact: true }).click();
                        anchor = page.getByRole("heading", { name: "PDF ready", exact: true });
                        break;
                    case "json-valid":
                        await page.getByLabel("JSON input", { exact: true }).fill('{"tool":"formatter","ok":true,"items":[1,2,3]}');
                        await page.getByRole("button", { name: "Format JSON", exact: true }).click();
                        anchor = page.getByLabel("JSON output", { exact: true });
                        break;
                    case "json-invalid":
                        await page.getByLabel("JSON input", { exact: true }).fill('{"a": 1,}');
                        await page.getByRole("button", { name: "Format JSON", exact: true }).click();
                        anchor = page.getByRole("main").getByRole("alert");
                        break;
                    case "workflow-prepare-success":
                        await page.getByLabel("Source image (JPEG, PNG or WebP)").setInputFiles(fixtureImage("compressor-source.jpg"));
                        await page.getByLabel("Maximum width (pixels)").fill("120");
                        await page.getByRole("button", { name: /^(Process image|Processing\.\.\.)$/ }).click();
                        anchor = page.locator("[data-workflow-download]").first();
                        break;
                    case "workflow-slides-success":
                        await page.getByLabel("PDF file").setInputFiles(fixturePdf("ordering.pdf"));
                        await page.getByLabel("Pages to add", { exact: true }).fill("1");
                        await page.getByRole("button", { name: "Add page", exact: true }).click();
                        await page.getByLabel("Resolution").selectOption("72");
                        await page.getByRole("button", { name: "Export slide images", exact: true }).click();
                        anchor = page.locator("[data-workflow-output]").first();
                        break;
                    case "workflow-heic-success":
                        await page.getByLabel(/HEIC or HEIF photos/).setInputFiles(fixtureImage("heic-source.heic"));
                        await page.getByRole("button", { name: "Create PDF", exact: true }).click();
                        anchor = page.locator("[data-workflow-download]").first();
                        break;
                    case "workflow-packet-success":
                        await page.getByLabel(/PDFs and images/).setInputFiles([fixturePdf("ordering.pdf"), fixtureImage("resizer-source.png")]);
                        await page.getByLabel("Add pages from").selectOption("source-1");
                        await page.getByLabel("Pages to add", { exact: true }).fill("1");
                        await page.getByRole("button", { name: "Add page", exact: true }).click();
                        await page.getByLabel("Add pages from").selectOption("source-2");
                        await page.getByRole("button", { name: "Add page", exact: true }).click();
                        await page.getByRole("button", { name: "Assemble packet", exact: true }).click();
                        anchor = page.locator("[data-workflow-download]").first();
                        break;
                    case "contact-invalid-submit":
                        await page.getByRole("textbox", { name: "Message", exact: true }).fill("x");
                        await page.getByRole("button", { name: /^(Submit|Sending…)$/ }).click();
                        anchor = page.getByRole("main").getByRole("alert").first();
                        break;
                }
                await expect(anchor).toBeVisible({ timeout: 90_000 });
                await anchor.scrollIntoViewIfNeeded();
                await page.evaluate(() => window.scrollBy(0, -90));
                await page.screenshot({ path: out(`interior-${interior.kind}-mobile390`) });
            });
        }
    });
}
