import type { Page } from "@playwright/test";
import { test, expect } from "../e2e/support/fixture";
import type { MetricRequest } from "../../src/module/observability/metric";

interface ToolCase { slug: string; name: string }

const toolCase: ToolCase[] = [
    { slug: "length-converter", name: "Length Converter" },
    { slug: "weight-converter", name: "Weight Converter" },
    { slug: "time-arithmetic", name: "Time Arithmetic" },
    { slug: "json-formatter", name: "JSON Formatter / Validator" },
];

async function settle(page: Page) {
    await page.waitForLoadState("networkidle");
    // Keep collecting after the first event and after effects/network settle.
    // An immediate first-request assertion would miss the original duplicate.
    await page.waitForTimeout(500);
}

for (const tool of toolCase) {
    test(`${tool.name}: one open per direct, reload, client and history opening`, async ({ page }) => {
        const metric: MetricRequest[] = [];
        await page.route("**/api/metric", async route => {
            metric.push(route.request().postDataJSON() as MetricRequest);
            await route.fulfill({ status: 204 });
        });
        await page.route("**/api/log", route => route.fulfill({ status: 204 }));
        const pathname = `/tool/${tool.slug}`;
        const opens = () => metric.filter(item => item.type === "analytic-event" && item.event === "tool_opened");
        async function expectOpening(count: number) {
            await expect(page.getByRole("heading", { name: tool.name, exact: true, level: 1 })).toBeVisible();
            await settle(page);
            expect(opens()).toHaveLength(count);
            for (const item of opens()) {
                expect(item).toMatchObject({ type: "analytic-event", event: "tool_opened", pathname,
                    prop: { toolId: tool.slug, slug: tool.slug } });
                if (item.type === "analytic-event") expect(Object.keys(item.prop).sort()).toEqual(["slug", "toolId"]);
            }
        }

        await page.goto(pathname);
        await expectOpening(1);
        await page.reload();
        await expectOpening(2);

        // Use a real application Link, and prove that the document survived the
        // transition (a full document navigation would also emit an initial open).
        await page.goto("/discover");
        await settle(page);
        await page.evaluate(() => { Object.assign(window, { telemetryDocument: "same-document" }); });
        await page.locator(`a[href="${pathname}"]`).first().click();
        await expectOpening(3);
        expect(await page.evaluate(() => Reflect.get(window, "telemetryDocument"))).toBe("same-document");
        await page.goBack();
        await expect(page).toHaveURL(/\/discover$/);
        await settle(page);
        expect(opens()).toHaveLength(3);
        await page.goForward();
        await expectOpening(4);

        const start = metric.length;
        if (tool.slug === "length-converter" || tool.slug === "weight-converter") {
            await page.getByLabel("Value", { exact: true }).fill("123456");
        } else if (tool.slug === "time-arithmetic") {
            await page.getByLabel("Time A", { exact: true }).fill("01:50");
            await page.getByLabel("Time B", { exact: true }).fill("00:20");
        } else {
            await page.locator("#json-input").fill('{"private":"synthetic-marker"}');
            await page.getByRole("button", { name: "Format JSON", exact: true }).click();
        }
        await settle(page);
        expect(opens()).toHaveLength(4);
        const computation = metric.slice(start).filter(item => item.type === "analytic-event");
        expect(computation).toHaveLength(1);
        for (const item of computation) {
            expect(item).toMatchObject({ event: "tool_executed", prop: { toolId: tool.slug, slug: tool.slug } });
            if (item.type === "analytic-event") expect(item.prop).toEqual({ toolId: tool.slug, slug: tool.slug });
        }
        expect(JSON.stringify(metric)).not.toContain("synthetic-marker");
        expect(JSON.stringify(metric)).not.toContain("123456");
    });
}
