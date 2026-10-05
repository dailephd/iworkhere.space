import { test, expect } from "./support/fixture";

test("home loads with one main landmark", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByLabel("Search", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Image tools", exact: true })).toBeVisible();
    const imageSection = page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { name: "Image tools", exact: true }) });
    for (const slug of ["image-resizer", "image-compressor", "image-converter", "heic-converter"]) {
        await expect(imageSection.locator(`a[href="/tool/${slug}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(13);
    await expect(page.getByRole("main").getByRole("link", { name: /Image Resizer/ })).toHaveAttribute("href", "/tool/image-resizer");
});

test("discover exposes all thirteen registered tools and reachable routes", async ({ page }) => {
    expect((await page.goto("/discover"))?.status()).toBe(200);
    const catalog = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(catalog).toHaveCount(13);
    const reached = new Set<string>();
    for (let index = 0; index < 13; index += 1) {
        if (index > 0) await page.goto("/discover");
        await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
        await catalog.nth(index).click();
        await expect(page).toHaveURL(/\/tool\/[^/?#]+$/);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
        reached.add(new URL(page.url()).pathname);
    }
    expect([...reached].sort()).toEqual([
        "/tool/calculator", "/tool/heic-converter", "/tool/html-text-extractor", "/tool/image-compressor", "/tool/image-converter", "/tool/image-resizer",
        "/tool/images-to-pdf", "/tool/length-converter", "/tool/merge-pdf", "/tool/slugify", "/tool/split-pdf", "/tool/time-arithmetic", "/tool/weight-converter",
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

test("text category preserves its two known text tools", async ({ page }) => {
    expect((await page.goto("/category/text"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Text & Code Tool", exact: true })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.locator('a[href^="/tool/"]')).toHaveCount(2);
    await expect(main.locator('a[href="/tool/slugify"]')).toContainText("Slugify Text");
    await expect(main.locator('a[href="/tool/html-text-extractor"]')).toContainText("HTML Text Extractor");
});

test("calculator evaluates a deterministic expression", async ({ page }) => {
    expect((await page.goto("/tool/calculator"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Calculator", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
    await page.getByLabel("Expression", { exact: true }).fill("(2 + 3) * 4");
    await expect(page).toHaveURL(/expr=/);
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("20");
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
