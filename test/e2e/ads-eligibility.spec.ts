import { expect, test } from "./support/fixture";
import { getConsoleFailure } from "./support/browserDiagnostic";

const enabledTestMode = process.env.E2E_ADS_ENABLED === "true";

test("disabled mode emits no advertising on tools, navigation pages or errors", async ({ page, request }) => {
    test.skip(enabledTestMode, "This scenario runs with the default-off production build.");

    const routes: Array<[string, number]> = [
        ["/tool/json-formatter", 200],
        ["/", 200],
        ["/discover", 200],
        ["/category/developer", 200],
        ["/privacy", 200],
        ["/tool/__f02-missing-tool", 404],
        ["/category/__f02-missing-category", 404],
        ["/__f02-missing-route", 404],
        ["/api/health", 200],
    ];

    for (const [route, expectedStatus] of routes) {
        const response = await request.get(route);
        expect(response.status()).toBe(expectedStatus);
        const html = await response.text();
        expect(html).not.toContain("adsbygoogle");
        expect(html).not.toContain('id="google-adsense"');
        expect(html).not.toContain("Advertisement");
    }

    await page.goto("/tool/json-formatter");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(0);
    await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.adsbygoogle)).toBeUndefined();

    const privacyResponse = await request.get("/privacy");
    expect(privacyResponse.status()).toBe(200);
    const privacyHtml = await privacyResponse.text();
    expect(privacyHtml).toContain(">Privacy Policy</h1>");
    expect(privacyHtml).toContain("Tool inputs and local processing");
    expect(privacyHtml).not.toContain("adsbygoogle.js");
    expect(privacyHtml).not.toContain('id="google-adsense"');
    expect(privacyHtml).not.toContain("Advertisement");

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tool inputs and local processing" })).toBeVisible();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(0);
    await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
    await expect(page.locator('aside[aria-label*="advertising area"]')).toHaveCount(0);
    await expect(page.locator("main .mb-6.border-y")).toHaveCount(0);
    expect(await page.evaluate(() => window.adsbygoogle)).toBeUndefined();
});

test("enabled mode limits manual ads to registered tool pages across client navigation", async ({ page, request }) => {
    test.skip(!enabledTestMode, "This scenario runs with the controlled enabled production build.");

    const interceptedAdRequests: string[] = [];
    const blockedAdRequests: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.addInitScript(() => {
        window.__adInitializationCount = 0;
        const queue = window.adsbygoogle ?? [];
        queue.push = () => ++window.__adInitializationCount;
        window.adsbygoogle = queue;
    });
    await page.route(/https?:\/\/[^/]*(?:googlesyndication\.com|doubleclick\.net|googleadservices\.com|google\.com\/pagead)\//, async route => {
        const url = route.request().url();
        if (url.includes("/pagead/js/adsbygoogle.js")) {
            interceptedAdRequests.push(url);
            await route.fulfill({
                status: 200,
                contentType: "application/javascript",
                body: "window.adsbygoogle = window.adsbygoogle || []; window.__adScriptLoadCount = (window.__adScriptLoadCount || 0) + 1;",
            });
            return;
        }
        blockedAdRequests.push(url);
        await route.abort();
    });

    const ineligibleRoutes: Array<[string, number]> = [
        ["/", 200],
        ["/discover", 200],
        ["/category/developer", 200],
        ["/privacy", 200],
        ["/tool/__f02-missing-tool", 404],
        ["/category/__f02-missing-category", 404],
        ["/__f02-missing-route", 404],
        ["/api/health", 200],
    ];
    for (const [route, expectedStatus] of ineligibleRoutes) {
        const response = await request.get(route);
        expect(response.status()).toBe(expectedStatus);
        const html = await response.text();
        expect(html).not.toContain("adsbygoogle");
        expect(html).not.toContain('id="google-adsense"');
        expect(html).not.toContain("Advertisement");
    }

    const invalidTool = await request.get("/tool/__f02-missing-tool");
    const invalidCategory = await request.get("/category/__f02-missing-category");
    expect(invalidTool.status()).toBe(404);
    expect(invalidCategory.status()).toBe(404);

    const eligibleResponse = await request.get("/tool/json-formatter");
    const eligibleHtml = await eligibleResponse.text();
    expect(eligibleResponse.status()).toBe(200);
    expect(eligibleHtml).toContain('href="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7976885058339852"');
    expect(eligibleHtml).toContain('data-ad-slot="4100977160"');
    expect(eligibleHtml).toContain('data-ad-slot="2496999884"');
    expect(eligibleHtml.match(/Advertisement/g)).toHaveLength(2);

    const privacyResponse = await request.get("/privacy");
    expect(privacyResponse.status()).toBe(200);
    const privacyHtml = await privacyResponse.text();
    expect(privacyHtml).toContain(">Privacy Policy</h1>");
    expect(privacyHtml).toContain("Tool inputs and local processing");
    expect(privacyHtml).not.toContain("adsbygoogle.js");
    expect(privacyHtml).not.toContain('id="google-adsense"');
    expect(privacyHtml).not.toContain("Advertisement");

    await page.goto("/tool/json-formatter");
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(2);
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(1);
    await expect(page.locator('aside[aria-label="Right advertising area"]')).toHaveCount(1);
    const rightRail = page.locator('aside[aria-label="Right advertising area"]');
    if (await page.evaluate(() => window.matchMedia("(min-width: 1280px)").matches)) await expect(rightRail).toBeVisible();
    else await expect(rightRail).toBeHidden();
    const perPageInitializationCount = await page.evaluate(() => window.matchMedia("(min-width: 1280px)").matches ? 2 : 1);
    await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(perPageInitializationCount);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__adScriptLoadCount ?? 0)).toBe(1);
    expect(interceptedAdRequests).toHaveLength(1);

    const toolInitializationCount = await page.evaluate(() => window.__adInitializationCount);
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { next?: { router?: unknown } }).next?.router))).toBe(true);
    await page.evaluate(() => {
        const next = (window as unknown as { next: { router: { push: (url: string) => void } } }).next;
        next.router.push("/privacy");
    });
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tool inputs and local processing" })).toBeVisible();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
    await expect(page.locator('aside[aria-label*="advertising area"]')).toHaveCount(0);
    await expect(page.locator("main .mb-6.border-y")).toHaveCount(0);
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(1);
    expect(await page.evaluate(() => window.__adInitializationCount)).toBe(toolInitializationCount);
    expect(await page.evaluate(() => window.__adScriptLoadCount)).toBe(1);
    expect(await page.evaluate(() => window.adsbygoogle)).toBeDefined();
    expect(interceptedAdRequests).toHaveLength(1);
    expect(blockedAdRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const initialInitializationCount = await page.evaluate(() => window.__adInitializationCount);
    await page.locator('nav[aria-label="Primary navigation"] a[href="/category/developer"]').click();
    await expect(page).toHaveURL(/\/category\/developer$/);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__adInitializationCount)).toBe(initialInitializationCount);
    expect(await page.evaluate(() => window.__adScriptLoadCount)).toBe(1);
    expect(await page.evaluate(() => window.adsbygoogle)).toBeDefined();
    expect(interceptedAdRequests).toHaveLength(1);

    await page.locator('main a[href="/tool/json-formatter"]').click();
    await expect(page).toHaveURL(/\/tool\/json-formatter$/);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(initialInitializationCount + perPageInitializationCount);

    const secondPageInitializationCount = await page.evaluate(() => window.__adInitializationCount);
    await page.locator('nav[aria-label="Primary navigation"] a[href="/category/developer"]').click();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await page.locator('main a[href="/tool/json-formatter"]').click();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(secondPageInitializationCount + perPageInitializationCount);
    expect(interceptedAdRequests).toHaveLength(1);
    expect(blockedAdRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

declare global {
    interface Window {
        __adInitializationCount: number;
        __adScriptLoadCount?: number;
        __f02FailTool?: boolean;
        __f02DocumentId?: string;
    }
}

test("tool render failures remove ads atomically and retry and navigation recover safely", async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    // A separate context keeps deliberately handled exceptions out of the default
    // fixture's zero-error contract. Unexpected errors still fail this scenario.
    const context = await browser.newContext({ viewport: testInfo.project.use.viewport });
    const page = await context.newPage();
    const unexpectedDiagnostics: string[] = [];
    const handledDiagnostics: string[] = [];
    const expected404Diagnostics: string[] = [];
    const scriptRequests: string[] = [];
    const blockedAdRequests: string[] = [];
    const controlledFailure = "F02 controlled tool render failure";
    page.on("pageerror", error => unexpectedDiagnostics.push(error.message));
    page.on("console", message => {
        const diagnostic = getConsoleFailure({ type: message.type(), text: message.text() });
        if (!diagnostic) return;
        if (message.type() === "error" && message.text().includes(controlledFailure)) handledDiagnostics.push(message.text());
        else if (message.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)"
            && new URL(message.location().url).pathname === "/__f02-missing-route") expected404Diagnostics.push(message.text());
        else unexpectedDiagnostics.push(diagnostic);
    });
    await context.route(/https?:\/\/([^/]*\.)?(googlesyndication\.com|doubleclick\.net|googleadservices\.com)\//, async route => {
        if (enabledTestMode && route.request().url().includes("/pagead/js/adsbygoogle.js")) {
            scriptRequests.push(route.request().url());
            await route.fulfill({ status: 200, contentType: "application/javascript",
                body: "window.__adScriptLoadCount = (window.__adScriptLoadCount || 0) + 1;" });
        } else {
            blockedAdRequests.push(route.request().url());
            await route.abort();
        }
    });
    await context.addInitScript(message => {
        window.__f02FailTool = false;
        window.__f02DocumentId = crypto.randomUUID();
        window.__adInitializationCount = 0;
        const queue = window.adsbygoogle ?? [];
        queue.push = () => ++window.__adInitializationCount;
        window.adsbygoogle = queue;
        const encode = TextEncoder.prototype.encode;
        // measureText calls encode during render, including for the empty initial
        // value after retry. This browser-only API fault leaves production tools
        // and route registration untouched.
        TextEncoder.prototype.encode = function (input) {
            if (window.__f02FailTool && (input === "" || input === "F02 controlled failure")) throw new Error(message);
            return encode.call(this, input);
        };
    }, controlledFailure);
    const baseUrl = testInfo.project.use.baseURL!;
    const navigate = async (path: string) => {
        // Next 16's installed app-router-instance exposes its real client router
        // here; use it to exercise unknown routes without inventing public links.
        await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { next?: { router?: unknown } }).next?.router))).toBe(true);
        await page.evaluate(href => {
            const next = (window as unknown as { next: { router: { push: (url: string) => void } } }).next;
            next.router.push(href);
        }, path);
        await expect(page).toHaveURL(new URL(path, baseUrl).href);
    };
    const expectNoFrame = async () => {
        await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
        await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
        await expect(page.locator('aside[aria-label="Right advertising area"]')).toHaveCount(0);
        await expect(page.locator("main .mb-6.border-y")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    };
    const expectFallback = async (initializations: number) => {
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
        await expectNoFrame();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => window.__adInitializationCount)).toBe(initializations);
        const gap = await page.evaluate(() => {
            const main = document.querySelector("main")!;
            const fallback = main.querySelector("h3")!.parentElement!;
            return fallback.getBoundingClientRect().top - main.getBoundingClientRect().top - parseFloat(getComputedStyle(main).paddingTop);
        });
        expect(Math.abs(gap)).toBeLessThan(1);
    };
    try {
        await page.goto(new URL("/tool/word-character-counter", baseUrl).href);
        await expect(page.getByLabel("Text", { exact: true })).toBeVisible();
        const placements = enabledTestMode ? (testInfo.project.use.viewport!.width >= 1280 ? 2 : 1) : 0;
        await expect(page.locator("ins.adsbygoogle")).toHaveCount(enabledTestMode ? 2 : 0);
        await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(placements);
        if (enabledTestMode) {
            await expect.poll(() => page.evaluate(() => window.__adScriptLoadCount ?? 0)).toBe(1);
            const headerUnit = await page.locator('ins[data-ad-slot="4100977160"]').boundingBox();
            expect(headerUnit!.height).toBeGreaterThanOrEqual(testInfo.project.use.viewport!.width < 640 ? 100 : 90);
        }
        await testInfo.attach("healthy-tool", { body: await page.screenshot(), contentType: "image/png" });
        await page.evaluate(() => { window.__f02FailTool = true; });
        await page.getByLabel("Text", { exact: true }).fill("F02 controlled failure");
        await expectFallback(placements);
        await testInfo.attach("ad-free-fallback", { body: await page.screenshot(), contentType: "image/png" });

        await page.getByRole("button", { name: "Try again" }).click();
        await expectFallback(placements);
        await page.evaluate(() => { window.__f02FailTool = false; });
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByLabel("Text", { exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(2 * placements);
        await page.getByLabel("Text", { exact: true }).fill("Recovered healthy tool");
        expect(await page.evaluate(() => window.__adInitializationCount)).toBe(2 * placements);
        await testInfo.attach("recovered-tool", { body: await page.screenshot(), contentType: "image/png" });

        await page.evaluate(() => { window.__f02FailTool = true; });
        await page.getByLabel("Text", { exact: true }).fill("F02 controlled failure");
        await expectFallback(2 * placements);
        await navigate("/tool/json-formatter");
        await expect(page.getByLabel("JSON input")).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(3 * placements);
        await navigate("/tool/word-character-counter");
        await expectFallback(3 * placements);

        for (const route of ["/", "/category/text"]) {
            await navigate(route);
            await expectNoFrame();
            await navigate("/tool/word-character-counter");
            await expectFallback(3 * placements);
        }
        await page.evaluate(() => { window.__f02FailTool = false; });
        await navigate("/tool/json-formatter");
        await expect(page.getByLabel("JSON input")).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(4 * placements);
        expect(scriptRequests).toHaveLength(enabledTestMode ? 1 : 0);
        expect(await page.evaluate(() => window.__adScriptLoadCount ?? 0)).toBe(enabledTestMode ? 1 : 0);

        await page.evaluate(() => { window.__f02FailTool = true; });
        await navigate("/tool/word-character-counter");
        await expectFallback(4 * placements);
        const previousDocument = await page.evaluate(() => window.__f02DocumentId);
        const unknownResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/__f02-missing-route" && response.status() === 404);
        await navigate("/__f02-missing-route");
        expect((await unknownResponse).status()).toBe(404);
        await expect(page.getByText("This page could not be found.")).toBeVisible();
        await expectNoFrame();
        // Unknown routes may require a new document. Do not misrepresent a fresh
        // runtime after a full navigation as unloading an executed script.
        const newDocument = await page.evaluate(id => window.__f02DocumentId !== id, previousDocument);
        const priorInitializations = newDocument ? 0 : 4 * placements;
        expect(await page.evaluate(() => window.__adInitializationCount)).toBe(priorInitializations);
        await page.evaluate(() => { window.__f02FailTool = false; });
        await navigate("/tool/json-formatter");
        await expect(page.getByLabel("JSON input")).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__adInitializationCount)).toBe(priorInitializations + placements);
        expect(scriptRequests).toHaveLength(enabledTestMode ? (newDocument ? 2 : 1) : 0);
        await testInfo.attach("unknown-route-navigation", { body: JSON.stringify({ newDocument, priorInitializations, expected404Diagnostics }), contentType: "application/json" });
        expect(blockedAdRequests).toEqual([]);
        expect(unexpectedDiagnostics).toEqual([]);
        expect(handledDiagnostics.length).toBeGreaterThan(0);
        await testInfo.attach("controlled-error-diagnostics", { body: JSON.stringify(handledDiagnostics), contentType: "application/json" });
    } finally { await context.close(); }
});
