import { test, expect } from "./support/fixture";

test("production registers the served JavaScript service worker", async ({ page, request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/(?:application|text)\/javascript/);
    await page.goto("/");
    const registration = await page.evaluate(async () => {
        const ready = await navigator.serviceWorker.ready;
        return { scope: ready.scope, script: ready.active?.scriptURL };
    });
    expect(registration.scope).toBe("http://127.0.0.1:3100/");
    expect(registration.script).toBe("http://127.0.0.1:3100/sw.js");
});
