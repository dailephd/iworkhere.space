import { test, expect } from "../e2e/support/fixture";
import type { MetricRequest } from "../../src/module/observability/metric";

test("Calculator local query edits preserve identity-only telemetry and canonical paths", async ({ page }) => {
    const metric: MetricRequest[] = [];
    const log: unknown[] = [];
    await page.route("**/api/metric", async route => {
        metric.push(route.request().postDataJSON() as MetricRequest);
        await route.fulfill({ status: 204 });
    });
    await page.route("**/api/log", async route => {
        log.push(route.request().postDataJSON());
        await route.fulfill({ status: 204 });
    });
    await page.goto("/tool/calculator?expr=123456%2B7#private-fragment");
    await expect(page.getByLabel("Expression", { exact: true })).toHaveValue("123456+7");
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("123463");
    await page.getByLabel("Expression", { exact: true }).fill("654321/3");
    await page.getByLabel("Expression", { exact: true }).press("Enter");
    await expect(page.locator("output")).toHaveText("218107");
    await expect.poll(() => new URL(page.url()).searchParams.get("expr")).toBe("654321/3");
    await page.getByRole("button", { name: "C", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const analytic = metric.filter(item => item.type === "analytic-event");
    expect(analytic.filter(item => item.event === "tool_opened")).toHaveLength(1);
    expect(analytic.filter(item => item.event === "tool_executed")).toHaveLength(2);
    for (const item of analytic) expect(item.prop).toEqual({ toolId: "calculator", slug: "calculator" });
    for (const item of metric) expect(item.pathname).toBe("/tool/calculator");
    for (const privateValue of ["123456", "123463", "654321", "218107", "private-fragment", "expr="]) {
        expect(JSON.stringify({ metric, log })).not.toContain(privateValue);
    }
});
