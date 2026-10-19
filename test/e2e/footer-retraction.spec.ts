import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

// The reporting action only exists in a support-enabled build (see the Batch 1 support-report spec); this flag marks such a run.
const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report a problem or suggestion";

const footer = (page: Page) => page.getByRole("contentinfo");
const hideFooter = (page: Page) => footer(page).getByRole("button", { name: "Hide footer", exact: true });
const showFooter = (page: Page) => footer(page).getByRole("button", { name: "Show footer", exact: true });
const privacyLink = (page: Page) => footer(page).getByRole("link", { name: "Privacy Policy" });
const reportButton = (page: Page) => footer(page).getByRole("button", { name: reportName });

interface FooterGeometry { top: number; bottom: number; left: number; width: number; height: number; viewportHeight: number; viewportWidth: number; position: string }
const footerGeometry = (page: Page): Promise<FooterGeometry> => page.evaluate(() => {
    const element = document.querySelector("footer")!;
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height, viewportHeight: window.innerHeight, viewportWidth: window.innerWidth, position: getComputedStyle(element).position };
});
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const maxScroll = (page: Page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

// Adds a long document tail inside <main>: a spacer, an anchor target, an input and a last button.
async function addTail(page: Page) {
    // Editing <main> before React has hydrated it would read as a hydration mismatch, so wait for the hydrated tree.
    await page.waitForFunction(() => Object.keys(document.querySelector("footer")!).some(key => key.startsWith("__reactFiber")));
    await page.evaluate(() => {
        const main = document.querySelector("main")!;
        const spacer = document.createElement("div");
        spacer.style.height = "3000px";
        const anchor = document.createElement("div");
        anchor.id = "e2e-anchor";
        anchor.textContent = "Anchor target";
        const field = document.createElement("input");
        field.id = "e2e-field";
        field.setAttribute("aria-label", "E2E field");
        const last = document.createElement("button");
        last.id = "e2e-last";
        last.type = "button";
        last.textContent = "Last control";
        main.append(spacer, anchor, field, last);
    });
}

async function collapse(page: Page) {
    await hideFooter(page).click();
    await expect(showFooter(page)).toBeVisible();
}

test("a fresh visitor sees the expanded footer fixed to the bottom of the viewport", async ({ page }) => {
    await page.goto("/discover");
    await expect(hideFooter(page)).toBeVisible();
    await expect(hideFooter(page)).toHaveAttribute("aria-expanded", "true");
    await expect(footer(page)).toContainText("© 2026 iworkhere.space created by dailephd LLC");
    await expect(privacyLink(page)).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("html")).not.toHaveAttribute("data-footer", "collapsed");
    const geometry = await footerGeometry(page);
    expect(geometry.position).toBe("fixed");
    expect(Math.abs(geometry.bottom - geometry.viewportHeight)).toBeLessThanOrEqual(1);
    // The expanded footer stays compact: no more than a fifth of the viewport on either project.
    expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight * 0.2);
});

test("collapsing and expanding keep the footer anchored without navigating or moving the page", async ({ page }) => {
    await page.goto("/discover");
    await addTail(page);
    await page.evaluate(() => window.scrollTo(0, 800));
    const url = page.url();
    const before = await scrollY(page);
    const expanded = await footerGeometry(page);

    await collapse(page);
    await expect(showFooter(page)).toHaveAttribute("aria-expanded", "false");
    await expect(privacyLink(page)).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-footer", "collapsed");
    const collapsed = await footerGeometry(page);
    expect(collapsed.position).toBe("fixed");
    // The retracted footer is a compact tab: shorter than the expanded bar on every project, and a fraction of its occupied area.
    expect(collapsed.height).toBeLessThan(expanded.height);
    expect(collapsed.width * collapsed.height).toBeLessThanOrEqual(0.4 * expanded.width * expanded.height);
    expect(collapsed.height).toBeLessThanOrEqual(collapsed.viewportHeight * 0.06);
    expect(Math.abs(collapsed.left + collapsed.width - collapsed.viewportWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(collapsed.bottom - collapsed.viewportHeight)).toBeLessThanOrEqual(1);
    expect(page.url()).toBe(url);
    expect(await scrollY(page)).toBe(before);

    await showFooter(page).click();
    await expect(hideFooter(page)).toBeVisible();
    await expect(privacyLink(page)).toBeVisible();
    await expect(footer(page)).toContainText("© 2026 iworkhere.space created by dailephd LLC");
    expect(page.url()).toBe(url);
    expect(await scrollY(page)).toBe(before);
    expect(Math.abs((await footerGeometry(page)).height - expanded.height)).toBeLessThanOrEqual(1);
});

test("the collapsed preference survives reload and Privacy Policy returns on expansion", async ({ page }) => {
    await page.goto("/discover");
    await collapse(page);
    await page.reload();
    await expect(showFooter(page)).toBeVisible();
    await expect(privacyLink(page)).toBeHidden();
    await showFooter(page).click();
    await page.reload();
    await expect(hideFooter(page)).toBeVisible();
    await expect(privacyLink(page)).toBeVisible();
    await privacyLink(page).click();
    await expect(page).toHaveURL(/\/privacy$/);
});

test("a saved collapsed footer is already collapsed before hydration, so it never flashes expanded", async ({ page }) => {
    await page.goto("/discover");
    await collapse(page);
    // Block the hydration bundles: only the server HTML, the pre-paint script and the stylesheet run.
    await page.route("**/_next/**/*.js*", route => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-footer", "collapsed");
    await expect(privacyLink(page)).toBeHidden();
    await expect(footer(page).locator('[data-footer-when="collapsed"]')).toBeVisible();
    await expect(footer(page).locator('[data-footer-when="expanded"]')).toBeHidden();
    const geometry = await footerGeometry(page);
    expect(geometry.height).toBeLessThan(geometry.viewportHeight * 0.12);
});

test("the preference survives internal navigation", async ({ page }) => {
    await page.goto("/discover");
    await collapse(page);
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(showFooter(page)).toBeVisible();
    await page.goto("/tool/merge-pdf");
    await expect(showFooter(page)).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(1);
});

test("an invalid saved value falls back to the expanded footer", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("footer-preference", JSON.stringify("bogus")));
    await page.goto("/discover");
    await expect(hideFooter(page)).toBeVisible();
    await expect(privacyLink(page)).toBeVisible();
});

test("unavailable browser storage leaves a working expanded footer for the session", async ({ page }) => {
    await page.addInitScript(() => {
        const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
        Storage.prototype.getItem = blocked;
        Storage.prototype.setItem = blocked;
        Storage.prototype.removeItem = blocked;
    });
    await page.goto("/discover");
    await expect(hideFooter(page)).toBeVisible();
    await collapse(page);
    await showFooter(page).click();
    await expect(hideFooter(page)).toBeVisible();
});

test("the reporting action is directly available in both states", async ({ page }) => {
    await page.goto("/discover");
    if (!supportEnabled) {
        // Public builds expose no reporting entry at all, expanded or collapsed.
        await expect(reportButton(page)).toHaveCount(0);
        await collapse(page);
        await expect(reportButton(page)).toHaveCount(0);
        return;
    }
    await expect(reportButton(page)).toBeVisible();
    expect(await reportButton(page).innerText()).toBe(reportName);
    await collapse(page);
    await expect(reportButton(page)).toBeVisible();
    // Collapsed, the visible text is the short label while the accessible name keeps the full purpose.
    expect(await reportButton(page).innerText()).toBe("Report");
    await expect(page.getByRole("button", { name: reportName })).toHaveCount(1);
    await reportButton(page).click();
    const dialog = page.getByRole("dialog", { name: reportName });
    await expect(dialog).toBeVisible();
    await expect(page.locator("dialog")).toHaveCount(1);
    // The modal dialog is above the fixed footer and keeps focus and Escape.
    const dialogOnTop = await page.evaluate(() => {
        const box = document.querySelector("dialog")!.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 20);
        return !!hit && document.querySelector("dialog")!.contains(hit);
    });
    expect(dialogOnTop).toBe(true);
    expect(await page.evaluate(() => document.querySelector("dialog")!.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(reportButton(page)).toBeFocused();
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(showFooter(page)).toBeVisible();
});

test("the footer is fixed to the viewport bottom on a short page and a long tool page", async ({ page }) => {
    await page.goto("/privacy");
    const short = await footerGeometry(page);
    expect(short.position).toBe("fixed");
    expect(Math.abs(short.bottom - short.viewportHeight)).toBeLessThanOrEqual(1);

    await page.goto("/tool/merge-pdf");
    await addTail(page);
    for (const position of [0, 1200]) {
        await page.evaluate(top => window.scrollTo(0, top), position);
        const geometry = await footerGeometry(page);
        expect(Math.abs(geometry.bottom - geometry.viewportHeight)).toBeLessThanOrEqual(1);
    }
    await maxScroll(page);
    expect(Math.abs((await footerGeometry(page)).bottom - short.viewportHeight)).toBeLessThanOrEqual(1);
});

for (const state of ["expanded", "collapsed"] as const) {
    test(`the last control and an anchor target can be brought fully above the ${state} footer`, async ({ page }) => {
        await page.goto("/tool/merge-pdf");
        await addTail(page);
        if (state === "collapsed") await collapse(page);
        await maxScroll(page);
        const clearance = await page.evaluate(() => {
            const top = document.querySelector("footer")!.getBoundingClientRect().top;
            const last = document.getElementById("e2e-last")!.getBoundingClientRect();
            const main = document.querySelector("main")!.getBoundingClientRect();
            return { footerTop: top, lastBottom: last.bottom, mainBottom: main.bottom };
        });
        expect(clearance.lastBottom).toBeLessThanOrEqual(clearance.footerTop);
        expect(clearance.mainBottom).toBeLessThanOrEqual(clearance.footerTop);

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => { location.hash = "#e2e-anchor"; });
        const anchor = await page.evaluate(() => ({
            bottom: document.getElementById("e2e-anchor")!.getBoundingClientRect().bottom,
            footerTop: document.querySelector("footer")!.getBoundingClientRect().top,
        }));
        expect(anchor.bottom).toBeLessThanOrEqual(anchor.footerTop);
    });
}

test("keyboard focus is visible, and a focused control near the document bottom is not hidden by the footer", async ({ page }) => {
    await page.goto("/tool/merge-pdf");
    await addTail(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#e2e-last").focus();
    const rect = await page.evaluate(() => ({
        bottom: document.getElementById("e2e-last")!.getBoundingClientRect().bottom,
        footerTop: document.querySelector("footer")!.getBoundingClientRect().top,
    }));
    expect(rect.bottom).toBeLessThanOrEqual(rect.footerTop);

    // Keyboard-focusing the toggle shows a real focus outline.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await hideFooter(page).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(hideFooter(page)).toBeFocused();
    const outline = await hideFooter(page).evaluate(element => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await expect(showFooter(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(hideFooter(page)).toBeFocused();
});

test("resizing the viewport updates the one shell clearance and keeps the footer anchored", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/tool/merge-pdf");
    const clearance = () => page.evaluate(() => ({
        variable: parseFloat(document.documentElement.style.getPropertyValue("--footer-clearance")),
        spacer: document.querySelector("[data-footer-spacer]")!.getBoundingClientRect().height,
        footer: document.querySelector("footer")!.getBoundingClientRect().height,
        bottom: document.querySelector("footer")!.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
    }));
    await expect.poll(async () => { const now = await clearance(); return Math.abs(now.spacer - now.footer) <= 1 && Math.abs(now.variable - now.footer) <= 1; }).toBe(true);
    const desktop = await clearance();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => { const now = await clearance(); return Math.abs(now.spacer - now.footer) <= 1 && Math.abs(now.variable - now.footer) <= 1 && now.footer > desktop.footer; }).toBe(true);
    const mobile = await clearance();
    expect(Math.abs(mobile.bottom - mobile.viewportHeight)).toBeLessThanOrEqual(1);
    await collapse(page);
    await expect.poll(async () => { const now = await clearance(); return Math.abs(now.spacer - now.footer) <= 1 && now.footer < mobile.footer; }).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => { const now = await clearance(); return Math.abs(now.spacer - now.footer) <= 1 && Math.abs(now.bottom - now.viewportHeight) <= 1; }).toBe(true);
});

test("a shortened viewport, as when a software keyboard resizes the page, keeps a focused field reachable above the footer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tool/merge-pdf");
    await addTail(page);
    await maxScroll(page);
    // Headless Chromium cannot show a real keyboard; shrinking the layout viewport reproduces the resize-content variant only.
    await page.setViewportSize({ width: 390, height: 360 });
    await page.locator("#e2e-field").focus();
    await expect.poll(() => page.evaluate(() => {
        const field = document.getElementById("e2e-field")!.getBoundingClientRect();
        const footerBox = document.querySelector("footer")!.getBoundingClientRect();
        return field.bottom <= footerBox.top && field.top >= 0 && Math.abs(footerBox.bottom - window.innerHeight) <= 1;
    })).toBe(true);
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(scrollable).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("main")!).overflowY)).toBe("visible");
    await expect(hideFooter(page)).toBeVisible();
});

test("the fixed footer contains no advertising and only the footer region is fixed at the bottom", async ({ page }) => {
    await page.goto("/discover");
    const inspection = await page.evaluate(() => {
        const element = document.querySelector("footer")!;
        const spacer = document.querySelector("[data-footer-spacer]")!;
        const fixedBottom = [...document.querySelectorAll("body *")].filter(node => {
            const style = getComputedStyle(node);
            return style.position === "fixed" && style.bottom === "0px";
        });
        return {
            advertising: element.querySelectorAll("ins.adsbygoogle, [aria-label*='dvertis' i]").length,
            spacerPosition: getComputedStyle(spacer).position,
            spacerBeforeFooter: !!(spacer.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
            fixedBottomOwners: fixedBottom.map(node => node.tagName),
        };
    });
    expect(inspection.advertising).toBe(0);
    expect(inspection.spacerPosition).toBe("static");
    expect(inspection.spacerBeforeFooter).toBe(true);
    expect(inspection.fixedBottomOwners).toEqual(["FOOTER"]);
});

test("the footer does not interfere with the retractable header", async ({ page }) => {
    await page.goto("/discover");
    await addTail(page);
    await page.mouse.wheel(0, 1500);
    const showNavigation = page.getByRole("button", { name: "Show navigation", exact: true });
    await expect(showNavigation).toBeVisible();
    await showNavigation.click();
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    const overlap = await page.evaluate(() => {
        const header = document.querySelector("header")!.getBoundingClientRect();
        const hide = [...document.querySelectorAll("button")].find(button => button.textContent === "Hide navigation")!.getBoundingClientRect();
        const footerBox = document.querySelector("footer")!.getBoundingClientRect();
        return { headerBottom: header.bottom, hideBottom: hide.bottom, footerTop: footerBox.top };
    });
    expect(overlap.hideBottom).toBeLessThan(overlap.footerTop);

    // The footer toggle works while the header overlay is open and the overlay stays open.
    await hideFooter(page).click();
    await expect(showFooter(page)).toBeVisible();
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "overlay");

    // The theme popover opens above the footer layer and its controls receive pointer hits.
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const popover = page.getByRole("dialog", { name: "Appearance settings" });
    await expect(popover).toBeVisible();
    const hit = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Appearance settings"]')!;
        const label = dialog.querySelector("label")!.getBoundingClientRect();
        const target = document.elementFromPoint(label.left + label.width / 2, label.top + label.height / 2);
        return !!target && dialog.contains(target);
    });
    expect(hit).toBe(true);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("header")).toHaveAttribute("data-header-state", "flow");
});

test("the page has one footer and one reporting trigger in every state", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await collapse(page);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.getByRole("button", { name: reportName })).toHaveCount(supportEnabled ? 1 : 0);
});

test("the retracted footer keeps pointer and keyboard targets of at least 24 CSS pixels that do not overlap", async ({ page }) => {
    await page.goto("/discover");
    await collapse(page);
    const targets = await page.evaluate(() => {
        const box = (element: Element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; };
        const controls = [...document.querySelectorAll("footer button")].filter(button => getComputedStyle(button).display !== "none").map(box);
        const footerBox = box(document.querySelector("footer")!);
        return { controls, footerBox };
    });
    expect(targets.controls).toHaveLength(supportEnabled ? 2 : 1);
    for (const control of targets.controls) {
        expect(control.width).toBeGreaterThanOrEqual(24);
        expect(control.height).toBeGreaterThanOrEqual(24);
        expect(control.left).toBeGreaterThanOrEqual(targets.footerBox.left);
        expect(control.right).toBeLessThanOrEqual(targets.footerBox.right + 1);
        expect(control.bottom).toBeLessThanOrEqual(targets.footerBox.bottom + 1);
    }
    if (supportEnabled) expect(targets.controls[0].right).toBeLessThanOrEqual(targets.controls[1].left);
});

test("the retracted footer reclaims workspace beside it that the expanded bar covered", async ({ page }) => {
    await page.goto("/discover");
    const probe = () => page.evaluate(() => {
        const footerBox = document.querySelector("footer")!.getBoundingClientRect();
        // A point at the leading edge of the footer row, where the full-width bar sits and the compact tab does not.
        const hit = document.elementFromPoint(24, footerBox.top + footerBox.height / 2);
        return { coveredByFooter: !!hit && !!hit.closest("footer") };
    });
    expect((await probe()).coveredByFooter).toBe(true);
    await collapse(page);
    expect((await probe()).coveredByFooter).toBe(false);
});

test("collapsing and expanding at the end of the page keep the bottom reachable and the last control above the footer", async ({ page }) => {
    await page.goto("/tool/merge-pdf");
    await addTail(page);
    await maxScroll(page);
    const end = () => page.evaluate(() => {
        const root = document.documentElement;
        const last = document.getElementById("e2e-last")!.getBoundingClientRect();
        const footerBox = document.querySelector("footer")!.getBoundingClientRect();
        const spacer = document.querySelector("[data-footer-spacer]")!.getBoundingClientRect();
        return { scrollY: window.scrollY, maxScroll: root.scrollHeight - window.innerHeight, lastTop: last.top, lastBottom: last.bottom, footerTop: footerBox.top, footerHeight: footerBox.height, spacerHeight: spacer.height, viewportHeight: window.innerHeight };
    });
    // Settled means the shell has caught up with the footer: the in-flow spacer occupies the footer's height and the page rests at its new end.
    const settled = (now: Awaited<ReturnType<typeof end>>) => Math.abs(now.spacerHeight - now.footerHeight) <= 1 && Math.abs(now.scrollY - now.maxScroll) <= 1;
    const expanded = await end();
    expect(settled(expanded)).toBe(true);
    expect(Math.abs(expanded.scrollY - expanded.maxScroll)).toBeLessThanOrEqual(1);
    expect(expanded.lastBottom).toBeLessThanOrEqual(expanded.footerTop);

    // Collapse with the keyboard: focus stays on the visible toggle and the page stays at its end.
    await hideFooter(page).focus();
    await page.keyboard.press("Enter");
    await expect(showFooter(page)).toBeFocused();
    await expect.poll(async () => { const now = await end(); return settled(now) && now.footerHeight < expanded.footerHeight; }).toBe(true);
    const collapsed = await end();
    expect(settled(collapsed)).toBe(true);
    expect(collapsed.lastBottom).toBeLessThanOrEqual(collapsed.footerTop);
    // The shorter document can only move the content by the height the footer gave back: no jump to unrelated content.
    expect(Math.abs(collapsed.lastTop - expanded.lastTop)).toBeLessThanOrEqual(expanded.footerHeight - collapsed.footerHeight + 1);
    expect(collapsed.lastTop).toBeGreaterThanOrEqual(0);
    expect(collapsed.lastBottom).toBeLessThanOrEqual(collapsed.viewportHeight);
    const outline = await showFooter(page).evaluate(element => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    await expect(showFooter(page)).toBeInViewport();

    // Expanding while parked at the end does not leave the last control beneath the taller footer.
    await page.keyboard.press("Enter");
    await expect(hideFooter(page)).toBeFocused();
    await expect.poll(async () => { const now = await end(); return settled(now) && now.footerHeight > collapsed.footerHeight; }).toBe(true);
    const reopened = await end();
    expect(settled(reopened)).toBe(true);
    expect(reopened.lastBottom).toBeLessThanOrEqual(reopened.footerTop);
    expect(Math.abs(reopened.lastTop - expanded.lastTop)).toBeLessThanOrEqual(1);

    // Repeated transitions keep returning to the same two settled geometries, with the page resting at its end each time.
    for (let cycle = 0; cycle < 3; cycle += 1) {
        await page.keyboard.press("Enter");
        await expect(showFooter(page)).toBeFocused();
        await expect.poll(async () => { const now = await end(); return settled(now) && Math.abs(now.footerHeight - collapsed.footerHeight) <= 1; }).toBe(true);
        const tucked = await end();
        expect(tucked.lastBottom).toBeLessThanOrEqual(tucked.footerTop);
        await page.keyboard.press("Enter");
        await expect(hideFooter(page)).toBeFocused();
        await expect.poll(async () => { const now = await end(); return settled(now) && Math.abs(now.footerHeight - expanded.footerHeight) <= 1; }).toBe(true);
        const again = await end();
        expect(again.lastBottom).toBeLessThanOrEqual(again.footerTop);
        expect(Math.abs(again.lastTop - expanded.lastTop)).toBeLessThanOrEqual(1);
    }
});

test("the shell clearance follows a toggle at the end of the page even when resize notifications arrive late", async ({ page }) => {
    // A slow rendering step delays the resize observer. The toggle must not depend on it: the clearance and the page end are right as soon as the click is handled.
    await page.addInitScript(() => {
        const Native = window.ResizeObserver;
        window.ResizeObserver = class {
            private readonly observer: ResizeObserver;
            constructor(callback: ResizeObserverCallback) { this.observer = new Native((entries, source) => { setTimeout(() => callback(entries, source), 1500); }); }
            observe(target: Element) { this.observer.observe(target); }
            unobserve(target: Element) { this.observer.unobserve(target); }
            disconnect() { this.observer.disconnect(); }
        } as unknown as typeof ResizeObserver;
    });
    await page.goto("/tool/merge-pdf");
    await addTail(page);
    await maxScroll(page);
    const geometry = () => page.evaluate(() => {
        const root = document.documentElement;
        const footerBox = document.querySelector("footer")!.getBoundingClientRect();
        const last = document.getElementById("e2e-last")!.getBoundingClientRect();
        return {
            footerHeight: footerBox.height, footerTop: footerBox.top, lastBottom: last.bottom,
            spacerHeight: document.querySelector("[data-footer-spacer]")!.getBoundingClientRect().height,
            fromEnd: Math.abs(window.scrollY - (root.scrollHeight - window.innerHeight)),
        };
    });
    const expectSettled = (now: Awaited<ReturnType<typeof geometry>>) => {
        expect(Math.abs(now.spacerHeight - now.footerHeight)).toBeLessThanOrEqual(1);
        expect(now.fromEnd).toBeLessThanOrEqual(1);
        expect(now.lastBottom).toBeLessThanOrEqual(now.footerTop);
    };
    const expanded = await geometry();
    expectSettled(expanded);

    await hideFooter(page).click();
    const collapsed = await geometry();
    expect(collapsed.footerHeight).toBeLessThan(expanded.footerHeight);
    expectSettled(collapsed);

    await showFooter(page).click();
    const reopened = await geometry();
    expect(reopened.footerHeight).toBeGreaterThan(collapsed.footerHeight);
    expectSettled(reopened);
});

test("collapsing mid-page moves neither the scroll position nor the focus", async ({ page }) => {
    await page.goto("/tool/merge-pdf");
    await addTail(page);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await hideFooter(page).focus();
    const before = await scrollY(page);
    await page.keyboard.press("Enter");
    await expect(showFooter(page)).toBeFocused();
    expect(await scrollY(page)).toBe(before);
    await page.keyboard.press("Enter");
    await expect(hideFooter(page)).toBeFocused();
    expect(await scrollY(page)).toBe(before);
});

// Software keyboards shrink only the visual viewport. Headless Chromium has no keyboard, so these tests replace window.visualViewport with a
// scriptable stand-in: they verify how the application reacts to visual-viewport geometry, not a physical iOS or Android device.
async function installScriptableVisualViewport(page: Page) {
    await page.addInitScript(() => {
        const events = new EventTarget();
        const state = { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 };
        const stand = Object.defineProperties(events, Object.fromEntries(Object.keys(state).map(key => [key, { get: () => state[key as keyof typeof state] }])));
        Object.defineProperty(window, "visualViewport", { value: stand, configurable: true });
        Object.defineProperty(window, "__setVisualViewport", {
            value: (next: Partial<typeof state>) => { Object.assign(state, next); events.dispatchEvent(new Event("resize")); },
        });
    });
}
const setVisualViewport = (page: Page, next: { height?: number; offsetTop?: number; scale?: number }) =>
    page.evaluate(values => (window as unknown as { __setVisualViewport(next: object): void }).__setVisualViewport(values), next);
const footerBottomGap = (page: Page) => page.evaluate(() => window.innerHeight - document.querySelector("footer")!.getBoundingClientRect().bottom);

for (const state of ["expanded", "collapsed"] as const) {
    test(`simulated visual-viewport changes move the ${state} footer with the visible bottom edge and restore it afterwards`, async ({ page }) => {
        await installScriptableVisualViewport(page);
        await page.goto("/tool/merge-pdf");
        await addTail(page);
        if (state === "collapsed") await collapse(page);
        const height = await page.evaluate(() => window.innerHeight);
        const keyboard = 300;

        // The keyboard hides the bottom of the layout viewport while the reader is mid-page: the footer rises above it.
        await page.evaluate(() => window.scrollTo(0, 1200));
        expect(Math.abs(await footerBottomGap(page))).toBeLessThanOrEqual(1);
        await setVisualViewport(page, { height: height - keyboard, offsetTop: 0 });
        await expect.poll(() => footerBottomGap(page)).toBeGreaterThanOrEqual(keyboard - 1);
        expect(await footerBottomGap(page)).toBeLessThanOrEqual(keyboard + 1);
        expect((await footerGeometry(page)).position).toBe("fixed");
        await expect(state === "collapsed" ? showFooter(page) : hideFooter(page)).toBeInViewport();

        // A field that sits behind the raised footer is brought above it, and the document still scrolls normally.
        await page.evaluate(() => {
            const field = document.createElement("input");
            field.id = "e2e-mid-field";
            field.setAttribute("aria-label", "E2E mid-page field");
            field.style.cssText = "position:absolute;left:16px;top:1600px";
            document.body.append(field);
        });
        await page.evaluate(keyboardHeight => {
            const field = document.getElementById("e2e-mid-field")!;
            window.scrollBy(0, field.getBoundingClientRect().bottom - (window.innerHeight - keyboardHeight) + 4);
        }, keyboard);
        await page.locator("#e2e-mid-field").focus();
        await expect.poll(() => page.evaluate(() => {
            const field = document.getElementById("e2e-mid-field")!.getBoundingClientRect();
            return field.bottom <= document.querySelector("footer")!.getBoundingClientRect().top && field.top >= 0;
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
        expect(await page.evaluate(() => document.activeElement?.id)).toBe("e2e-mid-field");

        // The browser pans the visual viewport to the end of the page: the footer is back on the layout bottom edge.
        await setVisualViewport(page, { height: height - keyboard, offsetTop: keyboard });
        await expect.poll(async () => Math.abs(await footerBottomGap(page))).toBeLessThanOrEqual(1);

        // Dismissing the keyboard restores normal geometry, the same clearance and the same state.
        await setVisualViewport(page, { height, offsetTop: 0 });
        await expect.poll(async () => Math.abs(await footerBottomGap(page))).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.querySelector("footer")!.style.transform)).toBe("");
        const restored = await page.evaluate(() => ({
            spacer: document.querySelector("[data-footer-spacer]")!.getBoundingClientRect().height,
            footer: document.querySelector("footer")!.getBoundingClientRect().height,
        }));
        expect(Math.abs(restored.spacer - restored.footer)).toBeLessThanOrEqual(1);
        await expect(state === "collapsed" ? showFooter(page) : hideFooter(page)).toBeVisible();
    });
}

test("a pinch-zoomed visual viewport is not mistaken for a keyboard", async ({ page }) => {
    await installScriptableVisualViewport(page);
    await page.goto("/tool/merge-pdf");
    const height = await page.evaluate(() => window.innerHeight);
    await setVisualViewport(page, { height: height / 2, offsetTop: 0, scale: 2 });
    await expect.poll(async () => Math.abs(await footerBottomGap(page))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.querySelector("footer")!.style.transform)).toBe("");
});

test("real browser page scaling does not displace the footer from the layout viewport bottom", async ({ page }) => {
    await page.goto("/tool/merge-pdf");
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    try {
        await expect.poll(() => page.evaluate(() => window.visualViewport!.scale)).toBeGreaterThan(1.5);
        expect(await page.evaluate(() => document.querySelector("footer")!.style.transform)).toBe("");
        await expect(hideFooter(page)).toBeAttached();
    } finally {
        await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    }
    await expect.poll(async () => Math.abs(await footerBottomGap(page))).toBeLessThanOrEqual(1);
});
