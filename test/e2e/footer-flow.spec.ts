import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report Issues — report a problem or suggestion";

const footerGeometry = (page: Page) => page.locator("footer").evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
        position: style.position,
        top: rect.top,
        bottom: rect.bottom,
        documentBottom: rect.bottom + window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
    };
});

/**
 * Tests that append nodes to the React-managed main element must wait until hydration has finished.
 * The "Themes" button stays disabled until ThemeProvider's layout effect runs during the hydration commit,
 * so an enabled button means main has hydrated. Appending earlier makes React report #418 and discard the node.
 */
async function waitForHydration(page: Page) {
    await expect(page.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();
}

test("there is exactly one footer with its content and no collapse control on public pages", async ({ page }) => {
    for (const route of ["/", "/discover", "/contact", "/privacy", "/tool/json-formatter"]) {
        await page.goto(route);
        await expect(page.locator("footer")).toHaveCount(1);
        const footer = page.getByRole("contentinfo");
        await expect(footer.getByText("© 2026 iworkhere.space created by dailephd LLC")).toBeVisible();
        await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toHaveAttribute("href", "/contact");
        await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toHaveAttribute("href", "/privacy");
        await expect(footer.getByRole("button", { name: reportName })).toHaveCount(supportEnabled ? 1 : 0);
        await expect(footer.getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
        await expect(page.locator("[data-footer-toggle], [data-footer-when], [data-footer-spacer]")).toHaveCount(0);
    }
});

test("on a long page the footer is in ordinary flow and is reached only by scrolling to the end", async ({ page }) => {
    await page.goto("/discover");
    await waitForHydration(page);
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "4000px";
        document.querySelector("main")!.append(spacer);
    });
    const initial = await footerGeometry(page);
    expect(["static", "relative"]).toContain(initial.position);
    expect(initial.top, "the footer starts outside the first viewport").toBeGreaterThanOrEqual(initial.viewportHeight);
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    expect((await footerGeometry(page)).top, "scrolling mid-document does not pin the footer").toBeGreaterThan(initial.viewportHeight - 1200 - 1);
    await expect(page.locator("footer")).not.toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator("footer")).toBeInViewport();
    const end = await footerGeometry(page);
    expect(Math.abs(end.documentBottom - end.documentHeight)).toBeLessThanOrEqual(1);
});

test("on a short page the footer sits at the bottom of the viewport after the content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 6000 });
    await page.goto("/privacy");
    const geometry = await footerGeometry(page);
    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(Math.abs(geometry.bottom - geometry.viewportHeight)).toBeLessThanOrEqual(1);
    const mainBottom = await page.locator("main").evaluate(element => element.getBoundingClientRect().bottom);
    expect(mainBottom).toBeLessThanOrEqual(geometry.top + 1);
});

const sparseCategoryRoute = ["/category/math", "/category/time", "/category/developer", "/category/converter"];
const standardViewport = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 740 },
];

/** The footer is the last thing in the document: flush with the viewport on short pages, with the document end on long ones. */
async function expectFooterAtDocumentEnd(page: Page, label: string) {
    const geometry = await footerGeometry(page);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(geometry.position, label).toBe("static");
    expect(Math.abs(geometry.documentBottom - Math.max(geometry.documentHeight, geometry.viewportHeight)), `${label}: footer bottom meets the document or viewport bottom`).toBeLessThanOrEqual(2);
    expect(geometry.documentHeight, `${label}: no blank area below the footer`).toBeLessThanOrEqual(Math.max(geometry.viewportHeight, geometry.documentBottom) + 2);
    expect(overflowX, `${label}: no horizontal overflow`).toBeLessThanOrEqual(0);
    return geometry;
}

test("sparse category pages put the footer at the viewport bottom at standard desktop and mobile sizes", async ({ page }) => {
    for (const viewport of standardViewport) {
        await page.setViewportSize(viewport);
        for (const route of sparseCategoryRoute) {
            await page.goto(route);
            const label = `${route} at ${viewport.width}x${viewport.height}`;
            const geometry = await expectFooterAtDocumentEnd(page, label);
            const main = await page.locator("main").evaluate(element => element.getBoundingClientRect());
            expect(main.bottom, `${label}: the footer follows the content`).toBeLessThanOrEqual(geometry.top + 1);
            expect(main.top, `${label}: content stays at the top of its region`).toBeLessThan(viewport.height / 2);
            if (geometry.documentHeight <= viewport.height + 1) {
                expect(Math.abs(geometry.bottom - viewport.height), `${label}: short page footer is flush with the viewport`).toBeLessThanOrEqual(2);
            }
        }
    }
});

test("the footer follows the viewport when a short page is resized and the header wraps", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/category/math");
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 768, height: 1024 }]) {
        await page.setViewportSize(viewport);
        await expect.poll(async () => {
            const geometry = await footerGeometry(page);
            return Math.abs(geometry.documentBottom - Math.max(geometry.documentHeight, geometry.viewportHeight));
        }, { message: `${viewport.width}x${viewport.height}` }).toBeLessThanOrEqual(2);
        await expectFooterAtDocumentEnd(page, `${viewport.width}x${viewport.height}`);
    }
});

test("content added to a short page pushes the footer down without overlap and removing it restores the bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/category/math");
    await waitForHydration(page);
    const before = await expectFooterAtDocumentEnd(page, "before growth");
    expect(before.documentHeight).toBeLessThanOrEqual(before.viewportHeight + 1);
    await page.evaluate(() => {
        const block = document.createElement("div");
        block.id = "growth-block";
        block.style.height = "2000px";
        document.querySelector("main")!.append(block);
    });
    const grown = await expectFooterAtDocumentEnd(page, "after growth");
    expect(grown.documentHeight).toBeGreaterThan(before.viewportHeight + 1000);
    const separation = await page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().top - document.getElementById("growth-block")!.getBoundingClientRect().bottom);
    expect(separation, "the footer does not overlay the new content").toBeGreaterThanOrEqual(-1);
    await page.evaluate(() => document.getElementById("growth-block")!.remove());
    const restored = await expectFooterAtDocumentEnd(page, "after removal");
    expect(Math.abs(restored.bottom - restored.viewportHeight)).toBeLessThanOrEqual(2);
});

test("old collapsed preference, malformed storage and stale document state cannot hide footer links", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("footer-preference", JSON.stringify("collapsed"));
    });
    await page.goto("/contact");
    const footer = page.getByRole("contentinfo");
    await page.evaluate(() => document.documentElement.setAttribute("data-footer", "collapsed"));
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem("footer-preference", "invalid json{"));
    await page.reload();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
});

test("the last page action is not covered by the footer", async ({ page }) => {
    await page.goto("/contact");
    await waitForHydration(page);
    await page.evaluate(() => {
        const button = document.createElement("button");
        button.textContent = "Last page action";
        document.querySelector("main")!.append(button);
    });
    const last = page.getByRole("button", { name: "Last page action" });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    expect(await last.evaluate(element => element.getBoundingClientRect().bottom <= document.querySelector("footer")!.getBoundingClientRect().top + 1)).toBe(true);
});

test("the footer is ordinary content when JavaScript is disabled", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/contact", baseURL).toString());
        const footer = page.getByRole("contentinfo");
        await footer.scrollIntoViewIfNeeded();
        await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
        await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
        expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe("static");
    } finally {
        await context.close();
    }
});

test("keyboard focus reaches footer links and the optional report dialog returns focus", async ({ page }) => {
    await page.goto("/contact");
    const contact = page.getByRole("link", { name: "Contact Us", exact: true });
    const privacy = page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy", exact: true });
    await contact.focus();
    await expect(contact).toBeFocused();
    await page.keyboard.press("Tab");
    if (supportEnabled) {
        const report = page.getByRole("button", { name: reportName });
        await expect(report).toBeFocused();
        await report.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Report a problem or suggestion" });
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(report).toBeFocused();
    } else {
        await expect(privacy).toBeFocused();
    }
    await privacy.focus();
    await expect(privacy).toBeFocused();
});
