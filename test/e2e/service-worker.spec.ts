import { test, expect } from "./support/fixture";
import type { Browser, Page, TestInfo } from "@playwright/test";
import path from "node:path";

const CACHE_NAME = "iworkhere-shell-v0.4.4";
const STATIC_PREFIX_LIST = ["/_next/static/", "/vendor/pdfjs/6.4.299/", "/vendor/qpdf/12.4.2/", "/examples/v0.4.3/", "/examples/v0.4.4/"];

async function waitForControl(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function cachedKeyList(page: Page, name = CACHE_NAME): Promise<string[]> {
    return page.evaluate(async cacheName => {
        if (!(await caches.has(cacheName))) return [];
        const cache = await caches.open(cacheName);
        return (await cache.keys()).map(request => {
            const url = new URL(request.url);
            return url.pathname + url.search;
        });
    }, name);
}

// A separate context keeps deliberate 404 and offline resource failures out of
// the default fixture's zero-error contract; each test asserts explicitly.
async function openPlainContext(browser: Browser, testInfo: TestInfo) {
    const context = await browser.newContext({ viewport: testInfo.project.use.viewport, baseURL: testInfo.project.use.baseURL });
    return { context, page: await context.newPage() };
}

test("production registers the served JavaScript service worker", async ({ page, request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/(?:application|text)\/javascript/);
    await page.goto("/");
    const registration = await page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready;
        return { scope: ready.scope, script: ready.active?.scriptURL };
    });
    const pageOrigin = new URL(page.url()).origin;
    expect(registration.scope).toBe(`${pageOrigin}/`);
    expect(registration.script).toBe(`${pageOrigin}/sw.js`);
});

test("caches only clean HTML pages and allowlisted assets in the versioned cache", async ({ browser }, testInfo) => {
    const { page } = await openPlainContext(browser, testInfo);
    await page.goto("/");
    await waitForControl(page);

    // Excluded classes issued through the controlling worker.
    await page.evaluate(async () => {
        const excludedList: Array<[string, RequestInit?]> = [
            ["/api/health"],
            ["/robots.txt"],
            ["/sitemap.xml"],
            ["/ads.txt"],
            ["/manifest.webmanifest"],
            ["/sw.js"],
            ["/tool/json-formatter", { headers: { RSC: "1" } }],
            ["/tool/json-formatter", { headers: { "Next-Router-Prefetch": "1" } }],
            ["/tool/json-formatter", { headers: { "Next-Router-Segment-Prefetch": "/_tree" } }],
            ["/tool/json-formatter?_rsc=abc123"],
            ["/_next/data/build/tool/json-formatter.json"],
            ["/licenses/heic-to-LICENSE.txt"],
        ];
        for (const [url, init] of excludedList) await fetch(url, init).catch(() => undefined);
    });

    await page.goto("/tool/json-formatter");
    await page.goto("/tool/calculator?expr=2%2B2");
    await page.goto("/__sw-missing-route");
    // A trailing slash redirects; only the final clean page may be stored.
    await page.goto("/privacy/");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect.poll(() => cachedKeyList(page)).toContain("/privacy");

    const keyList = await cachedKeyList(page);
    const htmlPathList = ["/", "/discover", "/tool/json-formatter", "/privacy"];
    for (const key of keyList) {
        const allowed = htmlPathList.includes(key) || STATIC_PREFIX_LIST.some(prefix => key.startsWith(prefix));
        expect(allowed, `unexpected cache entry ${key}`).toBe(true);
        expect(key, "query-bearing entries are never cached").not.toContain("?");
    }
    for (const key of ["/tool/json-formatter", "/privacy"]) expect(keyList).toContain(key);
    expect(keyList.some(key => key.startsWith("/_next/static/"))).toBe(true);
    for (const excluded of ["/api/health", "/robots.txt", "/sitemap.xml", "/ads.txt", "/manifest.webmanifest", "/sw.js", "/_next/data", "/licenses/", "/tool/calculator", "/__sw-missing-route", "/privacy/"]) {
        expect(keyList.some(key => key.startsWith(excluded)), `${excluded} must not be cached`).toBe(false);
    }
    expect(keyList.some(key => key.includes("adsbygoogle") || key.includes("googlesyndication"))).toBe(false);
});

test("online navigation stays fresh and replaces the cached page", async ({ page }) => {
    await page.goto("/");
    await waitForControl(page);
    await page.goto("/privacy");
    await expect.poll(() => cachedKeyList(page)).toContain("/privacy");
    await page.evaluate(async cacheName => {
        const cache = await caches.open(cacheName);
        await cache.put("/privacy", new Response("<!doctype html><title>Stale privacy copy</title>", { headers: { "content-type": "text/html; charset=utf-8" } }));
    }, CACHE_NAME);

    await page.goto("/privacy");
    await expect(page).toHaveTitle("Privacy Policy - iworkhere");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expect.poll(() => page.evaluate(async cacheName => {
        const cache = await caches.open(cacheName);
        return (await (await cache.match("/privacy"))!.text()).includes("Stale privacy copy");
    }, CACHE_NAME)).toBe(false);
});

test("offline serves only the previously cached same page and otherwise reports unavailability", async ({ browser }, testInfo) => {
    const { context, page } = await openPlainContext(browser, testInfo);
    try {
        await page.goto("/");
        await waitForControl(page);
        await page.goto("/privacy");
        await expect.poll(() => cachedKeyList(page)).toContain("/privacy");

        await context.setOffline(true);
        await page.goto("/privacy");
        await expect(page).toHaveTitle("Privacy Policy - iworkhere");
        await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();

        const unwarmed = await page.goto("/about");
        expect(unwarmed!.status()).toBe(503);
        expect(await unwarmed!.text()).toContain("not available offline");
        expect(page.url()).toMatch(/\/about$/);
        await expect(page).not.toHaveTitle(/Privacy Policy/);

        expect(await cachedKeyList(page)).not.toContain("/about");

        // Query-bearing navigations are network only, so offline they fail.
        await expect(page.goto("/tool/calculator?expr=1%2B1")).rejects.toThrow();
    } finally {
        await context.setOffline(false);
        await context.close();
    }
});

test("activation deletes only owned stale caches and keeps unrelated cache names", async ({ page }) => {
    // A plain text route registers no worker, so the stale caches exist before
    // the first install and activation of the current worker.
    await page.goto("/robots.txt");
    await page.evaluate(async () => {
        for (const name of ["app-shell-v1", "iworkhere-shell-v0.4.3", "unrelated-cache-v1", "other-app-shell-v1"]) {
            const cache = await caches.open(name);
            await cache.put("/synthetic", new Response("synthetic"));
        }
    });
    await page.goto("/");
    await waitForControl(page);
    await expect.poll(() => page.evaluate(() => caches.keys().then(list => list.sort()))).toEqual(["iworkhere-shell-v0.4.4", "other-app-shell-v1", "unrelated-cache-v1"]);
});

test("worker bootstrap exception preserves warmed HEIC operation offline", async ({ page, context }) => {
    await page.goto("/tool/heic-converter");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    const fixture = path.resolve("test/fixtures/images/heic-source.heic");
    await page.getByLabel("Choose HEIC image").setInputFiles(fixture);
    await expect(page.getByAltText("Selected HEIC source preview")).toBeVisible();
    await page.getByRole("button", { name: "Convert image", exact: true }).click();
    await expect(page.getByAltText("Converted image preview")).toBeVisible();
    await context.setOffline(true);
    try {
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Choose HEIC image").setInputFiles(fixture);
        await expect(page.getByAltText("Selected HEIC source preview")).toBeVisible();
        await page.getByRole("button", { name: "Convert image", exact: true }).click();
        await expect(page.getByAltText("Converted image preview")).toBeVisible();
    } finally { await context.setOffline(false); }
});
