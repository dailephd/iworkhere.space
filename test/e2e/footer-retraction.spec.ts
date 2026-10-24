import { test, expect } from "./support/fixture";

const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report Issues — report a problem or suggestion";

test("the footer stays fixed, fully visible and free of collapse controls on public pages", async ({ page }) => {
    for (const route of ["/", "/discover", "/contact", "/privacy", "/tool/json-formatter"]) {
        await page.goto(route);
        const footer = page.getByRole("contentinfo");
        await expect(footer).toBeVisible();
        await expect(footer.getByText("© 2026 iworkhere.space created by dailephd LLC")).toBeVisible();
        await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
        await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
        await expect(footer.getByRole("button", { name: reportName })).toHaveCount(supportEnabled ? 1 : 0);
        await expect(footer.getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
        await expect(page.locator("[data-footer-toggle], [data-footer-when]")).toHaveCount(0);
        await expect(page.locator("html")).not.toHaveAttribute("data-footer", "collapsed");
        const geometry = await footer.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { position: getComputedStyle(element).position, bottom: rect.bottom, width: rect.width, viewportHeight: innerHeight, viewportWidth: innerWidth };
        });
        expect(geometry.position).toBe("fixed");
        expect(Math.abs(geometry.bottom - geometry.viewportHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.width - geometry.viewportWidth)).toBeLessThanOrEqual(1);
    }
});

test("old collapsed preference, malformed storage and stale document state cannot hide footer links", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("footer-preference", JSON.stringify("collapsed"));
    });
    await page.goto("/contact");
    const footer = page.getByRole("contentinfo");
    await page.evaluate(() => document.documentElement.setAttribute("data-footer", "collapsed"));
    await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem("footer-preference", "invalid json{"));
    await page.reload();
    await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
    await expect(page.locator("[data-footer-toggle]")).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
});

test("the footer remains fixed with measured clearance and keeps the last page action reachable", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForFunction(() => Object.keys(document.querySelector("footer")!).some(key => key.startsWith("__reactFiber")));
    await page.evaluate(() => {
        const button = document.createElement("button");
        button.textContent = "Last page action";
        button.id = "last-page-action";
        document.querySelector("main")!.append(button);
    });
    const footer = page.locator("footer");
    const spacer = page.locator("[data-footer-spacer]");
    await expect.poll(async () => {
        const height = await footer.evaluate(element => element.getBoundingClientRect().height);
        return Math.abs(await spacer.evaluate(element => element.getBoundingClientRect().height) - height);
    }).toBeLessThanOrEqual(1);
    const last = page.getByRole("button", { name: "Last page action" });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    expect(await last.evaluate(element => element.getBoundingClientRect().bottom <= document.querySelector("footer")!.getBoundingClientRect().top + 1)).toBe(true);
});

test("the footer falls back to readable normal flow when JavaScript is disabled", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
        await page.goto(new URL("/contact", baseURL).toString());
        const footer = page.getByRole("contentinfo");
        await expect(footer).toBeVisible();
        await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
        await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
        expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe("static");
        await expect(page.getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
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
