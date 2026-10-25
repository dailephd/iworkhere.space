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
