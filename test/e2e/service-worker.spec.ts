import { test, expect } from "./support/fixture";
import path from "node:path";

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
