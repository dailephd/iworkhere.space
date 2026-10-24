import type { Page } from "@playwright/test";
import { getConsoleFailure } from "./support/browserDiagnostic";
import { test, expect } from "./support/fixture";

// These scenarios exercise the real header, footer and SupportDialog together. They need a support-enabled build (see footer-flow.spec.ts);
// a public build exposes no reporting entry, so the scenario asserts that absence instead.
const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report Issues — report a problem or suggestion";
const reportDialogName = "Report a problem or suggestion";

const reportButton = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: reportName });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

// Only the browser-side Turnstile widget script is replaced, so the real dialog opens without a network dependency; nothing is submitted.
test.beforeEach(async ({ context }) => {
    await context.route("https://challenges.cloudflare.com/**", route => route.fulfill({ contentType: "application/javascript", body: `
        window.turnstile = { render() { return "widget-1"; }, reset() {}, remove() {} };` }));
});

const insideChrome = (page: Page) => page.evaluate(() => !!document.activeElement?.closest("header, footer"));

// Adding content to the page before React has hydrated it reads as a hydration mismatch (React error #418), and a click before then has no handler.
// Waiting for the hydrated tree lets the scenarios edit the page without hiding a real mismatch.
const waitForHydration = (page: Page) => page.waitForFunction(() => ["main", "footer"].every(selector => Object.keys(document.querySelector(selector)!).some(key => key.startsWith("__reactFiber"))));

async function openScrolledPage(page: Page) {
    await page.goto("/discover");
    await waitForHydration(page);
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "4000px";
        document.body.append(spacer);
    });
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
}

// The shared fixture already fails any test that logs a page error or hydration diagnostic; these scenarios additionally assert the load itself is clean
// for a fresh visitor and stale footer preferences, and that nothing was duplicated by hydration.
for (const saved of [undefined, "expanded", "collapsed"] as const) {
    test(`hydrates without errors or duplicated chrome with ${saved ?? "no"} saved footer preference`, async ({ page }) => {
        const diagnostics: string[] = [];
        page.on("pageerror", error => diagnostics.push(`pageerror: ${error.message}`));
        page.on("console", message => {
            const failure = getConsoleFailure({ type: message.type(), text: message.text() });
            if (failure) diagnostics.push(failure);
        });
        if (saved) await page.addInitScript(value => localStorage.setItem("footer-preference", JSON.stringify(value)), saved);
        await page.goto("/discover");
        await waitForHydration(page);

        await expect(page.locator("html")).not.toHaveAttribute("data-footer", "collapsed");
        await expect(page.getByRole("contentinfo").getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
        await expect(page.getByRole("contentinfo").getByRole("link", { name: "Contact Us" })).toBeVisible();
        await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
        await expect(page.locator("header")).toHaveCount(1);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(page.locator("dialog")).toHaveCount(0);
        await expect(reportButton(page)).toHaveCount(supportEnabled ? 1 : 0);
        expect(diagnostics).toEqual([]);
    });
}

test("fixed header, ordinary-flow footer and the real report dialog work together", async ({ page }) => {
    await page.goto("/discover");
    await waitForHydration(page);
    if (!supportEnabled) {
        await expect(reportButton(page)).toHaveCount(0);
        return;
    }
    await openScrolledPage(page);
    await reportButton(page).scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    await reportButton(page).click();
    const dialog = page.getByRole("dialog", { name: reportDialogName });
    await expect(dialog).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Contact Us" })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(reportButton(page)).toBeFocused();
    expect(await scrollY(page)).toBe(before);
    expect(await page.locator("header").evaluate(element => getComputedStyle(element).position)).toBe("fixed");
    await expect(page.locator("header")).toBeInViewport({ ratio: 1 });
});

test("tabbing through the report dialog never scrolls the page behind it, wherever the footer sits", async ({ page }) => {
    // The dialog is modal and the page behind it is inert, so tabbing through its fields must not scroll that page.
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/tool/merge-pdf");
    await waitForHydration(page);
    if (!supportEnabled) {
        await expect(reportButton(page)).toHaveCount(0);
        return;
    }
    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "3000px";
        document.querySelector("main")!.append(spacer);
    });
    await reportButton(page).scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    await reportButton(page).click();
    await expect(page.getByRole("dialog", { name: reportDialogName })).toBeVisible();
    for (let step = 0; step < 16; step += 1) {
        await page.keyboard.press("Tab");
        expect(await scrollY(page), `Tab ${step + 1} leaves the page where it was`).toBe(before);
    }
    await page.keyboard.press("Escape");
    await expect(reportButton(page)).toBeFocused();
    expect(await scrollY(page)).toBe(before);
});
