import { test, expect } from "./support/fixture";

test("historical category redirects permanently and converter SEO is canonical", async ({ page, request }) => {
    const redirect = await request.get("/category/everyday", { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe("/category/converter");
    expect((await page.goto("/category/everyday"))?.status()).toBe(200);
    await expect(page).toHaveURL(/\/category\/converter$/);
    await expect(page.getByRole("heading", { level: 1, name: "Converters", exact: true })).toBeVisible();
    const tools = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(tools).toHaveCount(2);
    expect(await tools.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual([
        "/tool/length-converter", "/tool/weight-converter",
    ]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/category/converter");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://iworkhere.space/category/converter");
    await expect(page).toHaveTitle("Converters — iworkhere.space");
    await expect(page.locator('a[href="/category/everyday"]')).toHaveCount(0);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap.split("<loc>https://iworkhere.space/category/converter</loc>")).toHaveLength(2);
    expect(sitemap).not.toContain("/category/everyday");
});

test("homepage groups every discoverable tool exactly once and keyboard navigation reaches converters", async ({ page }) => {
    await page.goto("/discover");
    const catalog = await page.getByRole("main").locator('a[href^="/tool/"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    await page.goto("/");
    const main = page.getByRole("main");
    // Registry cards only: the featured task links are separate entry points and are checked in v0.4.3-discovery.spec.ts.
    const links = main.locator('a.catalog-card[href^="/tool/"]');
    const home = await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    expect(new Set(home).size).toBe(18);
    expect(home).toHaveLength(18);
    expect([...home].sort()).toEqual([...catalog].sort());
    const section = page.getByRole("region", { name: "Converters", exact: true });
    await expect(section.locator('a[href^="/tool/"]')).toHaveCount(2);
    await expect(page.getByRole("region", { name: "Developer tools", exact: true }).locator('a[href="/tool/qr-code-generator"]')).toHaveCount(1);
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    const categories = await navigation.locator('a[href^="/category/"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")?.split("/").pop()));
    const islands = await main.locator('[data-surface="section-island"]').evaluateAll(elements => elements.map(element => element.getAttribute("aria-labelledby")?.replace("home-category-", "").replace("-title", "")));
    expect(islands).toEqual(categories);
    const chip = main.getByRole("link", { name: "Converters", exact: true });
    await chip.focus();
    await expect(chip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/category\/converter$/);
    await page.goto("/tool/length-converter");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Converters", exact: true })).toHaveAttribute("href", "/category/converter");
});

const appearance = ["mineral", "oxblood", "signal", "cobalt", "amber", "original"].flatMap(palette =>
    ["light", "dark", "system"].map(mode => ({ palette, mode, scheme: mode === "light" ? "dark" as const : "light" as const })),
);
appearance.push({ palette: "onedark", mode: "onedark", scheme: "light" });
appearance.push({ palette: "mineral", mode: "system", scheme: "dark" });

for (const context of appearance) {
    test(`category colors retained: ${context.palette} ${context.mode} ${context.scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: context.scheme });
        await page.addInitScript(({ palette, mode }) => {
            localStorage.setItem("theme", JSON.stringify(mode));
            localStorage.setItem("palette", JSON.stringify(palette));
        }, context);
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
        const resolvedMode = context.mode === "system" ? context.scheme : context.mode;
        await expect(page.locator("html")).toHaveAttribute("data-theme", resolvedMode);
        const expected = resolvedMode === "onedark" ? ["#98c379", "#2e3b2b"] : resolvedMode === "dark" ? ["#4ade80", "#173527"] : ["#166534", "#e8f5ec"];
        const chip = page.getByRole("main").getByRole("link", { name: "Converters", exact: true });
        await expect(chip).toHaveAttribute("data-category", "converter");
        expect(await chip.evaluate(element => {
            const style = getComputedStyle(element);
            return [style.getPropertyValue("--category-color").trim(), style.getPropertyValue("--category-soft").trim()];
        })).toEqual(expected);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--category-everyday").trim())).toBe("");
        const qr = page.getByRole("region", { name: "Developer tools", exact: true }).locator('a[href="/tool/qr-code-generator"]');
        await expect(qr).toHaveAttribute("data-category", "developer");
        expect(await qr.evaluate(element => {
            const style = getComputedStyle(element);
            return style.getPropertyValue("--category-color").trim() === style.getPropertyValue("--category-developer").trim();
        })).toBe(true);
        await chip.focus();
        await expect(chip).toBeFocused();
        expect(await chip.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}
