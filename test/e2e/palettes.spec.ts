import { test, expect } from "./support/fixture";

const palettes = [
    { id: "mineral", label: "Mineral Research", light: "#f2f0e7", dark: "#141e1c" },
    { id: "oxblood", label: "Oxblood Atelier", light: "#f6f1ec", dark: "#21171c" },
    { id: "signal", label: "Signal Green", light: "#eff1e8", dark: "#111815" },
    { id: "cobalt", label: "Cobalt & Terracotta", light: "#f5f0e8", dark: "#111a29" },
    { id: "amber", label: "Amber & Graphite", light: "#f5f0e3", dark: "#1b201e" },
    { id: "original", label: "Violet & Graphite", light: "#edeff3", dark: "#1a1d23" },
] as const;

const background = (page: import("@playwright/test").Page) =>
    page.locator("html").evaluate(element => getComputedStyle(element).getPropertyValue("--background").trim());

test("six source palettes are selectable, change colors and persist", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "Light", exact: true }).click();
    for (const palette of palettes) {
        await page.getByRole("button", { name: "Palettes", exact: true }).click();
        await page.getByRole("listbox", { name: "Color palette" })
            .getByRole("option", { name: palette.label, exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-palette", palette.id);
        expect(await background(page)).toBe(palette.light);
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-palette", "original");
    expect(await background(page)).toBe("#edeff3");
});

test("dark and system modes use dark source palettes; One Dark remains fixed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "Dark", exact: true }).click();
    await page.getByRole("button", { name: "Palettes", exact: true }).click();
    await page.getByRole("option", { name: "Oxblood Atelier", exact: true }).click();
    expect(await background(page)).toBe("#21171c");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "One Dark", exact: true }).click();
    expect(await background(page)).toBe("#282c34");
    await page.reload();
    expect(await background(page)).toBe("#282c34");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "System", exact: true }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await background(page)).toBe("#21171c");
    await page.emulateMedia({ colorScheme: "light" });
    expect(await background(page)).toBe("#f6f1ec");
});

test("pre-paint initialization rejects unknown palette identifiers", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("palette", JSON.stringify("unknown")));
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-palette", /.+/);
    expect(await background(page)).toBe("#f5f7fb");
    expect(await page.evaluate(() => localStorage.getItem("palette"))).toBeNull();
});
