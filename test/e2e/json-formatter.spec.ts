import { test, expect } from "./support/fixture";

const SECRET = "PRIVATE-JSON-VALUE";

test("JSON Formatter route, SEO, breadcrumb, guide and related links are server-rendered", async ({ page, request }) => {
    const response = await request.get("/tool/json-formatter");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1");
    expect(html).toContain("JSON Formatter / Validator");
    expect(html).toContain('rel="canonical" href="https://iworkhere.space/tool/json-formatter"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/category/developer"');
    for (const text of ["How to use", "Strict JSON", "RFC 8259", "Token-preserving formatting", "1 MiB", "not uploaded for formatting or validation"]) expect(html).toContain(text);
    for (const href of ["/tool/html-text-extractor", "/tool/slugify"]) expect(html).toContain(`href="${href}"`);
    await page.goto("/tool/json-formatter", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "JSON Formatter / Validator", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Developer" })).toHaveAttribute("href", "/category/developer");
    await expect(page.getByRole("main").getByRole("link", { name: /Slugify/ }).first()).toHaveAttribute("href", "/tool/slugify");
});

test("formats, minifies, rejects invalid JSON, copies and resets locally", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const requests: string[] = [];
    await page.goto("/tool/json-formatter", { waitUntil: "networkidle" });
    page.on("request", request => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));
    const input = page.getByLabel("JSON input", { exact: true });
    const output = page.getByLabel("JSON output", { exact: true });
    const alert = page.getByRole("main").getByRole("alert");

    await input.fill(`{"big":12345678901234567890123,"e":1E+2,"s":"\\u00e9\\/","k":"${SECRET}","d":1,"d":2}`);
    await page.getByRole("button", { name: "Format JSON", exact: true }).click();
    await expect(output).toHaveValue(`{\n  "big": 12345678901234567890123,\n  "e": 1E+2,\n  "s": "\\u00e9\\/",\n  "k": "${SECRET}",\n  "d": 1,\n  "d": 2\n}`);
    await page.getByRole("button", { name: "Minify JSON", exact: true }).click();
    await expect(output).toHaveValue(`{"big":12345678901234567890123,"e":1E+2,"s":"\\u00e9\\/","k":"${SECRET}","d":1,"d":2}`);

    await page.getByRole("button", { name: "Copy result", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copied!", exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await output.inputValue());

    await input.fill('{"a": 1,}');
    await expect(output).toHaveValue("");
    await page.getByRole("button", { name: "Format JSON", exact: true }).click();
    await expect(alert).toHaveText("Trailing commas are not allowed. Line 1, column 9.");
    await expect(output).toHaveValue("");
    await expect(page.getByRole("button", { name: "Copy result", exact: true })).toBeDisabled();

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(input).toHaveValue(""); await expect(output).toHaveValue(""); await expect(alert).toHaveText("");
    await expect(input).toBeFocused();

    expect(requests.filter(value => value.includes(SECRET)), "JSON never leaves the browser").toEqual([]);
    expect(requests.filter(value => !value.startsWith("GET")), "No non-GET request while using the tool").toEqual([]);
    expect(new URL(page.url()).search).toBe("");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(SECRET);
});

test("is keyboard operable and does not overflow the page", async ({ page }) => {
    await page.goto("/tool/json-formatter", { waitUntil: "networkidle" });
    const input = page.getByLabel("JSON input", { exact: true });
    await input.fill("[1,2]");
    await input.focus();
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Format JSON", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("JSON output", { exact: true })).toHaveValue("[\n  1,\n  2\n]");
    await input.fill(`[${"1234567890,".repeat(60)}1]`);
    await page.getByRole("button", { name: "Minify JSON", exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("developer category, discovery search, home chip and sitemap include JSON Formatter", async ({ page, request }) => {
    expect((await page.goto("/category/developer"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Developer Tool", exact: true })).toBeVisible();
    const tools = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(tools).toHaveCount(1);
    await expect(tools).toContainText("JSON Formatter / Validator");

    await page.goto("/discover", { waitUntil: "networkidle" });
    await page.getByLabel("Search", { exact: true }).fill("json");
    const results = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(results).toHaveCount(1);
    await expect(results).toHaveAttribute("href", "/tool/json-formatter");
    await results.click();
    await expect(page).toHaveURL(/\/tool\/json-formatter$/);

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('a[data-category="developer"][href="/category/developer"]')).toHaveCount(1);

    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(26);
    for (const route of ["/tool/json-formatter", "/category/developer"]) expect(xml.split(`<loc>https://iworkhere.space${route}</loc>`)).toHaveLength(2);
    expect(xml).not.toMatch(/vercel\.app|<loc>[^<]*[?#]/);
    expect((await request.get("/category/unknown")).status()).toBe(404);
});
