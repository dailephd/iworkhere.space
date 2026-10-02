import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "./support/fixture";

const contexts = [
    { name: "system-light", id: "system", scheme: "light" },
    { name: "system-dark", id: "system", scheme: "dark" },
    { name: "light", id: "light", scheme: "dark" },
    { name: "dark", id: "dark", scheme: "light" },
    { name: "onedark", id: "onedark", scheme: "light" },
] as const;
const runId = process.env.ISLAND_MATERIAL_RUN_ID ?? process.env.E2E_RUN_ID!;
const directory = path.resolve("test-report/island-material-pilot", runId);

for (const context of contexts) {
    test(`island material ${context.name}: launcher and successful resize`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === "mobile-chromium";
        const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: context.scheme });
        await page.addInitScript(id => localStorage.setItem("theme", JSON.stringify(id)), context.id);
        await mkdir(directory, { recursive: true });
        const entries = [];
        for (const route of ["/", "/tool/image-resizer"]) {
            if (route === "/") {
                await page.goto(route);
            } else {
                await page.getByRole("main").getByRole("link", { name: /^Image Resizer/ }).first().click();
                await expect(page).toHaveURL(/\/tool\/image-resizer$/);
            }
            await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
            expect(await page.locator("html").getAttribute("data-theme")).toBe(context.id === "system" ? null : context.id);
            if (route !== "/") {
                await page.getByLabel("Choose image", { exact: true }).setInputFiles(path.resolve("test/fixtures/images/resizer-source.jpg"));
                await expect(page.getByLabel("Width", { exact: true })).toHaveValue("80");
                await page.getByLabel("Width", { exact: true }).fill("40");
                await page.getByRole("button", { name: "Resize image", exact: true }).click();
                await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
                await expect(page.getByRole("link", { name: "Download resized image" })).toHaveAttribute("download", /.+/);
                await expect.poll(() => page.getByAltText("Resized image preview").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(40);
            }
            if (route === "/") {
                const islands = page.locator('[data-surface="section-island"]');
                await expect(islands).toHaveCount(2);
                await expect(page.getByRole("region", { name: "Image tools", exact: true })).toBeVisible();
                await expect(page.getByRole("region", { name: "All other tools", exact: true })).toBeVisible();
                const islandBoxes = await islands.evaluateAll(elements => elements.map(element => {
                    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
                    return { top: rect.top, bottom: rect.bottom, padding: style.padding, radius: style.borderRadius, border: style.borderColor, shadow: style.boxShadow };
                }));
                expect(islandBoxes[1].top).toBeGreaterThan(islandBoxes[0].bottom);
                for (const field of ["padding", "radius", "border", "shadow"] as const) expect(islandBoxes[0][field]).toBe(islandBoxes[1][field]);
                const card = islands.first().getByRole("link").first();
                await card.focus();
                await expect(card).toBeFocused();
                await card.evaluate(element => (element as HTMLElement).blur());
                await page.evaluate(() => scrollTo(0, 0));
            }
            const observations = await page.evaluate(() => {
                const html = document.documentElement;
                const style = getComputedStyle(html);
                const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
                const luminance = (hex: string) => {
                    const raw = hex.replace("#", "");
                    const c = raw.length === 3 ? [...raw].map(character => character + character).join("") : raw;
                    const channels = [0, 2, 4].map(offset => parseInt(c.slice(offset, offset + 2), 16) / 255)
                        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
                    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
                };
                const ratio = (a: string, b: string) => {
                    const values = [luminance(token(a)), luminance(token(b))].sort((x, y) => y - x);
                    return (values[0] + 0.05) / (values[1] + 0.05);
                };
                const contrast = [];
                for (const surface of ["background", "surface", "surface-alt", "accent-soft", "search-bg", "card-bg", "card-hover-bg", "panel-bg", "preview-bg", "result-bg", "secondary-action-bg", "input-bg", "footer-bg"]) {
                    for (const text of ["text", "text-muted"]) {
                        contrast.push({ text, surface, ratio: ratio(text, surface) });
                    }
                }
                for (const text of ["accent", "danger", "success", "warning"]) {
                    contrast.push({ text, surface: "surface", ratio: ratio(text, "surface") });
                }
                contrast.push({ text: "contrast", surface: "accent", ratio: ratio("contrast", "accent") });
                contrast.push({ text: "contrast", surface: "accent-hover", ratio: ratio("contrast", "accent-hover") });
                for (const text of ["header-text", "header-muted"]) {
                    for (const surface of ["header-bg", "nav-hover-bg"]) contrast.push({ text, surface, ratio: ratio(text, surface) });
                }
                for (const category of ["image", "text", "math", "time", "everyday", "document"]) {
                    contrast.push({ text: `category-${category}`, surface: `category-${category}-soft`, ratio: ratio(`category-${category}`, `category-${category}-soft`) });
                    for (const text of ["text", "text-muted"]) contrast.push({ text, surface: `category-${category}-soft`, ratio: ratio(text, `category-${category}-soft`) });
                }
                contrast.push({ text: "danger", surface: "danger-soft", ratio: ratio("danger", "danger-soft") });
                contrast.push({ text: "success", surface: "result-bg", ratio: ratio("success", "result-bg") });
                contrast.push({ text: "category-image", surface: "panel-bg", ratio: ratio("category-image", "panel-bg") });
                contrast.push({ text: "contrast", surface: "accent", ratio: ratio("contrast", "accent") });
                const focusContrast = ["header-bg", "search-bg", "input-bg"].map(surface => ({ surface, ratio: ratio("focus-ring", surface) }));
                contrast.push({ text: "accent-secondary", surface: "background", ratio: ratio("accent-secondary", "background") });
                // Resolve rendered CSS colors, including alpha/color-mix, over ancestor backgrounds.
                const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
                canvas.width = canvas.height = 1;
                const rgba = (value: string) => {
                    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
                    return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
                };
                const blend = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3])).concat(1);
                const backdrop = (element: Element) => {
                    const ancestors: Element[] = [];
                    for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
                    return ancestors.reduce((color, current) => blend(rgba(getComputedStyle(current).backgroundColor), color), rgba(token("background")));
                };
                const rgbRatio = (a: number[], b: number[]) => {
                    const lum = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
                    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
                    return (hi + 0.05) / (lo + 0.05);
                };
                const renderedContrast = [...document.querySelectorAll('.section-island h2, .catalog-card h3, .catalog-card p, .material-raised h2, .material-raised label, .material-raised p, .material-glass p, .material-glass h2, .material-primary, .material-secondary, #tool-search')].map(element => ({
                    text: element.textContent?.slice(0, 40), ratio: rgbRatio(rgba(getComputedStyle(element).color), backdrop(element)),
                }));
                const boundaries = [...document.querySelectorAll('#tool-search, input[type="number"], .material-secondary, [data-surface="preview-stage"], [data-surface="result-stage"]')].map(element => ({
                    role: element.getAttribute("data-surface") ?? element.tagName, ratio: rgbRatio(rgba(getComputedStyle(element).borderTopColor), backdrop(element)),
                }));
                const geometry = () => [...document.querySelectorAll("header, main, nav, section, input, button")].map(element => {
                    const rect = element.getBoundingClientRect();
                    return [rect.x, rect.y, rect.width, rect.height];
                });
                const before = geometry();
                const original = html.getAttribute("data-theme");
                html.setAttribute("data-theme", "light");
                const neutral = geometry();
                if (original === null) html.removeAttribute("data-theme"); else html.setAttribute("data-theme", original);
                return { contrast, renderedContrast, boundaries, focusContrast, geometryUnchanged: JSON.stringify(before) === JSON.stringify(neutral),
                    background: token("background"), overflow: html.scrollWidth > innerWidth,
                    focus: token("focus-ring"), focusSupport: token("text"),
                    materials: [...document.querySelectorAll('[data-surface], .catalog-card, .material-raised, .material-primary, .material-secondary, #tool-search')].map(element => {
                        const s = getComputedStyle(element), rect = element.getBoundingClientRect();
                        return { role: element.getAttribute("data-surface") ?? element.className, background: s.backgroundColor, color: s.color, border: s.borderColor, filter: s.backdropFilter, shadow: s.boxShadow,
                            sample: { x: Math.floor(rect.right - 12), y: Math.floor(rect.top + 12) } };
                    }), glassFilter: token("glass-filter"), raisedShadow: token("raised-shadow") };
            });
            expect(observations.geometryUnchanged).toBe(true);
            expect(observations.glassFilter.includes("blur")).toBe(context.id === "onedark");
            expect(observations.raisedShadow.includes("-2px")).toBe(context.id === "onedark");
            expect(observations.overflow).toBe(false);
            for (const pair of observations.contrast) {
                expect(pair.ratio, `${context.name} ${pair.text} on ${pair.surface}`).toBeGreaterThanOrEqual(4.5);
            }
            for (const pair of observations.renderedContrast) expect(pair.ratio, `rendered ${pair.text}`).toBeGreaterThanOrEqual(4.5);
            for (const pair of observations.boundaries) expect(pair.ratio, `boundary ${pair.role}`).toBeGreaterThanOrEqual(3);
            for (const pair of observations.focusContrast) expect(pair.ratio, `focus on ${pair.surface}`).toBeGreaterThanOrEqual(3);
            if (context.name === "system-light") expect(observations.background).toBe("#f5f7fb");
            if (context.name === "system-dark") expect(observations.background).toBe("#0b1020");
            const headerBackground = await page.locator("header").evaluate(element => getComputedStyle(element).backgroundColor);
            const bodyBackground = await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor);
            expect(headerBackground).not.toBe(bodyBackground);
            if (route !== "/") {
                const settingsBackground = await page.locator("form").evaluate(element => getComputedStyle(element).backgroundColor);
                const resultBackground = await page.getByRole("region", { name: "Image preview and result" }).evaluate(element => getComputedStyle(element).backgroundColor);
                const inputBackground = await page.getByLabel("Width", { exact: true }).evaluate(element => getComputedStyle(element).backgroundColor);
                expect(settingsBackground).not.toBe(resultBackground);
                expect(inputBackground).not.toBe(settingsBackground);
            }
            const filename = `${route === "/" ? "homepage" : "resizer-success"}-${mobile ? "mobile" : "desktop"}-${context.name}.png`;
            const capture = route === "/" ? (!mobile && context.id !== "system") || (mobile && ["light", "onedark"].includes(context.id)) : !mobile && context.id !== "system";
            if (capture) {
                await page.screenshot({ path: path.join(directory, filename), fullPage: mobile });
                entries.push({ context: context.name, route, viewport, state: route === "/" ? "launcher" : "successful resize 40 x 30 JPEG", filename, observations });
            }
            if (route === "/") {
                await page.getByRole("searchbox").fill("image");
                const focus = await page.getByRole("searchbox").evaluate(input => {
                    const style = getComputedStyle(input);
                    return { outline: style.outlineStyle, shadow: style.boxShadow };
                });
                expect(focus.outline).toBe("solid");
                expect(focus.shadow).not.toBe("none");
                await expect(page.getByText("image", { exact: true }).first()).toBeVisible();

            }

        }
        if (!mobile && context.id === "onedark") {
            await page.getByRole("button", { name: "Reset", exact: true }).click();
            await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "empty.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) });
            await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
            const filename = `resizer-error-desktop-${context.name}.png`;
            await page.screenshot({ path: path.join(directory, filename) });
            entries.push({ context: context.name, route: "/tool/image-resizer", viewport, state: "empty local JPEG; actionable validation error", filename });
        }
        if (context.id === "onedark") {
            const session = await page.context().newCDPSession(page);
            await session.send("Emulation.setEmulatedMedia", { features: [
                { name: "prefers-color-scheme", value: context.scheme },
                { name: "prefers-reduced-transparency", value: "reduce" },
            ] });
            expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
            const reduced = await page.getByRole("region", { name: "Image preview and result" }).evaluate(element => {
                const s = getComputedStyle(element);
                return { filter: s.backdropFilter, background: s.backgroundColor };
            });
            expect(reduced.filter).toBe("none");
            expect(reduced.background).toMatch(/^rgb\(/);
            await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: context.scheme }] });
            await session.detach();
        }
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        await expect(page.getByRole("option")).toHaveCount(4);
        await expect(page.getByRole("option", { selected: true })).toHaveCount(1);
        await page.getByRole("option", { name: "One Dark", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
        await writeFile(path.join(directory, `${mobile ? "mobile" : "desktop"}-${context.name}.json`), JSON.stringify(entries, null, 2));
    });
}

for (const context of contexts) {
    test(`direct Resizer hydration ${context.name}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: context.scheme });
        await page.addInitScript(id => localStorage.setItem("theme", JSON.stringify(id)), context.id);
        await page.goto("/tool/image-resizer");
        await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
        expect(await page.locator("html").getAttribute("data-theme")).toBe(context.id === "system" ? null : context.id);
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(path.resolve("test/fixtures/images/resizer-source.jpg"));
        await expect(page.getByLabel("Width", { exact: true })).toHaveValue("80");
        await page.getByLabel("Width", { exact: true }).fill("40");
        await page.getByRole("button", { name: "Resize image", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Resized image ready" })).toBeVisible();
        await expect.poll(() => page.getByAltText("Resized image preview").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(40);
    });
}
