import { test, expect } from "./support/fixture";

// The sitemap is the existing list of public routes: 5 site pages, 18 tools and 7 categories.
async function publicPath(request: import("@playwright/test").APIRequestContext): Promise<string[]> {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
}

test("every public URL has the exact browser title and its own canonical path and description", async ({ page, request }) => {
    const pathList = await publicPath(request);
    expect(pathList).toHaveLength(30);
    expect(new Set(pathList).size).toBe(30);
    const descriptionList = new Set<string>();
    for (const path of pathList) {
        await page.goto(path);
        expect(await page.title(), path).toBe("iworkhere");
        expect(await page.evaluate(() => document.title)).toBe("iworkhere");
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", path === "/" ? "https://iworkhere.space" : `https://iworkhere.space${path}`);
        const description = await page.locator('meta[name="description"]').getAttribute("content");
        expect(description, path).toBeTruthy();
        descriptionList.add(description!);
        await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute("content", "iworkhere");
    }
    expect(descriptionList.size, "page-specific descriptions").toBeGreaterThanOrEqual(25);
});

test("the browser title stays correct after client-side navigation", async ({ page }) => {
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const name of ["All tools", "About"]) {
        await navigation.getByRole("link", { name, exact: true }).click();
        await expect(page).toHaveURL(name === "About" ? /\/about$/ : /\/discover$/);
        await expect.poll(() => page.title()).toBe("iworkhere");
    }
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect.poll(() => page.title()).toBe("iworkhere");
});

test("primary navigation is Home, All tools, every populated category in registry order, then About", async ({ page, request }) => {
    const categoryPath = (await publicPath(request)).filter(path => path.startsWith("/category/"));
    expect(categoryPath).toHaveLength(7);
    await page.goto("/");
    const hrefList = await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link").evaluateAll(list => list.map(link => link.getAttribute("href")));
    expect(hrefList[0]).toBe("/");
    expect(hrefList[1]).toBe("/discover");
    expect(hrefList.slice(2, -1).sort()).toEqual([...categoryPath].sort());
    expect(hrefList.at(-1)).toBe("/about");
    expect(hrefList.filter(href => href === "/about")).toHaveLength(1);
    expect(hrefList).toHaveLength(10);
});

test("About is the last primary navigation stop in keyboard order and is highlighted on its page", async ({ page }) => {
    await page.goto("/about");
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    const about = navigation.getByRole("link", { name: "About", exact: true });
    await expect(about).toHaveAttribute("aria-current", "page");
    await about.focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="Primary navigation"]'))).toBe(false);
    await page.keyboard.press("Shift+Tab");
    await expect(about).toBeFocused();
});
