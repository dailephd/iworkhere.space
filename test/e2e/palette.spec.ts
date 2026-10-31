import { test, expect } from "./support/fixture";

test("appearance: default, keyboard selection, persistence and independent modes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-palette", "original");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance settings" });
    await expect(dialog.getByRole("group", { name: "Palette", exact: true }).getByRole("radio")).toHaveCount(7);
    await expect(dialog.getByRole("group", { name: "Color mode", exact: true }).getByRole("radio")).toHaveCount(3);
    await expect(dialog.getByRole("radio", { name: "Violet & Graphite" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("radio", { name: "Oxblood Atelier" })).toBeChecked();
    await dialog.getByRole("radio", { name: "Dark", exact: true }).check();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const box = await dialog.boundingBox(); const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeFocused();
    await page.reload(); await expect(page.locator("html")).toHaveAttribute("data-palette", "oxblood");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await dialog.getByRole("radio", { name: "System", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(dialog.getByRole("radio", { name: "System", exact: true })).toBeChecked();
    await expect(dialog.getByText(/effects/i)).toHaveCount(0);
    await dialog.getByRole("radio", { name: "One Dark", exact: true }).check();
    await expect(dialog.getByRole("radio", { name: "Light", exact: true })).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
});

test("Violet & Graphite System is the unpersisted pre-paint default", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.route("**/_next/**/*.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-palette", "original");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("appearance stays usable with blocked storage", async ({ page }) => {
    await page.addInitScript(() => {
        for (const method of ["getItem", "setItem", "removeItem"]) Object.defineProperty(Storage.prototype, method, {
            configurable: true, value: () => { throw new DOMException("Unavailable", "SecurityError"); },
        });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("radio", { name: "Violet & Graphite" }).check();
    await page.getByRole("radio", { name: "Dark", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-palette", "original");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "Violet & Graphite" })).toBeChecked();
});

test("saved palette and mode initialize before hydration", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("palette", JSON.stringify("cobalt")); localStorage.setItem("theme", JSON.stringify("dark"));
    });
    await page.route("**/_next/**/*.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-palette", "cobalt");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.locator("html").evaluate(root => getComputedStyle(root).getPropertyValue("--background").trim())).toBe("#0b1330");
});

for (const invalid of ["palette", "theme"]) {
    test(`invalid ${invalid} keeps the other valid preference`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await page.addInitScript(key => {
            localStorage.setItem("palette", JSON.stringify("amber")); localStorage.setItem("theme", JSON.stringify("dark"));
            localStorage.setItem(key, "{invalid");
        }, invalid);
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
        await expect(page.locator("html")).toHaveAttribute("data-palette", invalid === "palette" ? "original" : "amber");
        await expect(page.locator("html")).toHaveAttribute("data-theme", invalid === "theme" ? "light" : "dark");
    });
}

const palettes = [
    ["mineral", "Mineral Research"], ["oxblood", "Oxblood Atelier"], ["signal", "Signal Green"],
    ["cobalt", "Cobalt & Terracotta"], ["amber", "Amber & Graphite"], ["original", "Violet & Graphite"],
] as const;
for (const [id, label] of palettes) {
    for (const mode of ["light", "dark"] as const) {
        test(`${label} ${mode}: selection survives reload and navigation`, async ({ page }) => {
            await page.goto("/");
            await page.getByRole("button", { name: "Themes", exact: true }).click();
            await page.getByRole("radio", { name: label, exact: true }).check();
            await page.getByRole("radio", { name: mode === "light" ? "Light" : "Dark", exact: true }).check();
            await page.keyboard.press("Escape");
            await page.reload();
            await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
            await expect(page.locator("html")).toHaveAttribute("data-palette", id);
            await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
            // Below 1024px the primary links sit inside the Menu.
            if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole("button", { name: "Menu", exact: true }).click();
            await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "All tools", exact: true }).click();
            await expect(page).toHaveURL(/\/discover$/);
            await expect(page.locator("html")).toHaveAttribute("data-palette", id);
            await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        });
    }
}

test("all twelve palettes retain keyboard focus and per-family geometry under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const card = page.locator(".catalog-card").first();
    // Document coordinates: focusing the card may legitimately scroll it clear of the fixed footer, which must not read as a geometry change.
    const documentBox = () => card.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }; });
    const baseline = new Map<string, Awaited<ReturnType<typeof documentBox>>>();
    for (const [id, label] of palettes) {
        for (const mode of ["Light", "Dark"]) {
            await page.getByRole("button", { name: "Themes", exact: true }).click();
            await page.getByRole("radio", { name: label, exact: true }).check();
            await page.getByRole("radio", { name: mode, exact: true }).check();
            await page.keyboard.press("Escape"); await card.focus();
            await expect(card).toBeFocused();
            const box = await documentBox(); if (!baseline.has(id)) baseline.set(id, box); expect(box, `${id} ${mode} shares its family geometry`).toEqual(baseline.get(id));
            const styles = await card.evaluate(element => {
                const style = getComputedStyle(element);
                return { animation: style.animationName, transform: style.transform, outline: style.outlineStyle,
                    overflow: document.documentElement.scrollWidth > innerWidth };
            });
            expect(styles.animation).toBe("none"); expect(styles.transform).toBe("none");
            expect(styles.outline).toBe("solid"); expect(styles.overflow).toBe(false);
        }
    }
});

test("homepage Colorfield dark palettes: palette-specific boards, approved hero fills and loaded DM Sans", async ({ page }) => {
    const HERO: Record<string, string> = { original: "rgb(36, 26, 82)", mineral: "rgb(28, 90, 78)", oxblood: "rgb(107, 23, 51)", signal: "rgb(11, 26, 12)", cobalt: "rgb(210, 96, 58)", amber: "rgb(233, 169, 58)", onedark: "rgb(47, 37, 64)" };
    const documentBoard: Record<string, string> = {};
    for (const palette of Object.keys(HERO)) {
        await page.addInitScript(([p]) => { localStorage.setItem("palette", JSON.stringify(p)); localStorage.setItem("theme", JSON.stringify(p === "onedark" ? "onedark" : "dark")); }, [palette]);
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        const seen = await page.evaluate(() => ({
            hero: getComputedStyle(document.querySelector("[data-home-hero]")!).backgroundColor,
            board: getComputedStyle(document.querySelector('[data-home-board="document"] .section-island')!).backgroundColor,
            card: getComputedStyle(document.querySelector('[data-home-board="document"] .home-card')!).backgroundColor,
            font: getComputedStyle(document.body).fontFamily,
            loaded: document.fonts.check('16px "DM Sans"'),
        }));
        const ratio = await page.evaluate(() => {
            const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true })!;
            const rgb = (c: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
            const lum = (c: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]); };
            return [...document.querySelectorAll("[data-home-board]")].flatMap((board) => {
                const b = lum(getComputedStyle(board.querySelector(".section-island")!).backgroundColor);
                return [...board.querySelectorAll(".home-card")].map((card) => { const style = getComputedStyle(card); const c = lum(style.backgroundColor); const edge = lum(style.borderTopColor); const bgRgb = rgb(style.backgroundColor), boardRgb = rgb(getComputedStyle(board.querySelector(".section-island")!).backgroundColor); return { tier: Math.hypot(bgRgb[0] - boardRgb[0], bgRgb[1] - boardRgb[1], bgRgb[2] - boardRgb[2]), ratio: (Math.max(b, edge) + 0.05) / (Math.min(b, edge) + 0.05) }; });
            });
        });
        expect(ratio.length, palette).toBeGreaterThanOrEqual(18);
        // Prompt 3 contract: the card is a distinct neutral tier of its board (RGB distance at least 12; it may sit darker or lighter, so no brightness ordering is required) and its border must stand out from the board by at least 1.5:1.
        for (const one of ratio) { expect(one.tier, palette).toBeGreaterThanOrEqual(12); expect(one.ratio, palette).toBeGreaterThanOrEqual(1.5); }
        expect(seen.hero, palette).toBe(HERO[palette]);
        expect(seen.hero).not.toMatch(/102, 84, 75|94, 79, 86/);
        expect(seen.board, palette).not.toBe(seen.card);
        expect(seen.font).toContain("DM Sans");
        expect(seen.loaded).toBe(true);
        documentBoard[palette] = seen.board;
        await page.context().clearCookies();
    }
    expect(documentBoard.amber).not.toBe(documentBoard.cobalt);
    expect(new Set(Object.values(documentBoard)).size).toBe(Object.keys(HERO).length);
});
