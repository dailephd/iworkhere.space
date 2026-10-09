import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const SECRET = "PRIVATE-TEXT-VALUE";
const metric = (page: Page, label: string) => page.getByRole("main").locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");

async function expectCounts(page: Page, expected: [string, string, string, string]) {
    const labels = ["Words", "Characters", "Characters excluding whitespace", "Lines"];
    for (const [index, label] of labels.entries()) await expect(metric(page, label)).toHaveText(expected[index]);
}

test("Word / Character Counter route, SEO, breadcrumb, guide and related links are server-rendered", async ({ page, request }) => {
    const response = await request.get("/tool/word-character-counter");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1");
    expect(html).toContain("Word / Character Counter");
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/word-character-counter"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/category/text"');
    for (const text of ["How to use", "Word counting", "Character counting", "Whitespace and lines", "Limits and local processing", "Intl.Segmenter", "1 MiB", "Related text tools"]) expect(html).toContain(text);
    for (const href of ["/tool/slugify", "/tool/html-text-extractor"]) expect(html).toContain(`href="${href}"`);
    await page.goto("/tool/word-character-counter", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Word / Character Counter", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Text" })).toHaveAttribute("href", "/category/text");
    await expect(page.getByRole("main").locator('a[href="/tool/slugify"]').first()).toBeVisible();
});

test("counts live, resets, stays local and fits the viewport", async ({ page }) => {
    const requests: string[] = [];
    await page.goto("/tool/word-character-counter", { waitUntil: "networkidle" });
    page.on("request", request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));
    const input = page.getByLabel("Text", { exact: true });
    await expectCounts(page, ["0", "0", "0", "0"]);

    await input.fill("Hello world\n👩‍💻");
    await expectCounts(page, ["2", "13", "11", "2"]);
    await input.fill(`don’t stop-believing ${SECRET}`);
    await expect(metric(page, "Words")).toHaveText("6");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expectCounts(page, ["0", "0", "0", "0"]);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("");

    expect(requests.filter(value => value.includes(SECRET)), "Text never leaves the browser").toEqual([]);
    expect(requests.filter(value => !value.startsWith("GET")), "No non-GET request while using the tool").toEqual([]);
    expect(new URL(page.url()).search).toBe("");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(SECRET);
});

test("is keyboard operable", async ({ page }) => {
    await page.goto("/tool/word-character-counter", { waitUntil: "networkidle" });
    await page.getByLabel("Text", { exact: true }).focus();
    await page.keyboard.type("one two");
    await expect(metric(page, "Words")).toHaveText("2");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(metric(page, "Words")).toHaveText("0");
});

test("text category, discovery search, home and sitemap include the counter and keep developer", async ({ page, request }) => {
    expect((await page.goto("/category/text"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Text & Code Tool", exact: true })).toBeVisible();
    const tools = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(tools).toHaveCount(3);
    await expect(tools).toContainText(["Slugify Text", "HTML Text Extractor", "Word / Character Counter"]);

    await page.goto("/discover", { waitUntil: "networkidle" });
    await page.getByLabel("Search", { exact: true }).fill("character");
    const results = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(results).toHaveCount(1);
    await expect(results).toHaveAttribute("href", "/tool/word-character-counter");
    await results.click();
    await expect(page).toHaveURL(/\/tool\/word-character-counter$/);

    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(28);
    expect(xml.split("<loc>https://iworkhere.space/tool/word-character-counter</loc>")).toHaveLength(2);
    expect(xml.split("<loc>https://iworkhere.space/category/text</loc>")).toHaveLength(2);
    expect(xml.split("<loc>https://iworkhere.space/category/developer</loc>")).toHaveLength(2);
    expect(xml).not.toMatch(/vercel\.app|<loc>[^<]*[?#]/);
    expect((await page.goto("/category/developer"))?.status()).toBe(200);
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
});
