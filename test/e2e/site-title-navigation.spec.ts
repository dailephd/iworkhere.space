import { test, expect } from "./support/fixture";

// The sitemap is the existing list of public routes: 5 site pages, 18 tools, 7 categories, the Workflows hub, its 4 workflows, and the guide hub (the 4 former manual guides now redirect and are not listed).
async function publicPath(request: import("@playwright/test").APIRequestContext): Promise<string[]> {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
}

// Independent expectation for all 36 sitemap identities; production code keeps no second title table.
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
    "/workflows": "Workflows - iworkhere",
    "/workflows/prepare-image-for-upload": "Prepare an Image for Upload - iworkhere",
    "/workflows/heic-photos-to-pdf": "HEIC Photos to PDF - iworkhere",
    "/workflows/assemble-pdf-packet": "Assemble a PDF Packet - iworkhere",
    "/workflows/pdf-pages-for-slides": "PDF Pages for Slides - iworkhere",
    "/guide": "Find the Right Tool or Workflow - iworkhere",
};
const notFoundTitle = "Page Not Found - iworkhere";

test("every public URL has its descriptive browser title in initial HTML and the live DOM, with its own canonical path and description", async ({ page, request }) => {
    const pathList = await publicPath(request);
    expect(pathList).toHaveLength(36);
    expect(new Set(pathList).size).toBe(36);
    expect([...pathList].sort()).toEqual(Object.keys(expectedTitle).sort());
    expect(new Set(Object.values(expectedTitle)).size).toBe(36);
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
    await revealNavigation(page);
    await navigation.getByRole("link", { name: "All tools", exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect.poll(() => page.title()).toBe(expectedTitle["/discover"]);
    await page.getByRole("contentinfo").getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect.poll(() => page.title()).toBe(expectedTitle["/about"]);
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

// Below 1024px every destination sits inside the Menu, so open it before reading the links.
async function revealNavigation(page: import("@playwright/test").Page) {
    if ((page.viewportSize()?.width ?? 1280) < 1024) await page.getByRole("button", { name: "Menu", exact: true }).click();
}

test("primary navigation is Home, All tools, Workflows, Guides, with the populated categories in a separate list in registry order", async ({ page, request }) => {
    const categoryPath = (await publicPath(request)).filter(path => path.startsWith("/category/"));
    expect(categoryPath).toHaveLength(7);
    await page.goto("/");
    await revealNavigation(page);
    const primary = await page.locator('nav[aria-label="Primary navigation"] [data-primary-nav-list] > li > a').evaluateAll(list => list.map(link => link.getAttribute("href")));
    expect(primary).toEqual(["/", "/discover", "/workflows", "/guide"]);
    const category = await page.locator('nav[aria-label="Primary navigation"] [data-category-nav-list] a').evaluateAll(list => list.map(link => link.getAttribute("href")));
    expect(category).toHaveLength(7);
    expect([...category].sort()).toEqual([...categoryPath].sort());
    // Hidden desktop dropdown links are not in the role tree, so count the DOM anchors: four primary plus seven categories.
    await expect(page.locator('nav[aria-label="Primary navigation"] a')).toHaveCount(11);
});

test("Guides is the last primary link in keyboard order, the category disclosure follows it, and About is only in the footer", async ({ page }) => {
    await page.goto("/about");
    await revealNavigation(page);
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(navigation.locator('a[href="/about"]')).toHaveCount(0);
    const guides = navigation.getByRole("link", { name: "Guides", exact: true });
    await guides.focus();
    await page.keyboard.press("Tab");
    // After Guides the next stop is still inside navigation: the Categories disclosure on desktop, the first category link in the Menu.
    expect(await page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="Primary navigation"]'))).toBe(true);
    if ((page.viewportSize()?.width ?? 1280) >= 1024) await expect(page.getByRole("button", { name: "Categories", exact: true })).toBeFocused();
    else await expect(navigation.locator('[data-category-nav-list] a').first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(guides).toBeFocused();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "About", exact: true })).toHaveCount(1);
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
