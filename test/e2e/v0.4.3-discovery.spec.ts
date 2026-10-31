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

test.describe("home page catalog entry points", () => {
    test("is the catalog only: all eighteen cards after search, with no featured-task or workflow sections", async ({ page }) => {
        expect((await page.goto("/"))?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByRole("region", { name: "Start with a common task", exact: true })).toHaveCount(0);
        await expect(page.getByText("Practical file workflows")).toHaveCount(0);
        await expect(page.locator("[data-featured-task], [data-featured-task-section], [data-workflow-section]")).toHaveCount(0);
        const main = page.getByRole("main");
        await expect(main.locator('a.catalog-card[href^="/tool/"]')).toHaveCount(TOOL_COUNT);
        await expect(main.locator('a[href^="/guide"]')).toHaveCount(0);
        const order = await page.evaluate(() => {
            const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top;
            return { search: top("#main-content input, main input"), card: top("main a.catalog-card") };
        });
        expect(order.search).toBeLessThan(order.card);
        await expectNoHorizontalOverflow(page);
        await expectFooterReachable(page);
    });

    for (const one of FEATURED) {
        test(`the ${one.slug} catalog card opens its real tool and example`, async ({ page }) => {
            await page.goto("/");
            const link = page.locator(`a.catalog-card[href="/tool/${one.slug}"]`);
            await expect(link).toHaveAccessibleName(one.name);
            await link.focus();
            await expect(link).toBeFocused();
            await page.keyboard.press("Enter");
            await expect(page).toHaveURL(new RegExp(`/tool/${one.slug}$`));
            await expect(page.getByRole("heading", { level: 1, name: one.name, exact: true })).toBeVisible();
            await expect(page.getByRole("region", { name: "Worked example", exact: true })).toBeVisible();
        });
    }

    test("keyboard order reaches search, then the seven category links, then the first tool card", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1, name: "Browser utilities for files, text and numbers", exact: true })).toBeVisible();
        await page.getByLabel("Search", { exact: true }).focus();
        for (const id of CATEGORY) {
            await page.keyboard.press("Tab");
            await expect(page.getByRole("navigation", { name: "Browse categories", exact: true }).locator(`a[href="/category/${id}"]`)).toBeFocused();
        }
        await page.keyboard.press("Tab");
        await expect(page.locator("main a.catalog-card").first()).toBeFocused();
    });

    test("search still filters the home page results while the catalog stays complete", async ({ page }) => {
        await page.goto("/");
        const search = page.getByLabel("Search", { exact: true });
        await search.fill("qr");
        // Prompt 8: a query replaces the catalog with ONE result list, so the QR tool appears once and no catalog card remains;
        // clearing the query restores the complete catalog.
        await expect(page.getByRole("main").locator('a[href="/tool/qr-code-generator"]')).toHaveCount(1);
        await expect(page.getByRole("main").locator('a[href="/tool/qr-code-generator"]').first()).toBeVisible();
        await expect(page.locator("main a.catalog-card")).toHaveCount(0);
        await search.fill("");
        await expect(page.locator("main a.catalog-card")).toHaveCount(TOOL_COUNT);
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
        await expect(main).toContainText("Search by tool name or task");
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
        test(`${id}: identity, registered tools and guidance in reading order without overflow`, async ({ page }) => {
            expect((await page.goto(`/category/${id}`))?.status()).toBe(200);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
            // Prompt 8 (AUD-024): one-tool categories show "Before you use it" instead of restating the task and a one-item list.
            const guidance = page.getByRole("region", { name: id === "math" || id === "time" ? "Before you use it" : "Choosing a tool", exact: true });
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
            // AUD-031: tool cards precede the guidance so the first usable card is in the first mobile viewport.
            expect(order.h1).toBeLessThan(order.tools);
            expect(order.tools).toBeLessThan(order.guidance);
            await expectNoHorizontalOverflow(page);
            await expectFooterReachable(page);
        });
    }

    test("category guidance differs between categories", async ({ page }) => {
        const text = new Set<string>();
        for (const id of CATEGORY) {
            await page.goto(`/category/${id}`);
            text.add((await page.locator("#category-guidance-title").locator("..").innerText()).trim());
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

    test("the nine tools without an example still render no example panel", async ({ page }) => {
        // v0.4.4 Batch 4 added examples to four more tools; they are not home-page tasks, so FEATURED stays at five.
        const added = ["merge-pdf", "split-pdf", "image-compressor", "heic-converter"];
        const registry = readFileSync(resolve(process.cwd(), "src/module/tool/registry.ts"), "utf8");
        const slugs = [...registry.matchAll(/slug:\s*"([^"]+)"/g)].map(match => match[1]).filter(slug => !FEATURED.some(one => one.slug === slug) && !added.includes(slug));
        expect(slugs).toHaveLength(TOOL_COUNT - FEATURED.length - added.length);
        for (const slug of slugs) {
            await page.goto(`/tool/${slug}`);
            await expect(page.getByRole("region", { name: "Worked example", exact: true })).toHaveCount(0);
        }
    });
});

const APPEARANCE = [
    { name: "original light", palette: "original", theme: "light", scheme: "light" },
    { name: "original dark", palette: "original", theme: "dark", scheme: "dark" },
    { name: "original one dark", palette: "original", theme: "onedark", scheme: "dark" },
    { name: "original system (dark)", palette: "original", theme: "system", scheme: "dark" },
    { name: "mineral light", palette: "mineral", theme: "light", scheme: "light" },
    { name: "cobalt dark", palette: "cobalt", theme: "dark", scheme: "dark" },
] as const;

test.describe("home page Colorfield presentation", () => {
    for (const appearance of APPEARANCE) {
        test(`${appearance.name}: complete colorful catalog with readable, non-overflowing layout`, async ({ page }, info) => {
            const mobile = info.project.name === "mobile-chromium";
            await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
            await page.emulateMedia({ colorScheme: appearance.scheme });
            await page.addInitScript(value => {
                localStorage.setItem("palette", JSON.stringify(value.palette));
                localStorage.setItem("theme", JSON.stringify(value.theme));
            }, appearance);
            expect((await page.goto("/"))?.status()).toBe(200);
            await expect(page.getByRole("heading", { level: 1, name: "Browser utilities for files, text and numbers", exact: true })).toHaveCount(1);
            await expect(page.getByRole("main")).not.toContainText(/\b\d+\s+(?:browser\s+)?(?:tools?|categories)\b/i);
            const card = page.locator("main a.catalog-card");
            await expect(card).toHaveCount(TOOL_COUNT);
            const catalog = await page.evaluate(() => {
                const parse = (color: string): number[] => {
                    const canvas = document.createElement("canvas").getContext("2d")!;
                    canvas.fillStyle = "#000"; canvas.fillStyle = color;
                    canvas.clearRect(0, 0, 1, 1); canvas.fillRect(0, 0, 1, 1);
                    return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)];
                };
                const lum = ([r, g, b]: number[]) => {
                    const [x, y, z] = [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
                    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
                };
                const contrast = (foreground: Element, background: Element) => {
                    const a = lum(parse(getComputedStyle(foreground).color)), b = lum(parse(getComputedStyle(background).backgroundColor));
                    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                };
                const hero = document.querySelector("[data-home-hero]")!;
                const island = [...document.querySelectorAll(".home-board .section-island")];
                const firstCard = document.querySelector("a.catalog-card")!;
                const header = document.querySelector("header")!.getBoundingClientRect();
                return {
                    heroContrast: [contrast(hero.querySelector("h1")!, hero), contrast(hero.querySelector("p")!, hero)],
                    boardContrast: island.map(one => contrast(one.querySelector("h2")!, one)),
                    boardDescription: island.map(one => contrast(one.querySelector(":scope > p")!, one)),
                    cardContrast: [contrast(firstCard.querySelector("h3")!, firstCard), contrast(firstCard.querySelector("p")!, firstCard)],
                    boardColor: new Set(island.map(one => getComputedStyle(one).backgroundColor)).size,
                    boardMatchesPage: island.some(one => getComputedStyle(one).backgroundColor === getComputedStyle(document.body).backgroundColor),
                    clipped: [...document.querySelectorAll("a.catalog-card p")].filter(p => p.scrollHeight > p.clientHeight + 1 || getComputedStyle(p).webkitLineClamp !== "none").length,
                    columns: getComputedStyle(document.querySelector(".home-board ul")!).gridTemplateColumns.split(" ").length,
                    heroTop: hero.getBoundingClientRect().top + scrollY,
                    heroHeight: hero.getBoundingClientRect().height,
                    headerBottom: header.bottom,
                };
            });
            for (const ratio of [...catalog.heroContrast, ...catalog.boardContrast, ...catalog.boardDescription, ...catalog.cardContrast]) expect(ratio).toBeGreaterThanOrEqual(4.5);
            expect(catalog.boardColor).toBe(CATEGORY.length);
            expect(catalog.boardMatchesPage).toBe(false);
            expect(catalog.clipped).toBe(0);
            // Compact catalog: one card column on mobile and three at 1440px; the seven boards themselves always stack in one column.
            expect(catalog.columns).toBe(mobile ? 1 : 3);
            expect(catalog.heroTop).toBeGreaterThanOrEqual(catalog.headerBottom - 1);
            if (!mobile) expect(catalog.heroHeight).toBeLessThanOrEqual(260);
            // Cards carry category identity through data-category and no decorative per-tool icon.
            for (const one of await card.all()) {
                await expect(one.locator("svg")).toHaveCount(0);
                await expect(one).toHaveAttribute("data-category", /^(document|text|math|converter|time|image|developer)$/);
            }
            await expectNoHorizontalOverflow(page);
            await page.screenshot({ path: info.outputPath(`home-${appearance.name.replace(/[^a-z]+/g, "-")}-top.png`) });
            await page.screenshot({ path: info.outputPath(`home-${appearance.name.replace(/[^a-z]+/g, "-")}-full.png`), fullPage: true });
            await expectFooterReachable(page);
        });
    }

    test("search results, no-match message and keyboard focus keep working on the colorful home page", async ({ page }) => {
        await page.goto("/");
        const search = page.getByLabel("Search", { exact: true });
        await expect(search).toHaveAttribute("placeholder", "Search tools or tasks");
        await search.fill("QR");
        await expect(page.getByRole("main").locator('a[href="/tool/qr-code-generator"]')).toHaveCount(1);
        await search.fill("zzzz-no-such-tool");
        await expect(page.getByRole("status")).toHaveText("No tools found. Try a different name or task.");
        await expect(page.locator("main a.catalog-card")).toHaveCount(0);
        await search.fill("");
        await expect(page.locator("main a.catalog-card")).toHaveCount(TOOL_COUNT);
        await search.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => { const style = getComputedStyle(document.activeElement!); return { tag: document.activeElement!.tagName, outline: style.outlineStyle, width: style.outlineWidth }; });
        expect(focus.tag).toBe("A");
        expect(focus.outline).not.toBe("none");
        expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
        await page.locator('a.catalog-card[href="/tool/calculator"]').click();
        await expect(page).toHaveURL(/\/tool\/calculator$/);
    });
});