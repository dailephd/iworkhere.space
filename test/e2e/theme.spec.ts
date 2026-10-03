import { test, expect } from "./support/fixture";

test("non-system theme persists through reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "One Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    await page.reload();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    // Playwright creates a new context per test, isolating persistent state.
});

for (const stored of ["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum", "unknown", "system", "light", "dark", "onedark"]) {
    test(`pre-paint initialization handles ${stored} without hydration`, async ({ page }) => {
        await page.addInitScript(value => {
            localStorage.setItem("theme", JSON.stringify(value));
            document.documentElement?.setAttribute("data-theme", "dracula");
        }, stored);
        // Block hydration bundles; the parser executes the existing inline initializer.
        await page.route("**/_next/**/*.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
        await page.route("**/", async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace("<html ", '<html data-theme="dracula" ');
            await route.fulfill({ response, body: html });
        });
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const explicit = ["light", "dark", "onedark"].includes(stored);
        expect(await page.locator("html").getAttribute("data-theme")).toBe(explicit ? stored : null);
        expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(explicit || stored === "system" ? JSON.stringify(stored) : null);
    });
}
for (const retired of ["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum"]) {
    test(`hydration falls back to System for ${retired}`, async ({ page }) => {
        await page.addInitScript(value => localStorage.setItem("theme", JSON.stringify(value)), retired);
        await page.goto("/");
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        await expect(page.getByRole("option", { name: "System", exact: true })).toHaveAttribute("aria-selected", "true");
        expect(await page.locator("html").getAttribute("data-theme")).toBeNull();
        expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
    });
}
