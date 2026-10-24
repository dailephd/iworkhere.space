import { test, expect } from "./support/fixture";

test("home loads with one main landmark", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByLabel("Search", { exact: true })).toBeVisible();
    const categories = ["Document", "Text", "Math", "Converters", "Time", "Image", "Developer"];
    const islands = page.locator('[data-surface="section-island"]');
    await expect(islands).toHaveCount(categories.length);
    for (const category of categories) {
        await expect(page.getByRole("region", { name: category === "Converters" ? category : `${category} tools`, exact: true })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: category, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("main").getByRole("link", { name: "All tools", exact: true })).toHaveAttribute("href", "/discover");
    const imageSection = page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { name: "Image tools", exact: true }) });
    for (const slug of ["image-resizer", "image-compressor", "image-converter", "heic-converter"]) {
        await expect(imageSection.locator(`a[href="/tool/${slug}"]`)).toHaveCount(1);
    }
    // The eighteen registry cards stay exactly once each; the five featured task links are additional entry points, not cards.
    await expect(page.getByRole("main").locator('a.catalog-card[href^="/tool/"]')).toHaveCount(18);
    await expect(page.getByRole("main").locator('a.catalog-card').filter({ hasText: /Image Resizer/ })).toHaveAttribute("href", "/tool/image-resizer");
    await expect(page.getByRole("main").locator('[data-featured-task] a[href^="/tool/"]')).toHaveCount(5);
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(23);
    await expect(page.getByRole("main").locator('[data-featured-task="image-resizer"]').getByRole("link", { name: "Image Resizer", exact: true })).toHaveAttribute("href", "/tool/image-resizer");
});

test("discover exposes all eighteen registered tools and reachable routes", async ({ page }) => {
    expect((await page.goto("/discover"))?.status()).toBe(200);
    const catalog = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(catalog).toHaveCount(18);
    const reached = new Set<string>();
    for (let index = 0; index < 18; index += 1) {
        if (index > 0) await page.goto("/discover");
        await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
        await catalog.nth(index).click();
        await expect(page).toHaveURL(/\/tool\/[^/?#]+$/);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
        reached.add(new URL(page.url()).pathname);
    }
    expect([...reached].sort()).toEqual([
        "/tool/calculator", "/tool/compress-pdf", "/tool/heic-converter", "/tool/html-text-extractor", "/tool/image-compressor", "/tool/image-converter", "/tool/image-resizer",
        "/tool/images-to-pdf", "/tool/json-formatter", "/tool/length-converter", "/tool/merge-pdf", "/tool/pdf-to-image", "/tool/qr-code-generator", "/tool/slugify", "/tool/split-pdf", "/tool/time-arithmetic", "/tool/weight-converter", "/tool/word-character-counter",
    ]);
});

test("shared search filters registered tags and destinations remain links", async ({ page }) => {
    await page.goto("/discover");
    const search = page.getByLabel("Search", { exact: true });
    await search.fill("heif");
    const results = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(results).toHaveCount(1);
    await expect(results).toHaveAttribute("href", "/tool/heic-converter");
    await expect(results).toHaveText(/HEIC → JPG \/ PNG Converter/);
});

test("text category lists its three registered text tools", async ({ page }) => {
    expect((await page.goto("/category/text"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Text Tools", exact: true })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.locator('a[href^="/tool/"]')).toHaveCount(3);
    await expect(main.locator('a[href="/tool/slugify"]')).toContainText("Slugify Text");
    await expect(main.locator('a[href="/tool/html-text-extractor"]')).toContainText("HTML Text Extractor");
    await expect(main.locator('a[href="/tool/word-character-counter"]')).toContainText("Word / Character Counter");
});

test("calculator evaluates a deterministic expression", async ({ page }) => {
    expect((await page.goto("/tool/calculator"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Calculator", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await page.getByLabel("Expression", { exact: true }).fill("(2 + 3) * 4");
    await expect(page).toHaveURL(/expr=/);
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("20");

    const expression = page.getByLabel("Expression", { exact: true });
    await expression.fill("2 + 3 * 4");
    await expression.press("=");
    await expect(page.locator("output")).toHaveText("14");
    await expect(expression).toHaveValue("2 + 3 * 4");
    await page.getByRole("button", { name: "=", exact: true }).click();
    await expect(page.locator("output")).toHaveText("14");
    await expression.fill("2+");
    await expression.press("=");
    await expect(page.locator("output")).toHaveCount(0);
    await expect(page.getByText("Invalid expression.", { exact: true })).toBeVisible();
});

test("time arithmetic carries minutes in a deterministic example", async ({ page }) => {
    expect((await page.goto("/tool/time-arithmetic"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Time Arithmetic", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await page.getByLabel("Time A", { exact: true }).fill("01:50");
    await page.getByLabel("Operation", { exact: true }).selectOption("add");
    await page.getByLabel("Time B", { exact: true }).fill("00:20");
    await expect(page.getByRole("main").getByText("02:10", { exact: true })).toBeVisible();
});

test("unknown tool slug returns an actual 404 response", async ({ request }) => {
    const response = await request.get("/tool/batch-1-unknown-tool");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("404");
});

test("health endpoint succeeds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
});
