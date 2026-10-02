import { test, expect } from "./support/fixture";

test("verification is available while ads and telemetry remain disabled", async ({ page, request }) => {
    const telemetry: string[] = [];
    page.on("request", request => { if (/\/api\/(metric|log)$/.test(new URL(request.url()).pathname)) telemetry.push(request.url()); });
    await page.goto("/tool/image-resizer?private=secret#local");
    await expect(page.locator('meta[name="google-adsense-account"]')).toHaveAttribute("content", "ca-pub-7976885058339852");
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(0);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Footer banner", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Right advertising area" })).toHaveCount(0);
    expect(await page.evaluate(() => window.adsbygoogle)).toBeUndefined();
    const ads = await request.get("/ads.txt");
    expect(ads.status()).toBe(200);
    expect(ads.headers()["content-type"]).toContain("text/plain");
    expect(await ads.text()).toBe("google.com, pub-7976885058339852, DIRECT, f08c47fec0942fa0\n");
    expect(telemetry).toEqual([]);
});

test("metric API accepts safe navigation and rejects sensitive payloads", async ({ request }) => {
    const base = { type: "navigation", timestamp: new Date().toISOString(), pathname: "/tool/image-resizer", navigationType: "push" };
    expect((await request.post("/api/metric", { data: base })).status()).toBe(204);
    expect((await request.post("/api/metric", { data: { ...base, filename: "private.png" } })).status()).toBe(400);
    expect((await request.post("/api/metric", { data: { ...base, pathname: "/?secret=value" } })).status()).toBe(400);
});
