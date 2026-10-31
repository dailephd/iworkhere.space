import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "./support/fixture";
import { tool_category_definition_list } from "../../src/module/tool/category";

const PRIMARY = [
    { label: "Home", href: "/" },
    { label: "All tools", href: "/discover" },
    { label: "Workflows", href: "/workflows" },
    { label: "Guides", href: "/guide" },
];
const CATEGORY = tool_category_definition_list.map(definition => ({ label: definition.title, href: `/category/${definition.id}` }));
const WIDTHS = [320, 360, 390, 768, 1024, 1440];

const header = (page: Page) => page.getByRole("banner");
const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

// The registry is a client-component graph that Playwright cannot import, so registered tool slugs come from the registry-derived sitemap.
async function registeredToolSlug(request: APIRequestContext): Promise<string[]> {
    const xml = await (await request.get("/sitemap.xml")).text();
    return [...xml.matchAll(new RegExp("<loc>https://iworkhere\\.space/tool/([^<]+)</loc>", "g"))].map(match => match[1]);
}

async function headerHeight(page: Page): Promise<number> {
    return (await box(header(page))).height;
}

async function footprintHeight(page: Page): Promise<number> {
    return (await box(page.locator("[data-header-footprint]"))).height;
}

async function openMenu(page: Page) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute("aria-expanded", "true");
}

test.describe("desktop navigation", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("shows exactly the five primary links in order with no second /discover link", async ({ page }) => {
        await page.goto("/");
        const link = page.locator("[data-primary-nav-list] > li > a");
        await expect(link).toHaveText(PRIMARY.map(one => one.label));
        expect(await link.evaluateAll(list => list.map(one => one.getAttribute("href")))).toEqual(PRIMARY.map(one => one.href));
        await expect(header(page).locator('a[href="/discover"]')).toHaveCount(1);
        await expect(header(page).getByRole("link", { name: "Search tools" })).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
        await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
    });

    test("keeps brand, links, Categories, Search and Themes on one row without a second navigation row", async ({ page }) => {
        await page.goto("/");
        const brand = await box(header(page).getByRole("link", { name: "iworkhere.space" }));
        const parts = [
            await box(page.getByRole("link", { name: "Guides", exact: true })),
            await box(page.getByRole("button", { name: "Categories", exact: true })),
            await box(page.getByRole("button", { name: "Search tools", exact: true })),
            await box(page.getByRole("button", { name: "Themes", exact: true })),
        ];
        for (const part of parts) expect(Math.abs((part.y + part.height / 2) - (brand.y + brand.height / 2))).toBeLessThan(6);
        expect(await headerHeight(page)).toBeLessThanOrEqual(72);
    });

    test("the Categories disclosure lists the seven canonical destinations and closes with Escape, returning focus", async ({ page }) => {
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "Categories", exact: true });
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("[data-category-nav-list]")).toBeHidden();
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const link = page.locator("[data-category-nav-list] a");
        await expect(link).toHaveText(CATEGORY.map(one => one.label));
        expect(await link.evaluateAll(list => list.map(one => one.getAttribute("href")))).toEqual(CATEGORY.map(one => one.href));
        const controls = await trigger.getAttribute("aria-controls");
        await expect(page.locator(`[id="${controls}"]`)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.locator("footer").click();
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await trigger.click();
        await link.nth(5).click();
        await expect(page).toHaveURL(/\/category\/image$/);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    test("Themes still switches to One Dark and persists the selection", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        await page.getByRole("radio", { name: "One Dark", exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
        await page.keyboard.press("Escape");
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    });
});

test.describe("mobile navigation at 390 x 844", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the collapsed header is at most 72px with 44px brand, Menu, Search and Themes controls", async ({ page }) => {
        await page.goto("/");
        expect(await headerHeight(page)).toBeLessThanOrEqual(72);
        expect(await headerHeight(page)).toBeLessThan(228);
        for (const target of [
            header(page).getByRole("link", { name: "iworkhere.space" }),
            page.getByRole("button", { name: "Menu", exact: true }),
            page.getByRole("button", { name: "Search tools", exact: true }),
            page.getByRole("button", { name: "Themes", exact: true }),
        ]) {
            await expect(target).toBeVisible();
            const size = await box(target);
            expect(size.width).toBeGreaterThanOrEqual(44);
            expect(size.height).toBeGreaterThanOrEqual(44);
        }
        await expect(page.locator("[data-primary-nav-list]")).toBeHidden();
    });

    test("the open Menu shows five primary and seven category links without changing the header footprint", async ({ page }) => {
        await page.goto("/");
        const before = { header: await headerHeight(page), footprint: await footprintHeight(page) };
        await openMenu(page);
        const trigger = page.getByRole("button", { name: "Menu", exact: true });
        await expect(page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`)).toBeVisible();
        await expect(page.locator("[data-primary-nav-list] > li > a")).toHaveText(PRIMARY.map(one => one.label));
        const category = page.locator("[data-category-nav-list] a");
        await expect(category).toHaveText(CATEGORY.map(one => one.label));
        expect(await category.evaluateAll(list => list.map(one => one.getAttribute("href")))).toEqual(CATEGORY.map(one => one.href));
        for (const one of await category.all()) {
            await expect(one).toBeVisible();
            // Chromium reports a 44px target as 43.99993896484375 (44 - 2^-14) at fractional offsets; 0.01 CSS px of tolerance keeps the 44px contract.
            expect((await box(one)).height).toBeGreaterThanOrEqual(44 - 0.01);
        }
        expect(await headerHeight(page)).toBe(before.header);
        expect(await footprintHeight(page)).toBe(before.footprint);
        const panel = await box(page.locator("[data-nav-panel]"));
        expect(panel.y + panel.height).toBeLessThanOrEqual(844);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test("Escape closes the Menu and returns focus; outside click and selection also close it", async ({ page }) => {
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "Menu", exact: true });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Home", exact: true })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(trigger).toBeFocused();

        await openMenu(page);
        await page.mouse.click(195, 820);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");

        await openMenu(page);
        await page.locator("[data-category-nav-list]").getByRole("link", { name: "Converters", exact: true }).click();
        await expect(page).toHaveURL(/\/category\/converter$/);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    test("any destination takes only the Menu and one link activation", async ({ page }) => {
        for (const destination of [...PRIMARY.filter(one => one.href !== "/"), ...CATEGORY]) {
            await page.goto("/");
            await openMenu(page);
            await page.locator(`[data-nav-panel] a[href="${destination.href}"]`).click();
            await expect(page).toHaveURL(new RegExp(`${destination.href}$`));
        }
    });

    test("Search opens /discover#tool-search and focuses the labelled input", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Search tools", exact: true }).click();
        await expect(page).toHaveURL(/\/discover#tool-search$/);
        await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toBeFocused();
    });

    test("Home shows a real tool card in the first viewport", async ({ page }) => {
        await page.goto("/");
        const first = page.locator("a.catalog-card").first();
        await expect(first).toBeInViewport({ ratio: 1 });
        const size = await box(first);
        expect(size.y + size.height).toBeLessThanOrEqual(844);
    });
});

test.describe("Search utility", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("navigates from Home to /discover#tool-search and focuses the input", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Search tools", exact: true }).click();
        await expect(page).toHaveURL(/\/discover#tool-search$/);
        await expect(page.locator("input#tool-search")).toBeFocused();
        await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toBeFocused();
    });

    test("focuses the input in place on /discover without a route change", async ({ page }) => {
        await page.goto("/discover");
        await expect(page.locator("input#tool-search")).not.toBeFocused();
        await page.getByRole("button", { name: "Search tools", exact: true }).click();
        await expect(page.locator("input#tool-search")).toBeFocused();
        await expect(page).toHaveURL(/\/discover$/);
    });

    test("focuses the input on a full page load of the fragment URL", async ({ page }) => {
        await page.goto("/discover#tool-search");
        await expect(page.locator("input#tool-search")).toBeFocused();
    });

    test("a plain /discover visit does not take focus", async ({ page }) => {
        await page.goto("/discover");
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        await page.getByRole("link", { name: "All tools", exact: true }).first().click();
        expect(await page.evaluate(() => document.activeElement?.id)).not.toBe("tool-search");
    });
});

test.describe("Home catalog", () => {
    test("renders exactly the 18 registered tools once each, seven canonical categories and no task or workflow cards", async ({ page, request }) => {
        await page.goto("/");
        const slug = await registeredToolSlug(request);
        expect(slug).toHaveLength(18);
        const card = page.getByRole("main").locator('a[href^="/tool/"]');
        await expect(card).toHaveCount(18);
        expect((await card.evaluateAll(list => list.map(one => one.getAttribute("href")!.replace("/tool/", "")))).sort()).toEqual([...slug].sort());
        expect(await card.evaluateAll(list => list.filter(one => one.querySelector("a")).length)).toBe(0);
        const chip = page.locator("#home-categories-title ~ ul a");
        await expect(chip).toHaveText(CATEGORY.map(one => one.label));
        await expect(page.locator("[data-home-board]")).toHaveCount(7);
        await expect(page.getByText("Start with a common task")).toHaveCount(0);
        await expect(page.getByText("Practical file workflows")).toHaveCount(0);
        await expect(page.getByRole("main").locator('a[href^="/guide"], a[href^="/workflows"]')).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.locator("input#tool-search")).toBeVisible();
    });

    test("the catalog is complete in the server HTML without JavaScript filtering", async ({ browser, baseURL }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        try {
            await page.goto(new URL("/", baseURL).toString());
            await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(18);
        } finally {
            await context.close();
        }
    });

    test("every card is a working link to its tool page", async ({ page }) => {
        await page.goto("/");
        await page.locator('a.catalog-card[href="/tool/calculator"]').click();
        await expect(page).toHaveURL(/\/tool\/calculator$/);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    });
});

for (const width of WIDTHS) {
    test(`has no horizontal overflow on Home, Discover and Workflows at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        for (const route of ["/", "/discover", "/workflows", "/tool/calculator"]) {
            await page.goto(route);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${route} at ${width}px`).toBe(true);
            expect(await headerHeight(page)).toBeLessThanOrEqual(72);
        }
    });
}

test.describe("Workflows landing", () => {
    test("is a truthful landing: four runnable workflow links and no coming-soon entries", async ({ page, request }) => {
        const response = await request.get("/workflows");
        expect(response.status()).toBe(200);
        expect(await response.text()).not.toContain("cannot be run yet");
        await page.goto("/workflows");
        await expect(page.getByRole("heading", { level: 1, name: "Workflows", exact: true })).toBeVisible();
        await expect(page.locator("[data-workflows-status]")).toContainText("4 workflows are available now");
        await expect(page.locator("[data-planned-workflow]")).toHaveCount(0);
        await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
        await expect(page.locator("main form, main input[type=file]")).toHaveCount(0);
        await expect(page.getByRole("main").locator('a[href^="/workflows/"]')).toHaveCount(4);
        for (const slug of ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"]) {
            await expect(page.getByRole("main").locator(`a[href="/workflows/${slug}"]`)).toHaveCount(1);
        }
        await expect(page.getByRole("main").getByRole("link", { name: /Browse all individual tools/ })).toHaveAttribute("href", "/discover");
        await expect(page.getByRole("main").getByRole("link", { name: /Find the right tool or workflow/ })).toHaveAttribute("href", "/guide");
        await expect(page.locator('[data-primary-nav-list] a[href="/workflows"]')).toHaveAttribute("aria-current", "page");
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/workflows");
        await expect(page).toHaveTitle("Workflows - iworkhere");
    });

    test("the sitemap lists 36 unique URLs including /workflows once and the four live workflow detail routes", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        const location = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        expect(location).toHaveLength(36);
        expect(new Set(location).size).toBe(36);
        expect(location.filter(url => url === "https://iworkhere.space/workflows")).toHaveLength(1);
        expect(location.filter(url => url.includes("/workflows/"))).toEqual([
            "https://iworkhere.space/workflows/prepare-image-for-upload",
            "https://iworkhere.space/workflows/heic-photos-to-pdf",
            "https://iworkhere.space/workflows/assemble-pdf-packet",
            "https://iworkhere.space/workflows/pdf-pages-for-slides",
        ]);
        for (const url of ["/", "/discover", "/guide", "/about", "/contact", "/privacy"]) {
            expect(location).toContain(`https://iworkhere.space${url === "/" ? "/" : url}`);
        }
    });
});
