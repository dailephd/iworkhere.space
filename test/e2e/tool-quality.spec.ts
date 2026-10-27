import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

// Registry-driven guard: every registered tool must have a named journey owner whose spec exists and exercises its route.
const JOURNEY_OWNER: Record<string, string> = {
    "merge-pdf": "pdf-page-copy.spec.ts",
    "split-pdf": "pdf-page-copy.spec.ts",
    "images-to-pdf": "images-to-pdf.spec.ts",
    "pdf-to-image": "pdf-to-image.spec.ts",
    "compress-pdf": "compress-pdf.spec.ts",
    "image-resizer": "image-resizer.spec.ts",
    "image-compressor": "image-compressor.spec.ts",
    "image-converter": "image-converter.spec.ts",
    "heic-converter": "heic-converter.spec.ts",
    "slugify": "tool-content-accessibility.spec.ts",
    "html-text-extractor": "tool-content-accessibility.spec.ts",
    "json-formatter": "json-formatter.spec.ts",
    "word-character-counter": "word-character-counter.spec.ts",
    "qr-code-generator": "qr-code-generator.spec.ts",
    "calculator": "tool-quality.spec.ts",
    "length-converter": "tool-quality.spec.ts",
    "weight-converter": "tool-quality.spec.ts",
    "time-arithmetic": "tool-quality.spec.ts",
};

function registeredToolId(): string[] {
    const source = readFileSync(resolve(process.cwd(), "src/module/tool/registry.ts"), "utf8");
    return [...source.matchAll(/^\s+id: "([a-z0-9-]+)"/gm)].map(match => match[1]);
}

test("every registered tool has a named end-to-end journey owner", () => {
    const registered = registeredToolId();
    expect(registered).toHaveLength(18);
    expect(new Set(registered).size).toBe(registered.length);
    expect(Object.keys(JOURNEY_OWNER).sort()).toEqual([...registered].sort());
    for (const id of registered) {
        const owner = readFileSync(resolve(process.cwd(), "test/e2e", JOURNEY_OWNER[id]), "utf8");
        expect(owner, `${JOURNEY_OWNER[id]} exercises ${id}`).toContain(id);
    }
});

const alertOf = (page: Page) => page.locator("div[role=alert]:not([id])");

test.describe("calculator journey", () => {
    test("evaluates signed, nested and precedence expressions through the keyboard", async ({ page }) => {
        await page.goto("/tool/calculator");
        const expression = page.getByLabel("Expression", { exact: true });
        const result = page.locator("output");
        const accepted: Array<[string, string]> = [
            ["2 * -3", "-6"], ["2 / -2", "-1"], ["1--2", "3"], ["-(2+3)", "-5"], ["2 * (-3)", "-6"],
            ["--2", "2"], ["+2", "2"], ["2 + 3 * 4", "14"], ["(2 + 3) * 4", "20"], ["10 - 4 - 3", "3"],
            ["1 / 3", "0.333333333333"], ["0 * -1", "0"],
        ];
        for (const [input, output] of accepted) {
            await expression.fill(input);
            await expression.press(input.length % 2 ? "Enter" : "=");
            await expect(result, input).toHaveText(output);
            await expect(expression).toHaveValue(input);
            expect(new URL(page.url()).searchParams.get("expr")).toBe(input);
        }
    });

    test("rejects malformed and non-finite expressions with a visible alert and no result", async ({ page }) => {
        await page.goto("/tool/calculator");
        const expression = page.getByLabel("Expression", { exact: true });
        const rejected: Array<[string, string]> = [
            ["", "Enter an expression to calculate."],
            [".", "Invalid number."],
            ["2 3", "Invalid expression."],
            ["2(3)", "Invalid expression."],
            ["2 ** 3", "Invalid expression."],
            ["2 +", "Invalid expression."],
            ["(2 + 3", "Mismatched parentheses."],
            ["2 + 3)", "Mismatched parentheses."],
            ["1 / 0", "Result is not finite."],
        ];
        for (const [input, message] of rejected) {
            await expression.fill(input);
            await expression.press("Enter");
            await expect(alertOf(page), input).toHaveText(message);
            await expect(page.locator("output")).toHaveCount(0);
        }
        await expression.fill("2 * -3");
        await expression.press("Enter");
        await expect(alertOf(page)).toHaveCount(0);
        await expect(page.locator("output")).toHaveText("-6");
    });
});

test.describe("converter journeys", () => {
    for (const converter of [
        { slug: "length-converter", fallback: "3.28084 ft", same: "m", pair: ["mile", "mm"], convert: ["1", "mile", "km", "1.609344 km"] },
        { slug: "weight-converter", fallback: "2.204623 lb", same: "g", pair: ["kg", "g"], convert: ["2", "lb", "oz", "32 oz"] },
    ] as const) {
        test(`${converter.slug}: converts, keeps the largest finite value and rejects true overflow`, async ({ page }) => {
            await page.goto(`/tool/${converter.slug}`);
            const main = page.getByRole("main");
            const value = main.getByLabel("Value", { exact: true });
            const from = main.getByLabel("From", { exact: true });
            const to = main.getByLabel("To", { exact: true });
            const result = main.locator("div.text-2xl");
            await expect(result).toHaveText(converter.fallback);

            const [amount, fromUnit, toUnit, expected] = converter.convert;
            await value.fill(amount);
            await from.selectOption(fromUnit);
            await to.selectOption(toUnit);
            await expect(result).toHaveText(expected);

            await from.selectOption(converter.same);
            await to.selectOption(converter.same);
            await value.fill("1e308");
            await expect(result).toHaveText(`1e+308 ${converter.same}`);
            await value.fill("-1e308");
            await expect(result).toHaveText(`-1e+308 ${converter.same}`);
            await value.fill("0.0000001");
            await expect(result).toHaveText(`0 ${converter.same}`);

            await from.selectOption(converter.pair[0]);
            await to.selectOption(converter.pair[1]);
            await value.fill("1e308");
            await expect(alertOf(page)).toHaveText("Result is out of range for this conversion.");
            await expect(result).toHaveCount(0);
            await expect(main).not.toContainText(/Infinity|NaN/);

            await value.fill("");
            await expect(alertOf(page)).toHaveText("Invalid input: enter a number.");
            await value.fill("1");
            await expect(alertOf(page)).toHaveCount(0);
            await expect(result).toBeVisible();
        });
    }
});

test("time-arithmetic: safe-range boundary is exact and the first unsafe sum is refused", async ({ page }) => {
    await page.goto("/tool/time-arithmetic");
    const timeA = page.getByLabel("Time A", { exact: true });
    const timeB = page.getByLabel("Time B", { exact: true });
    const operation = page.getByLabel("Operation", { exact: true });
    const maximum = "150119987579016:31";

    await operation.selectOption("add");
    await timeA.fill(maximum);
    await timeB.fill("00:00");
    await expect(page.getByText(maximum, { exact: true })).toBeVisible();

    await timeB.fill("00:01");
    await expect(alertOf(page)).toHaveText("The result is too large to calculate exactly.");
    await expect(page.getByText("--:--", { exact: true })).toBeVisible();

    await timeA.fill("150119987579016:32");
    await timeB.fill("00:00");
    await expect(page.getByText("Use HH:MM with two-digit minutes, such as 01:50.", { exact: true })).toBeVisible();
    await expect(alertOf(page)).toHaveCount(0);

    await operation.selectOption("subtract");
    await timeA.fill(maximum);
    await timeB.fill("00:01");
    await expect(page.getByText("150119987579016:30", { exact: true })).toBeVisible();
    await timeA.fill("100:00");
    await timeB.fill("100:00");
    await expect(page.getByText("00:00", { exact: true })).toBeVisible();
});

test.describe("text and developer tool limits", () => {
    test("json-formatter: input over 1 MiB is refused without output and recovers", async ({ page }) => {
        await page.goto("/tool/json-formatter", { waitUntil: "networkidle" });
        const input = page.getByLabel("JSON input", { exact: true });
        const output = page.getByLabel("JSON output", { exact: true });
        await input.fill(`"${"a".repeat(1_048_577)}"`);
        await page.getByRole("button", { name: "Format JSON", exact: true }).click();
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("Input is larger than the 1 MiB limit.");
        await expect(output).toHaveValue("");
        await input.fill('{"b":2,"a":1,"b":3}');
        await page.getByRole("button", { name: "Minify JSON", exact: true }).click();
        await expect(output).toHaveValue('{"b":2,"a":1,"b":3}');
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("");
    });

    test("word-character-counter: input over 1 MiB is refused and clearing recovers", async ({ page }) => {
        await page.goto("/tool/word-character-counter", { waitUntil: "networkidle" });
        const input = page.getByLabel("Text", { exact: true });
        await input.fill("a".repeat(1_048_577));
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("Text is larger than the 1 MiB limit.");
        await input.fill("one two\nthree");
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("");
        await expect(page.getByRole("main").locator("dt", { hasText: /^Words$/ }).locator("xpath=following-sibling::dd[1]")).toHaveText("3");
    });

    test("html-text-extractor: block and line-break text is exact, CSS-hidden text is kept and empty input is empty", async ({ page }) => {
        await page.goto("/tool/html-text-extractor");
        const main = page.getByRole("main");
        const input = main.getByLabel("HTML Input", { exact: true });
        const output = main.getByLabel("Extracted Text", { exact: true });
        const convert = main.getByRole("button", { name: "Convert", exact: true });
        await input.fill("<h1>Title</h1><p>One<br>Two</p><ul><li>A</li><li>B</li></ul><style>p{color:red}</style><script>x()</script>");
        await convert.click();
        await expect(output).toHaveValue("Title\nOne\nTwo\nA\nB");
        await input.fill('<p style="display:none">Hidden</p><p>Shown</p>');
        await convert.click();
        await expect(output).toHaveValue("Hidden\nShown");
        await input.fill("   ");
        await convert.click();
        await expect(output).toHaveValue("");
    });
});
