import { test, expect } from "./support/fixture";

test.use({ serviceWorkers: "block" });

test("Vercel Analytics is absent in the normal default-off build", async ({ page }) => {
    const unexpected: string[] = [];
    page.on("request", request => {
        if (/vercel-(?:scripts|insights)\.com|\/(?:insights|va)\//.test(request.url())) unexpected.push(request.url());
        if (request.postData()?.includes('"sdkn":"@vercel/analytics')) unexpected.push(request.url());
    });
    await page.goto("/tool/calculator?expression=ANALYTICS_DISABLED_QUERY#ANALYTICS_DISABLED_HASH", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Calculator", exact: true })).toBeVisible();
    await expect(page.locator('script[data-sdkn^="@vercel/analytics"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.va)).toBeUndefined();
    expect(unexpected).toEqual([]);
});
