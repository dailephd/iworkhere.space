import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const showControl = (page: Page) => page.getByRole("button", { name: "Show navigation", exact: true });
const hideControl = (page: Page) => page.getByRole("button", { name: "Hide navigation", exact: true });

// Guarantees a scrollable document on every viewport without depending on page content.
async function openScrolledPage(page: Page) {
    await page.goto("/discover");
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.id = "e2e-scroll-spacer";
        spacer.style.height = "4000px";
        document.body.append(spacer);
    });
    await page.mouse.wheel(0, 1500);
    await expect(showControl(page)).toBeVisible();
}

const scrollMetric = (page: Page) => page.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight }));

test("the top of the page shows the in-flow header and no retractable control", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    expect(await page.locator("header").evaluate(element => getComputedStyle(element).position)).toBe("static");
    await expect(showControl(page)).toHaveCount(0);
});

test("scrolling past the header shows the control and expands the same header without moving the page", async ({ page }) => {
    await openScrolledPage(page);
    const before = await scrollMetric(page);
    expect(before.y).toBeGreaterThan(0);
    await expect(showControl(page)).toHaveAttribute("aria-expanded", "false");

    await showControl(page).click();

    await expect(hideControl(page)).toHaveAttribute("aria-expanded", "true");
    const headerId = await page.locator("header").getAttribute("id");
    await expect(hideControl(page)).toHaveAttribute("aria-controls", headerId!);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
    const box = (await page.locator("header").boundingBox())!;
    expect(box.y).toBe(0);
    expect(await page.locator("header").evaluate(element => getComputedStyle(element).position)).toBe("fixed");
    expect(await scrollMetric(page)).toEqual(before);
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

    await hideControl(page).click();
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    expect(await scrollMetric(page)).toEqual(before);
});

test("keyboard operation opens, closes with Escape and keeps focus on a visible control", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).focus();
    await page.keyboard.press("Enter");
    await expect(hideControl(page)).toBeFocused();
    await page.getByRole("link", { name: "Home" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    await expect(showControl(page)).toBeFocused();
});

test("the theme selector works inside the overlay and Escape closes its popover before the header", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).click();
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    await page.getByRole("radio", { name: "One Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Appearance settings" })).toHaveCount(0);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
    await page.keyboard.press("Escape");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
});

test("a modal dialog stays above the overlay and keeps Escape for itself", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).click();
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
    await page.evaluate(() => {
        const dialog = document.createElement("dialog");
        dialog.id = "e2e-modal";
        dialog.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;margin:0;padding:0;max-width:none;max-height:none";
        dialog.textContent = "Modal content";
        document.body.append(dialog);
        dialog.showModal();
    });
    const topElementIsDialog = await page.evaluate(() => document.elementFromPoint(window.innerWidth / 2, 10)?.id === "e2e-modal");
    expect(topElementIsDialog).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#e2e-modal")).not.toHaveAttribute("open", "");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
});

test("selecting a destination closes the overlay", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).click();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    await expect(hideControl(page)).toHaveCount(0);
});

test("returning to the top restores the in-flow header and hides the control", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(showControl(page)).toHaveCount(0);
    await expect(hideControl(page)).toHaveCount(0);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    expect(await page.locator("header").evaluate(element => getComputedStyle(element).position)).toBe("static");
});

test("the theme popover is fully visible and receives pointer hits inside the expanded header", async ({ page }) => {
    await openScrolledPage(page);
    await showControl(page).click();
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const popover = page.getByRole("dialog", { name: "Appearance settings" });
    await expect(popover).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await popover.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    const hits = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Appearance settings"]')!;
        const owns = (x: number, y: number) => { const hit = document.elementFromPoint(x, y); return !!hit && dialog.contains(hit); };
        const first = dialog.querySelector("label")!.getBoundingClientRect();
        const rect = dialog.getBoundingClientRect();
        const control = document.querySelector(`button[aria-controls="${document.querySelector("header")!.id}"]`)!.getBoundingClientRect();
        const controlX = control.left + control.width / 2;
        const controlY = control.top + control.height / 2;
        const controlInsidePopover = controlX >= rect.left && controlX <= rect.right && controlY >= rect.top && controlY <= rect.bottom;
        return {
            first: owns(first.left + first.width / 2, first.top + first.height / 2),
            center: owns(rect.left + rect.width / 2, rect.top + rect.height / 2),
            controlInsidePopover,
            popoverAboveControl: owns(controlX, controlY),
        };
    });
    expect(hits.first).toBe(true);
    expect(hits.center).toBe(true);
    if (hits.controlInsidePopover) expect(hits.popoverAboveControl).toBe(true);
    // A real pointer click, not a scripted one, reaches the radio.
    await popover.getByRole("radio", { name: "One Dark", exact: true }).click({ trial: true });
    await page.mouse.click(box.x + box.width / 2, box.y + 20);
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
});

test("activating a same-route link closes the overlay and leaves focus on the visible control", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "4000px";
        document.body.append(spacer);
    });
    await page.mouse.wheel(0, 1500);
    await expect(showControl(page)).toBeVisible();
    await showControl(page).click();
    const before = await scrollMetric(page);
    await page.getByRole("link", { name: "Home" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
    await expect(showControl(page)).toBeFocused();
    const box = (await showControl(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await scrollMetric(page)).toEqual(before);
    // Keyboard users continue from the visible control.
    await page.keyboard.press("Enter");
    await expect(hideControl(page)).toBeFocused();
});

for (const [from, to] of [
    [{ width: 1280, height: 720 }, { width: 390, height: 844 }],
    [{ width: 390, height: 844 }, { width: 1280, height: 720 }],
] as const) {
    test(`resizing from ${from.width}px to ${to.width}px while expanded keeps the footprint and controls in step`, async ({ page }) => {
        await page.setViewportSize(from);
        await openScrolledPage(page);
        await showControl(page).click();
        await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
        const geometry = () => page.evaluate(() => {
            const header = document.querySelector("header")!.getBoundingClientRect();
            const footprint = document.querySelector("header")!.parentElement!.getBoundingClientRect();
            const control = document.querySelector(`button[aria-controls="${document.querySelector("header")!.id}"]`)!.getBoundingClientRect();
            return { header: header.height, footprint: footprint.height, headerBottom: header.bottom, controlTop: control.top, scrollY: window.scrollY, scrollHeight: document.documentElement.scrollHeight };
        });
        const opened = await geometry();
        expect(Math.abs(opened.footprint - opened.header)).toBeLessThanOrEqual(1);

        await page.setViewportSize(to);
        await expect.poll(async () => {
            const now = await geometry();
            return Math.abs(now.footprint - now.header) <= 1 && now.controlTop >= now.headerBottom;
        }).toBe(true);
        const resized = await geometry();
        expect(Math.abs(resized.header - opened.header)).toBeGreaterThan(1);
        await expect(page.locator("header")).toHaveCount(1);
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);

        await hideControl(page).click();
        await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
        const closed = await geometry();
        // The placeholder matched the header, so closing leaves the document geometry unchanged.
        expect(Math.abs(closed.scrollHeight - resized.scrollHeight)).toBeLessThanOrEqual(1);
        expect(closed.scrollY).toBe(resized.scrollY);
        expect(Math.abs(closed.footprint - closed.header)).toBeLessThanOrEqual(1);
    });
}
