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

const expected404 = "Failed to load resource: the server responded with a status of 404 (Not Found)";

// A 404 response logs one browser resource message; every other console error or page error still fails.
// Next adds its own noindex tag beside the page metadata; every robots tag must forbid indexing.
async function expectOnlyNoindex(page: import("@playwright/test").Page) {
    const content = await page.locator('meta[name="robots"]').evaluateAll(list => list.map(node => node.getAttribute("content") ?? ""));
    expect(content.length).toBeGreaterThan(0);
    for (const value of content) expect(value).toContain("noindex");
}

async function openInvalidPage(browser: import("@playwright/test").Browser, viewport: import("@playwright/test").ViewportSize | null) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const unexpected: string[] = [];
    page.on("pageerror", error => unexpected.push(error.message));
    page.on("console", message => {
        if (message.type() === "error" && message.text() !== expected404) unexpected.push(message.text());
    });
    return { context, page, unexpected };
}

test("a directly requested invalid URL returns 404 with the exact title and noindex", async ({ browser, request }, testInfo) => {
    const { context, page, unexpected } = await openInvalidPage(browser, testInfo.project.use.viewport ?? null);
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    expect(await page.title()).toBe("iworkhere");
    await expectOnlyNoindex(page);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("no-such-page");
    expect(unexpected).toEqual([]);
    await context.close();
});

test("client-side navigation to an invalid URL keeps the exact title and noindex", async ({ browser }, testInfo) => {
    const { context, page, unexpected } = await openInvalidPage(browser, testInfo.project.use.viewport ?? null);
    await page.goto("/");
    await page.evaluate(() => (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push("/no-such-page"));
    await expect(page).toHaveURL(/\/no-such-page$/);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.poll(() => page.title()).toBe("iworkhere");
    await expectOnlyNoindex(page);
    expect(unexpected).toEqual([]);
    await context.close();
});
