import { test, expect } from "./support/fixture";

test("non-system theme persists through reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("option", { name: "Dracula", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dracula");
    await page.reload();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dracula");
    // Playwright creates a new context per test, isolating persistent state.
});
