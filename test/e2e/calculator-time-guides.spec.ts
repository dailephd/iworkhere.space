import { test, expect } from "./support/fixture";
import type { Page } from "@playwright/test";

const guides = [
    {
        slug: "calculator",
        name: "Calculator",
        section: ["Basic arithmetic", "Operator precedence and parentheses", "Negative numbers", "Invalid expressions and numeric limits", "Sharing expressions and privacy"],
        related: ["time-arithmetic", "length-converter", "weight-converter"],
    },
    {
        slug: "time-arithmetic",
        name: "Time Arithmetic",
        section: ["Adding durations", "Subtracting durations", "Input format and validation", "Durations versus clock times", "Local input and limitations"],
        related: ["calculator", "length-converter"],
    },
];

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

for (const guide of guides) {
    test(`${guide.slug}: guide is server-rendered, related links resolve and the page fits the viewport`, async ({ page, request }) => {
        const response = await request.get(`/tool/${guide.slug}`);
        expect(response.status()).toBe(200);
        const html = await response.text();
        for (const heading of ["How to use", ...guide.section]) expect(html).toContain(heading);

        await page.goto(`/tool/${guide.slug}`);
        await expect(page.getByRole("heading", { level: 1, name: guide.name, exact: true })).toBeVisible();
        const region = page.getByRole("region", { name: "Tool guide" });
        await expect(region.getByRole("heading", { name: "How to use", exact: true })).toBeVisible();
        for (const heading of guide.section) await expect(region.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        for (const slug of guide.related) {
            const link = region.locator(`a[href="/tool/${slug}"]`);
            await expect(link).toHaveCount(1);
            const target = await request.get(`/tool/${slug}`);
            expect(target.status()).toBe(200);
        }
        await expectNoHorizontalOverflow(page);
    });
}

test("calculator: documented examples and errors match the running tool", async ({ page }) => {
    await page.goto("/tool/calculator");
    const expression = page.getByLabel("Expression", { exact: true });
    const result = page.locator("output");
    const examples: Array<[string, string]> = [
        ["2 + 3 * 4", "14"],
        ["(2 + 3) * 4", "20"],
        ["7 / 2", "3.5"],
        ["2 * (-3)", "-6"],
    ];
    for (const [input, output] of examples) {
        await expression.fill(input);
        await expression.press("Enter");
        await expect(result).toHaveText(output);
    }

    await expression.fill("1 / 0");
    await expression.press("Enter");
    await expect(page.getByText("Result is not finite.", { exact: true })).toBeVisible();

    await expression.fill("");
    await page.getByRole("button", { name: "7", exact: true }).click();
    await page.getByRole("button", { name: "÷", exact: true }).click();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.getByRole("button", { name: "=", exact: true }).click();
    await expect(result).toHaveText("3.5");
    await page.getByRole("button", { name: "⌫", exact: true }).click();
    await expect(expression).toHaveValue("7/");
    await page.getByRole("button", { name: "C", exact: true }).click();
    await expect(expression).toHaveValue("");
    await expectNoHorizontalOverflow(page);
});

test("time-arithmetic: documented examples and validation match the running tool", async ({ page }) => {
    await page.goto("/tool/time-arithmetic");
    const timeA = page.getByLabel("Time A", { exact: true });
    const timeB = page.getByLabel("Time B", { exact: true });
    const operation = page.getByLabel("Operation", { exact: true });
    const examples: Array<[string, string, string, string]> = [
        ["01:50", "add", "00:20", "02:10"],
        ["50:00", "add", "50:00", "100:00"],
        ["02:00", "subtract", "00:45", "01:15"],
        ["01:30", "subtract", "01:30", "00:00"],
    ];
    for (const [left, op, right, output] of examples) {
        await operation.selectOption(op);
        await timeA.fill(left);
        await timeB.fill(right);
        await expect(page.getByText(output, { exact: true })).toBeVisible();
    }

    await operation.selectOption("subtract");
    await timeA.fill("00:45");
    await timeB.fill("02:00");
    await expect(page.getByText("Subtraction cannot produce a negative time value.", { exact: true })).toBeVisible();
    await expect(page.locator("div[role=alert]:not([id])")).toHaveText("Subtraction cannot produce a negative time value.");

    await operation.selectOption("add");
    await timeA.fill("01:5");
    await timeB.fill("00:20");
    await expect(page.getByText("Use HH:MM with two-digit minutes, such as 01:50.", { exact: true })).toBeVisible();
    await expect(page.getByText("--:--", { exact: true })).toBeVisible();

    await timeA.fill("01:50");
    expect(new URL(page.url()).search).toBe("");
    await expectNoHorizontalOverflow(page);
});
