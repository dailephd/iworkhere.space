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
    expect(await page.locator("html").evaluate(root => getComputedStyle(root).getPropertyValue("--background").trim())).toBe("#111a29");
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
            await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "All tools", exact: true }).click();
            await expect(page).toHaveURL(/\/discover$/);
            await expect(page.locator("html")).toHaveAttribute("data-palette", id);
            await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        });
    }
}

test("all twelve palettes retain keyboard focus and geometry under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const card = page.locator(".catalog-card").first();
    // Document coordinates: focusing the card may legitimately scroll it clear of the fixed footer, which must not read as a geometry change.
    const documentBox = () => card.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }; });
    const baseline = await documentBox();
    for (const [id, label] of palettes) {
        for (const mode of ["Light", "Dark"]) {
            await page.getByRole("button", { name: "Themes", exact: true }).click();
            await page.getByRole("radio", { name: label, exact: true }).check();
            await page.getByRole("radio", { name: mode, exact: true }).check();
            await page.keyboard.press("Escape"); await card.focus();
            await expect(card).toBeFocused();
            expect(await documentBox(), `${id} ${mode} geometry`).toEqual(baseline);
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
