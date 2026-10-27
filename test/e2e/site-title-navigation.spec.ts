import { test, expect } from "./support/fixture";

// The sitemap is the existing list of public routes: 5 site pages, 18 tools and 7 categories.
async function publicPath(request: import("@playwright/test").APIRequestContext): Promise<string[]> {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
}

// Independent expectation for all 30 sitemap identities; production code keeps no second title table.
const expectedTitle: Record<string, string> = {
    "/": "Browser Tools for PDFs, Images and Text - iworkhere",
    "/discover": "All Tools - iworkhere",
    "/about": "About - iworkhere",
    "/contact": "Contact Us - iworkhere",
    "/privacy": "Privacy Policy - iworkhere",
    "/category/document": "PDF Tools - iworkhere",
    "/category/image": "Image Tools - iworkhere",
    "/category/text": "Text Tools - iworkhere",
    "/category/math": "Math Tools - iworkhere",
    "/category/converter": "Converters - iworkhere",
    "/category/time": "Time Tools - iworkhere",
    "/category/developer": "Developer Tools - iworkhere",
    "/tool/merge-pdf": "Merge PDF Files Online - iworkhere",
    "/tool/split-pdf": "Split PDF Pages Online - iworkhere",
    "/tool/images-to-pdf": "Images to PDF Converter - iworkhere",
    "/tool/pdf-to-image": "PDF to JPG and PNG Converter - iworkhere",
    "/tool/compress-pdf": "Compress PDF Files Online - iworkhere",
    "/tool/slugify": "Slug Generator - iworkhere",
    "/tool/calculator": "Online Calculator - iworkhere",
    "/tool/length-converter": "Length Converter - iworkhere",
    "/tool/html-text-extractor": "HTML to Text Converter - iworkhere",
    "/tool/weight-converter": "Weight Converter - iworkhere",
    "/tool/time-arithmetic": "Add and Subtract Time - iworkhere",
    "/tool/image-resizer": "Image Resizer - iworkhere",
    "/tool/image-compressor": "Image Compressor - iworkhere",
    "/tool/image-converter": "JPG, PNG and WebP Converter - iworkhere",
    "/tool/heic-converter": "HEIC to JPG and PNG Converter - iworkhere",
    "/tool/json-formatter": "JSON Formatter and Validator - iworkhere",
    "/tool/word-character-counter": "Word and Character Counter - iworkhere",
    "/tool/qr-code-generator": "QR Code Generator - iworkhere",
};
const notFoundTitle = "Page Not Found - iworkhere";

test("every public URL has its descriptive browser title in initial HTML and the live DOM, with its own canonical path and description", async ({ page, request }) => {
    const pathList = await publicPath(request);
    expect(pathList).toHaveLength(30);
    expect(new Set(pathList).size).toBe(30);
    expect([...pathList].sort()).toEqual(Object.keys(expectedTitle).sort());
    expect(new Set(Object.values(expectedTitle)).size).toBe(30);
    const descriptionList = new Set<string>();
    for (const path of pathList) {
        const html = await (await request.get(path)).text();
        expect(html.match(/<title>([^<]*)<\/title>/g), path).toEqual([`<title>${expectedTitle[path]}</title>`]);
        await page.goto(path);
        expect(await page.title(), path).toBe(expectedTitle[path]);
        expect(await page.evaluate(() => document.title)).toBe(expectedTitle[path]);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", path === "/" ? "https://iworkhere.space" : `https://iworkhere.space${path}`);
        const description = await page.locator('meta[name="description"]').getAttribute("content");
        expect(description, path).toBeTruthy();
        descriptionList.add(description!);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", expect.stringMatching(/ — iworkhere\.space$/));
    }
    expect(descriptionList.size, "page-specific descriptions").toBeGreaterThanOrEqual(25);
});

test("the browser title stays correct after client-side navigation, reload, history and query state", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => page.title()).toBe(expectedTitle["/"]);
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const name of ["All tools", "About"]) {
        await navigation.getByRole("link", { name, exact: true }).click();
        await expect(page).toHaveURL(name === "About" ? /\/about$/ : /\/discover$/);
        await expect.poll(() => page.title()).toBe(expectedTitle[name === "About" ? "/about" : "/discover"]);
    }
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect.poll(() => page.title()).toBe(expectedTitle["/privacy"]);
    await page.reload();
    await expect.poll(() => page.title()).toBe(expectedTitle["/privacy"]);
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
    await expect.poll(() => page.title()).toBe(expectedTitle["/about"]);
    await page.goForward();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect.poll(() => page.title()).toBe(expectedTitle["/privacy"]);
});

test("a query-bearing tool URL keeps its title and a query-free canonical", async ({ page }) => {
    await page.goto("/tool/calculator?a=10&b=2");
    await expect.poll(() => page.title()).toBe(expectedTitle["/tool/calculator"]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/tool/calculator");
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
    expect(await page.title()).toBe(notFoundTitle);
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
    await expect.poll(() => page.title()).toBe(notFoundTitle);
    await expectOnlyNoindex(page);
    expect(unexpected).toEqual([]);
    await context.close();
});
