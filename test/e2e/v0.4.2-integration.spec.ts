import type { Page } from "@playwright/test";
import { getConsoleFailure } from "./support/browserDiagnostic";
import { test, expect } from "./support/fixture";

// These scenarios exercise the real header, footer and SupportDialog together. They need a support-enabled build (see footer-retraction.spec.ts);
// a public build exposes no reporting entry, so the scenario asserts that absence instead.
const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report Issues — report a problem or suggestion";
const reportDialogName = "Report a problem or suggestion";

const showNavigation = (page: Page) => page.getByRole("button", { name: "Show navigation", exact: true });
const hideNavigation = (page: Page) => page.getByRole("button", { name: "Hide navigation", exact: true });
const hideFooter = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: "Hide footer", exact: true });
const showFooter = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: "Show footer", exact: true });
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
    await expect(showNavigation(page)).toBeVisible();
}

// The shared fixture already fails any test that logs a page error or hydration diagnostic; these scenarios additionally assert the load itself is clean
// for a fresh visitor and for each saved footer preference, and that nothing was duplicated by hydration.
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

        if (saved === "collapsed") await expect(page.locator("html")).toHaveAttribute("data-footer", "collapsed");
        else await expect(page.locator("html")).not.toHaveAttribute("data-footer", "collapsed");
        await expect(saved === "collapsed" ? showFooter(page) : hideFooter(page)).toBeVisible();
        await expect(page.locator("header")).toHaveCount(1);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(page.locator("dialog")).toHaveCount(0);
        await expect(reportButton(page)).toHaveCount(supportEnabled ? 1 : 0);
        expect(diagnostics).toEqual([]);
    });
}

for (const footerState of ["expanded", "collapsed"] as const) {
    test(`header, ${footerState} footer and the real report dialog work together`, async ({ page }) => {
        await page.goto("/discover");
        await waitForHydration(page);
        if (footerState === "collapsed") {
            await hideFooter(page).click();
            await expect(showFooter(page)).toBeVisible();
        }
        if (!supportEnabled) {
            await expect(reportButton(page)).toHaveCount(0);
            await expect(page.locator("dialog")).toHaveCount(0);
            return;
        }
        await openScrolledPage(page);

        // The original header has left the viewport; the retractable control expands that same header.
        await showNavigation(page).click();
        await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
        await expect(page.locator("header")).toHaveCount(1);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(1);
        const scrolled = await scrollY(page);
        expect(scrolled).toBeGreaterThan(0);

        // The one report trigger opens the real dialog, which sits above the header overlay and the footer.
        await expect(page.getByRole("button", { name: reportName })).toHaveCount(1);
        await reportButton(page).click();
        const dialog = page.getByRole("dialog", { name: reportDialogName });
        await expect(dialog).toBeVisible();
        await expect(page.locator("dialog")).toHaveCount(1);
        expect(await page.locator("dialog").evaluate(element => (element as HTMLDialogElement).open && element.matches(":modal"))).toBe(true);
        expect(await dialog.evaluate(element => {
            const box = element.getBoundingClientRect();
            const probes = [[box.left + 12, box.top + 12], [box.right - 12, box.top + 12], [box.left + box.width / 2, box.top + box.height / 2]];
            return probes.every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
        })).toBe(true);

        // Pointer: a field receives focus on click. Keyboard: Tab (which may leave the page for the browser) never lands on the footer or header.
        const category = dialog.getByLabel(/What kind of report is this/);
        await category.click();
        await expect(category).toBeFocused();
        for (let step = 0; step < 14; step += 1) {
            await page.keyboard.press("Tab");
            expect(await insideChrome(page), `Tab ${step + 1} does not reach the header or footer`).toBe(false);
        }
        await category.focus();
        await page.keyboard.press("Shift+Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);

        // Escape closes only the dialog: the header stays expanded and focus returns to the originating trigger.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
        await expect(reportButton(page)).toBeFocused();
        expect(await scrollY(page)).toBe(scrolled);
        await expect(hideNavigation(page)).toBeVisible();

        // Header navigation and the theme popover still behave afterwards.
        await page.getByRole("button", { name: "Themes", exact: true }).click();
        const popover = page.getByRole("dialog", { name: "Appearance settings" });
        await expect(popover).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(popover).toBeHidden();
        await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
        await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Home" }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator("header")).toHaveCount(1);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(footerState === "collapsed" ? showFooter(page) : hideFooter(page)).toBeVisible();
    });

    test(`the ${footerState} footer controls cannot take focus while the report dialog is open, and the page does not move`, async ({ page }) => {
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
        await page.evaluate(() => window.scrollTo(0, 900));
        if (footerState === "collapsed") await hideFooter(page).click();
        const before = await scrollY(page);
        await reportButton(page).click();
        const dialog = page.getByRole("dialog", { name: reportDialogName });
        await expect(dialog).toBeVisible();

        const footerToggle = page.getByRole("contentinfo").getByRole("button", { name: footerState === "collapsed" ? "Show footer" : "Hide footer", exact: true });
        // The footer is inert behind the modal: it can neither be focused nor receive a pointer hit.
        await footerToggle.evaluate(element => (element as HTMLElement).focus());
        expect(await page.evaluate(() => !!document.activeElement?.closest("footer"))).toBe(false);
        expect(await page.evaluate(() => {
            const box = document.querySelector("footer")!.getBoundingClientRect();
            const hit = document.elementFromPoint(box.right - 20, box.top + box.height / 2);
            return !!hit && !!hit.closest("footer");
        })).toBe(false);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(reportButton(page)).toBeFocused();
        expect(await scrollY(page)).toBe(before);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(page.locator("dialog")).toHaveCount(0);
    });
}

test("tabbing through the report dialog never scrolls the page behind it, even where its fields sit over the footer", async ({ page }) => {
    // On a shorter screen the dialog's lower fields overlap the footer; the footer's keyboard avoidance must not move the inert page for them.
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
    await page.evaluate(() => window.scrollTo(0, 900));
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
