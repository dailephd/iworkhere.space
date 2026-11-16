import { test, expect } from "./support/fixture";
import type { Page } from "@playwright/test";

async function settle(page: Page) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
}

async function cacheKeyList(page: Page): Promise<string[]> {
    return page.evaluate(async () => {
        const keyList: string[] = [];
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) keyList.push(request.url);
        }
        return keyList;
    });
}

test("warmed controlled Calculator edits, evaluates, clears and recovers offline without navigation", async ({ browser }, testInfo) => {
    // Explicit diagnostics retain the original offline navigation failure as evidence.
    const context = await browser.newContext({ viewport: testInfo.project.use.viewport, baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    const requestList: string[] = [];
    const failureList: string[] = [];
    page.on("request", request => requestList.push(request.url()));
    page.on("pageerror", error => failureList.push(error.message));
    page.on("console", message => { if (message.type() === "error") failureList.push(message.text()); });
    try {
        await page.goto("/tool/calculator");
        await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
        await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
        // Warm the real page and its runtime through the controlling worker.
        await page.reload();
        await settle(page);
        expect((await cacheKeyList(page)).some(url => new URL(url).pathname === "/tool/calculator")).toBe(true);
        expect((await cacheKeyList(page)).some(url => new URL(url).pathname.startsWith("/_next/static/"))).toBe(true);
        await page.evaluate(() => { Object.assign(window, { calculatorDocument: "preserved" }); });
        const start = requestList.length;
        await context.setOffline(true);
        await page.getByLabel("Expression", { exact: true }).fill("7*8");
        await settle(page);
        await page.getByRole("button", { name: "=", exact: true }).click();
        await expect(page.locator("output")).toHaveText("56");
        await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("7*8");
        expect(new URL(page.url()).searchParams.get("expr")).toBe("7*8");

        // Repeated edits include keypad/backspace, both keyboard run controls,
        // invalid input/recovery, Clear and Reset; none may remount the tool.
        await page.getByLabel("Expression", { exact: true }).fill("9*9");
        await page.getByLabel("Expression", { exact: true }).press("Enter");
        await expect(page.locator("output")).toHaveText("81");
        await page.getByRole("button", { name: "C", exact: true }).click();
        await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("");
        await expect(page.locator("output")).toHaveCount(0);
        for (const key of ["7", "×", "8", "⌫", "8", "="]) await page.getByRole("button", { name: key, exact: true }).click();
        await expect(page.locator("output")).toHaveText("56");
        await page.getByLabel("Expression", { exact: true }).fill("2+");
        await page.getByLabel("Expression", { exact: true }).press("=");
        await expect(page.locator('[data-tool-ui] [role="alert"]')).toHaveText("Invalid expression.");
        await page.getByLabel("Expression", { exact: true }).fill("12/3");
        await page.getByLabel("Expression", { exact: true }).press("Enter");
        await expect(page.locator("output")).toHaveText("4");
        // C is the existing Calculator reset control (expression and result).
        await page.getByRole("button", { name: "C", exact: true }).click();
        await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("");
        await expect(page.locator("output")).toHaveCount(0);
        expect(new URL(page.url()).searchParams.has("expr")).toBe(false);
        await page.getByLabel("Expression", { exact: true }).fill("7*8");
        await page.getByLabel("Expression", { exact: true }).press("Enter");
        await expect(page.locator("output")).toHaveText("56");
        await context.setOffline(false);
        await settle(page);
        await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("7*8");
        await expect(page.locator("output")).toHaveText("56");
        await page.getByLabel("Expression", { exact: true }).fill("(2+3)*4");
        await page.getByLabel("Expression", { exact: true }).press("Enter");
        await expect(page.locator("output")).toHaveText("20");
        await settle(page);
        expect(await page.evaluate(() => Reflect.get(window, "calculatorDocument"))).toBe("preserved");
        expect(requestList.slice(start).filter(url => new URL(url).pathname === "/tool/calculator")).toEqual([]);
        for (const url of await cacheKeyList(page)) {
            expect(new URL(url).search).toBe("");
            expect(new URL(url).pathname).not.toMatch(/^\/(?:api\/|_next\/data\/)/);
        }
        expect(failureList).toEqual([]);
    } finally {
        await testInfo.attach("calculator-offline-evidence", { body: JSON.stringify({ url: page.url(), requestList, failureList }, null, 2), contentType: "application/json" });
        await context.setOffline(false);
        await context.close();
    }
});

test("Calculator shares online with direct load and App Router back/forward synchronization", async ({ page, context }) => {
    await page.goto("/discover");
    await settle(page);
    await page.locator('a[href="/tool/calculator"]').first().click();
    await expect(page.getByLabel("Expression", { exact: true })).toBeVisible();
    await settle(page);
    await page.evaluate(() => { Object.assign(window, { calculatorDocument: "preserved" }); });
    const queryRequest: string[] = [];
    page.on("request", request => {
        const url = new URL(request.url());
        if (url.pathname === "/tool/calculator" && url.search) queryRequest.push(request.url());
    });
    // Also exercise a failed connection with navigator.onLine still true.
    await context.route("**/tool/calculator?**", route => route.abort());
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.getByLabel("Expression", { exact: true }).fill("(7+8)*2");
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("30");
    await settle(page);
    expect(new URL(page.url()).searchParams.get("expr")).toBe("(7+8)*2");
    expect(queryRequest).toEqual([]);
    const sharedUrl = page.url();
    const direct = await context.newPage();
    await context.unroute("**/tool/calculator?**");
    await direct.goto(sharedUrl);
    await expect(direct.getByLabel("Expression", { exact: true })).toHaveValue("(7+8)*2");
    await direct.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(direct.locator("output")).toHaveText("30");
    await direct.close();

    // replaceState must not insert an entry for every edit.
    await page.goBack();
    await expect(page).toHaveURL(/\/discover$/);
    await page.goForward();
    await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("(7+8)*2");
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("30");
    // Native history traversal on the same mounted page updates useSearchParams.
    await page.evaluate(() => window.history.pushState(null, "", "?expr=9-4"));
    await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("9-4");
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("5");
    await page.goBack();
    await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("(7+8)*2");
    await page.goForward();
    await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("9-4");
    expect(await page.evaluate(() => Reflect.get(window, "calculatorDocument"))).toBe("preserved");
});
