import { test, expect } from "./support/fixture";

// Isolate loading measurements from SW cache effects; registration is covered
// separately with service workers enabled in service-worker.spec.ts.
test.use({ serviceWorkers: "block" });

for (const route of ["/", "/discover", "/tool/calculator", "/category/text"]) {
    test(`record production JavaScript resources on ${route}`, async ({ page }, testInfo) => {
        expect((await page.goto(route, { waitUntil: "networkidle" }))?.status()).toBe(200);
        const pageOrigin = new URL(page.url()).origin;
        const resources = await page.evaluate(() =>
            performance.getEntriesByType("resource")
                .filter(entry => new URL(entry.name).pathname.endsWith(".js"))
                .map(entry => {
                    const resource = entry as PerformanceResourceTiming;
                    return {
                        url: resource.name,
                        encodedBodySize: resource.encodedBodySize,
                        transferSize: resource.transferSize,
                        decodedBodySize: resource.decodedBodySize,
                    };
                }),
        );
        expect(resources.length).toBeGreaterThan(0);
        for (const resource of resources) {
            expect(new URL(resource.url).origin).toBe(pageOrigin);
            expect(resource.encodedBodySize).toBeGreaterThan(0);
        }
        await testInfo.attach("javascript-loading", {
            body: JSON.stringify({
                route,
                project: testInfo.project.name,
                count: resources.length,
                encodedBytes: resources.reduce((total, resource) => total + resource.encodedBodySize, 0),
                transferredBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
                reliability: "Fresh context, SW blocked; same-origin local Resource Timing, not a public-network estimate",
                resources,
            }, null, 2),
            contentType: "application/json",
        });
    });
}
