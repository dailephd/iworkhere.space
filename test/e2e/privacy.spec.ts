import { test, expect } from "./support/fixture";

test("privacy is public, server-rendered and reachable from home and tools", async ({ page, request }, testInfo) => {
    const response = await request.get("/privacy");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Site measurements and diagnostics");
    for (const source of ["/", "/tool/json-formatter"]) {
        await page.goto(source);
        const link = page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" });
        await expect(link).toHaveAttribute("href", "/privacy");
        await link.focus();
        await expect(link).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/privacy$/);
        await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    }
    await expect(page).toHaveTitle("Privacy Policy — iworkhere.space");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/privacy");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /site measurements/);
    await expect(page.getByRole("link", { name: "Google Ad Settings", exact: true })).toHaveAttribute("href", "https://adssettings.google.com/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(0);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await testInfo.attach("privacy-page", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await testInfo.attach("privacy-footer", { body: await page.screenshot(), contentType: "image/png" });
});
