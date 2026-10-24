import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "./support/fixture";

const FEATURED = [
    { slug: "compress-pdf", name: "Compress PDF" },
    { slug: "pdf-to-image", name: "PDF to JPG / PNG" },
    { slug: "images-to-pdf", name: "Images to PDF" },
    { slug: "image-resizer", name: "Image Resizer" },
    { slug: "image-converter", name: "JPG / PNG / WebP Converter" },
] as const;
const CATEGORY = ["document", "text", "math", "converter", "time", "image", "developer"] as const;
const TOOL_COUNT = 18;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
async function expectFooterReachable(page: import("@playwright/test").Page) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("contentinfo")).toBeInViewport();
    const end = await page.evaluate(() => ({
        mainEndsAboveFooter: document.querySelector("main")!.getBoundingClientRect().bottom <= document.querySelector("footer")!.getBoundingClientRect().top + 1,
        atEnd: window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1,
    }));
    expect(end).toEqual({ mainEndsAboveFooter: true, atEnd: true });
}

test.describe("home page task entry points", () => {
    test("shows the five featured tasks above search, linked to the registered tools, beside all eighteen unchanged cards", async ({ page }) => {
        expect((await page.goto("/"))?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        const section = page.getByRole("region", { name: "Start with a common task", exact: true });
        await expect(section).toBeVisible();
        await expect(section).toContainText("Five common jobs");
        await expect(section).not.toContainText(/most popular|trending|recommended for you|top rated|most downloaded/i);
        const task = section.locator("[data-featured-task]");
        await expect(task).toHaveCount(FEATURED.length);
        for (const [index, one] of FEATURED.entries()) {
            await expect(task.nth(index)).toHaveAttribute("data-featured-task", one.slug);
            await expect(task.nth(index).getByRole("link")).toHaveCount(1);
            await expect(task.nth(index).getByRole("link", { name: one.name, exact: true })).toHaveAttribute("href", `/tool/${one.slug}`);
        }
        const main = page.getByRole("main");
        await expect(main.locator('a.catalog-card[href^="/tool/"]')).toHaveCount(TOOL_COUNT);
        await expect(section.locator("a.catalog-card")).toHaveCount(0);
        const order = await page.evaluate(() => {
            const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top;
            return { task: top("[data-featured-task-section]"), search: top("#main-content input, main input"), card: top("main a.catalog-card") };
        });
        expect(order.task).toBeLessThan(order.search);
        expect(order.search).toBeLessThan(order.card);
        await expectNoHorizontalOverflow(page);
        await expectFooterReachable(page);
    });

    for (const one of FEATURED) {
        test(`the ${one.slug} task link opens its real tool and example`, async ({ page }) => {
            await page.goto("/");
            const link = page.locator(`[data-featured-task="${one.slug}"]`).getByRole("link", { name: one.name, exact: true });
            await link.focus();
            await expect(link).toBeFocused();
            await page.keyboard.press("Enter");
            await expect(page).toHaveURL(new RegExp(`/tool/${one.slug}$`));
            await expect(page.getByRole("heading", { level: 1, name: one.name, exact: true })).toBeVisible();
            await expect(page.getByRole("region", { name: "Worked example", exact: true })).toBeVisible();
        });
    }

    test("keyboard order reaches the featured tasks, then search, with the tool cards still reachable in order", async ({ page }) => {
        await page.goto("/");
        const first = page.locator("[data-featured-task] a").first();
        await first.focus();
        for (const one of FEATURED) {
            await expect(page.locator(`[data-featured-task="${one.slug}"] a`)).toBeFocused();
            await page.keyboard.press("Tab");
        }
        await expect(page.getByLabel("Search", { exact: true })).toBeFocused();
    });

    test("search still filters the home page and leaves task links alone", async ({ page }) => {
        await page.goto("/");
        const search = page.getByLabel("Search", { exact: true });
        await search.fill("qr");
        // Existing behavior: matching results are listed above the unchanged category cards, so the tool appears as a result and a card.
        await expect(page.getByRole("main").locator('a[href="/tool/qr-code-generator"]')).toHaveCount(2);
        await expect(page.getByRole("main").locator('a[href="/tool/qr-code-generator"]').first()).toBeVisible();
        await expect(page.locator("[data-featured-task]")).toHaveCount(FEATURED.length);
        await search.fill("zzzz-no-such-tool");
        await expect(page.getByRole("main")).toContainText(/no tool|no result|no match/i);
        await search.fill("");
    });

    test("every category link on the home page resolves", async ({ page, request }) => {
        await page.goto("/");
        for (const category of CATEGORY) {
            await expect(page.getByRole("main").locator(`a[data-category="${category}"][href="/category/${category}"]`)).toHaveCount(1);
            expect((await request.get(`/category/${category}`)).status()).toBe(200);
        }
    });
});

test.describe("discover page", () => {
    test("explains search versus category browsing, links the seven categories and keeps all eighteen tools", async ({ page, request }) => {
        expect((await page.goto("/discover"))?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1, name: "All tools", exact: true })).toBeVisible();
        const main = page.getByRole("main");
        await expect(main).toContainText("Search for a tool by name or task, or browse by category");
        await expect(main).not.toContainText(/everyday/i);
        const category = main.getByRole("region", { name: "Browse by category", exact: true }).getByRole("link");
        await expect(category).toHaveCount(CATEGORY.length);
        expect(await category.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(CATEGORY.map(id => `/category/${id}`));
        for (const id of CATEGORY) expect((await request.get(`/category/${id}`)).status()).toBe(200);
        await expect(main.locator('a[href^="/tool/"]')).toHaveCount(TOOL_COUNT);
        await expectNoHorizontalOverflow(page);
        await expectFooterReachable(page);
    });

    test("search and tag filtering behave as before", async ({ page }) => {
        await page.goto("/discover");
        const search = page.getByLabel("Search", { exact: true });
        await search.fill("merge");
        await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
        await expect(page.getByRole("main").locator('a[href="/tool/merge-pdf"]')).toBeVisible();
        await search.fill("");
        await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(TOOL_COUNT);
        const tag = page.getByRole("main").getByRole("button").filter({ hasText: /^(pdf|image|text|math|time|developer|utility|converter)$/i }).first();
        if (await tag.count()) {
            await tag.click();
            const filtered = await page.getByRole("main").locator('a[href^="/tool/"]').count();
            expect(filtered).toBeGreaterThan(0);
            expect(filtered).toBeLessThan(TOOL_COUNT);
        }
    });
});

test.describe("category task guidance", () => {
    for (const id of CATEGORY) {
        test(`${id}: identity, guidance and registered tools in reading order without overflow`, async ({ page }) => {
            expect((await page.goto(`/category/${id}`))?.status()).toBe(200);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            const guidance = page.getByRole("region", { name: "Choosing a tool", exact: true });
            await expect(guidance).toBeVisible();
            await expect(guidance).toContainText("Keep in mind:");
            await expect(guidance.getByRole("link")).toHaveCount(0);
            const tools = page.getByRole("region", { name: "Available tools", exact: true });
            await expect(tools).toBeVisible();
            expect(await tools.locator('a[href^="/tool/"]').count()).toBeGreaterThan(0);
            await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(await tools.locator('a[href^="/tool/"]').count());
            const order = await page.evaluate(() => {
                const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top;
                return { h1: top("h1"), guidance: top("#category-guidance-title"), tools: top("#category-tool-title") };
            });
            expect(order.h1).toBeLessThan(order.guidance);
            expect(order.guidance).toBeLessThan(order.tools);
            await expectNoHorizontalOverflow(page);
            await expectFooterReachable(page);
        });
    }

    test("category guidance differs between categories", async ({ page }) => {
        const text = new Set<string>();
        for (const id of CATEGORY) {
            await page.goto(`/category/${id}`);
            text.add((await page.getByRole("region", { name: "Choosing a tool", exact: true }).innerText()).trim());
        }
        expect(text.size).toBe(CATEGORY.length);
    });

    test("Math and Time stay honest one-tool categories and the historical converter route still redirects", async ({ page, request }) => {
        await page.goto("/category/math");
        await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
        await expect(page.getByRole("main")).toContainText("not arbitrary-precision arithmetic");
        await page.goto("/category/time");
        await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(1);
        await expect(page.getByRole("main")).toContainText("does not convert time zones");
        const redirect = await request.get("/category/everyday", { maxRedirects: 0 });
        expect(redirect.status()).toBe(308);
        expect(redirect.headers().location).toBe("/category/converter");
        // Math and Time stay in the sitemap under the existing indexing policy.
        const sitemap = await (await request.get("/sitemap.xml")).text();
        expect(sitemap).toContain("<loc>https://iworkhere.space/category/math</loc>");
        expect(sitemap).toContain("<loc>https://iworkhere.space/category/time</loc>");
    });
});

test.describe("tool example panel accessibility", () => {
    test("example images have meaningful alt text and PDF links have descriptive names", async ({ page }) => {
        await page.goto("/tool/image-converter");
        const image = page.getByRole("region", { name: "Worked example", exact: true }).locator("img[data-example-asset]");
        await expect(image).toHaveCount(3);
        for (const alt of await image.evaluateAll(elements => elements.map(element => element.getAttribute("alt") ?? ""))) {
            expect(alt.length).toBeGreaterThan(40);
            expect(alt).not.toMatch(/\.(png|jpe?g|webp)\b|^Preview of/i);
        }
        await page.goto("/tool/compress-pdf");
        const pdf = page.getByRole("region", { name: "Worked example", exact: true }).getByRole("link", { name: /^Download (source|result) PDF: .+\(.+\)$/ });
        await expect(pdf).toHaveCount(2);
    });

    test("the thirteen tools without an example still render no example panel", async ({ page }) => {
        const registry = readFileSync(resolve(process.cwd(), "src/module/tool/registry.ts"), "utf8");
        const slugs = [...registry.matchAll(/slug:\s*"([^"]+)"/g)].map(match => match[1]).filter(slug => !FEATURED.some(one => one.slug === slug));
        expect(slugs).toHaveLength(TOOL_COUNT - FEATURED.length);
        for (const slug of slugs) {
            await page.goto(`/tool/${slug}`);
            await expect(page.getByRole("region", { name: "Worked example", exact: true })).toHaveCount(0);
        }
    });
});
