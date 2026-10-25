import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

// Guarantees a scrollable document on every viewport without depending on page content.
async function addScrollSpacer(page: Page) {
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.id = "e2e-scroll-spacer";
        spacer.style.height = "4000px";
        document.body.append(spacer);
    });
}

const headerBox = (page: Page) => page.getByRole("banner").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
});

test("one header is fixed to the top, with one primary navigation and no show/hide control", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Show navigation|Hide navigation/ })).toHaveCount(0);
    await expect(page.locator("[data-header-state]")).toHaveCount(0);
    expect(await page.getByRole("banner").evaluate(element => getComputedStyle(element).position)).toBe("fixed");
    await expect(page.getByRole("banner").getByRole("link", { name: "Search tools", exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Themes", exact: true })).toBeVisible();
});

test("the header stays visible at the top of the viewport while scrolling", async ({ page }) => {
    await page.goto("/discover");
    await addScrollSpacer(page);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    const box = await headerBox(page);
    expect(box.top).toBe(0);
    await expect(page.getByRole("banner")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /Show navigation|Hide navigation/ })).toHaveCount(0);
});

test("the in-flow footprint matches the rendered header height and leaves content uncovered", async ({ page }) => {
    for (const route of ["/", "/discover", "/tool/calculator", "/contact"]) {
        await page.goto(route);
        await expect.poll(async () => {
            const measured = await page.evaluate(() => {
                const header = document.querySelector("header")!.getBoundingClientRect();
                const footprint = document.querySelector("[data-header-footprint]")!.getBoundingClientRect();
                const main = document.querySelector("main")!.getBoundingClientRect();
                return { header: header.height, footprint: footprint.height, mainTop: main.top, headerBottom: header.bottom };
            });
            return Math.abs(measured.header - measured.footprint) <= 1 && measured.mainTop >= measured.headerBottom - 1;
        }, `header footprint on ${route}`).toBe(true);
        const heading = page.getByRole("heading", { level: 1 }).first();
        expect(await heading.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual((await headerBox(page)).bottom - 1);
    }
});

for (const width of [1280, 768, 390, 320]) {
    test(`the footprint follows the header when navigation wraps at ${width}px and there is no horizontal scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/discover");
        await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector("header")!.getBoundingClientRect().height - document.querySelector("[data-header-footprint]")!.getBoundingClientRect().height))).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
}

test("resizing keeps the footprint in step with the wrapped header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/discover");
    const wide = (await headerBox(page)).height;
    await page.setViewportSize({ width: 360, height: 800 });
    await expect.poll(async () => (await headerBox(page)).height).toBeGreaterThan(wide);
    await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector("header")!.getBoundingClientRect().height - document.querySelector("[data-header-footprint]")!.getBoundingClientRect().height))).toBeLessThanOrEqual(1);
});

test("the skip link appears above the header and moves focus to the main content", async ({ page }) => {
    await page.goto("/discover");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content", exact: true });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    const hit = await skip.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === element || element.contains(top);
    });
    expect(hit, "the skip link is not painted under the fixed header").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
});

test("an in-page anchor target is not hidden under the fixed header", async ({ page }) => {
    await page.goto("/discover");
    await addScrollSpacer(page);
    await page.evaluate(() => {
        const target = document.createElement("h2");
        target.id = "e2e-anchor-target";
        target.textContent = "Anchor target";
        document.body.insertBefore(target, document.getElementById("e2e-scroll-spacer"));
        const link = document.createElement("a");
        link.id = "e2e-anchor-link";
        link.href = "#e2e-anchor-target";
        link.textContent = "Jump";
        document.querySelector("main")!.prepend(link);
    });
    await page.locator("#e2e-anchor-link").click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const top = await page.locator("#e2e-anchor-target").evaluate(element => element.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual((await headerBox(page)).bottom - 1);
});

test("keyboard focus order follows the visual order and focus stays visible", async ({ page }) => {
    await page.goto("/discover");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const order = [] as string[];
    for (let step = 0; step < 12; step += 1) {
        order.push(await page.evaluate(() => {
            const active = document.activeElement as HTMLElement;
            return active.closest("header") ? (active.textContent ?? "").trim() : "outside";
        }));
        await page.keyboard.press("Tab");
    }
    const firstOutside = order.indexOf("outside");
    expect(order.slice(0, firstOutside === -1 ? order.length : firstOutside)[0]).toContain("iworkhere");
    expect(order).toContain("Home");
    expect(order).toContain("About");
    expect(order.indexOf("Home")).toBeLessThan(order.indexOf("About"));
});

test("the Themes popover opens fully inside the viewport and above page content", async ({ page }) => {
    await page.goto("/discover");
    await addScrollSpacer(page);
    await page.mouse.wheel(0, 800);
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const popover = page.getByRole("dialog", { name: "Appearance settings" });
    await expect(popover).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await popover.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    const owned = await popover.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return !!hit && element.contains(hit);
    });
    expect(owned).toBe(true);
    await popover.getByRole("radio", { name: "One Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
});

test("changing the theme does not move the header or the page", async ({ page }) => {
    await page.goto("/discover");
    const before = await headerBox(page);
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("radio", { name: "One Dark", exact: true }).click();
    await page.keyboard.press("Escape");
    expect(await headerBox(page)).toEqual(before);
});

test("the header stays readable in ordinary flow when JavaScript is disabled", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/contact", baseURL).toString());
        await expect(page.getByRole("banner")).toBeVisible();
        expect(await page.getByRole("banner").evaluate(element => getComputedStyle(element).position)).toBe("static");
        await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Home", exact: true })).toBeVisible();
        expect(await page.getByRole("heading", { level: 1 }).first().evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual((await headerBox(page)).bottom - 1);
    } finally {
        await context.close();
    }
});
