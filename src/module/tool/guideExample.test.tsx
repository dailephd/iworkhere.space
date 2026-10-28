/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { COUNTER_GUIDE_DECOMPOSED, COUNTER_GUIDE_FAMILY, JSON_GUIDE_EXAMPLE, JSON_GUIDE_MEMBER, QR_GUIDE_EXAMPLE, getToolGuide } from "./guide";
import { JsonFormatterTool } from "./developer/JsonFormatterTool";
import { formatJson, minifyJson } from "./developer/jsonFormat";
import { WordCharacterCounterTool } from "./text/WordCharacterCounterTool";
import { measureText } from "./text/textMetric";
import { QrCodeGeneratorTool } from "./everyday/QrCodeGeneratorTool";
import { generateQrRaster, QR_MAX_PAYLOAD_BYTES } from "./everyday/qrCode";
import { LengthConverterTool } from "./everyday/LengthConverterTool";
import { WeightConverterTool } from "./everyday/WeightConverterTool";
import { extractHtmlText } from "./text/extractHtmlText";
import { CalculatorTool } from "./math/CalculatorTool";
import { TimeArithmeticTool } from "./time/TimeArithmeticTool";
import { calculateTime } from "./time/timeArithmetic";

vi.mock("@/module/observability", () => ({ trackEvent: vi.fn() }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

it.each([
    { id: "length-converter", Component: LengthConverterTool, example: "3.28084 ft", to: "cm", second: "100 cm", units: ["m", "km", "cm", "mm", "inch", "ft", "yd", "mile"] },
    { id: "weight-converter", Component: WeightConverterTool, example: "2.204623 lb", to: "g", second: "1000 g", units: ["g", "kg", "lb", "oz"] },
])("verifies $id guide examples against rendered conversion output", async ({ id, Component, example, to, second, units }) => {
    await act(async () => root.render(createElement(Component, { toolId: id })));
    const guide = getToolGuide(id)!;
    const prose = guide.section.map(section => section.text).join(" ");
    expect(prose).toContain(example);
    expect(host.textContent).toContain(example);
    const labels = [...host.querySelectorAll("label")].map(label => label.textContent!.trim());
    expect(labels).toEqual(["Value", "From", "To"]);
    for (const label of labels) expect(guide.instruction.join(" ")).toContain(label);
    const select = host.querySelectorAll("select")[1];
    expect([...select.options].map(option => option.value)).toEqual(units);
    await act(async () => { select.value = to; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain(second);
    expect(prose).toContain(second);
    const input = host.querySelector("input")!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.textContent).toContain("Invalid input: enter a number.");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Invalid input: enter a number.");
    expect(prose).toContain("Invalid input: enter a number.");
    expect(prose).toContain("Result is out of range for this conversion.");
});

it("verifies the HTML guide example and CSS visibility limitation through the real parser", () => {
    const html = "<p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script>";
    const prose = getToolGuide("html-text-extractor")!.section.map(section => section.text).join(" ");
    expect(prose).toContain(html);
    expect(extractHtmlText(html)).toBe("Hello world\nNext line");
    expect(extractHtmlText('<p style="display:none">Hidden</p><style>p{color:red}</style><p>Shown</p>')).toBe("Hidden\nShown");
    expect(extractHtmlText(" ")).toBe("");
});

async function evaluate(expression: string) {
    await act(async () => root.render(createElement(CalculatorTool, { toolId: "calculator", query: { expr: expression } })));
    const input = host.querySelector("input")!;
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
    return host.querySelector("output")?.textContent ?? host.textContent;
}

it.each([
    ["2 + 3 * 4", "14"],
    ["(2 + 3) * 4", "20"],
    ["7 / 2", "3.5"],
    ["0.5 + 0.25", "0.75"],
    ["-5 + 2", "-3"],
    ["2 * (-3)", "-6"],
    ["2 * -3", "-6"],
    ["2 / -2", "-1"],
    ["1--2", "3"],
    ["-(2 + 3)", "-5"],
    ["--2", "2"],
    ["1 / 3", "0.333333333333"],
    ["0.1 + 0.2", "0.3"],
])("verifies the calculator guide example %s = %s against the real component", async (expression, result) => {
    const prose = getToolGuide("calculator")!.section.map(section => section.text).join(" ");
    expect(await evaluate(expression)).toBe(result);
    expect(prose).toContain(expression);
    expect(prose).toContain(result);
});

it.each([
    ["2 &", 'Invalid character: "&"'],
    ["", "Enter an expression to calculate."],
    ["2 +", "Invalid expression."],
    ["(2 + 3", "Mismatched parentheses."],
    ["2(3)", "Invalid expression."],
    ["1 / 0", "Result is not finite."],
    ["2 ** 3", "Invalid expression."],
])("verifies the calculator guide limitation %s -> %s", async (expression, message) => {
    const prose = getToolGuide("calculator")!.section.map(section => section.text).join(" ");
    expect(await evaluate(expression)).toContain(message);
    expect(host.querySelector("output")).toBeNull();
    if (expression !== "2 ** 3") expect(prose).toContain(message);
});

it("labels the calculator controls exactly as the guide instructions name them", async () => {
    await act(async () => root.render(createElement(CalculatorTool, { toolId: "calculator" })));
    const guide = getToolGuide("calculator")!;
    expect([...host.querySelectorAll("label")].map(label => label.textContent!.trim())).toEqual(["Expression"]);
    expect(host.textContent).toContain("Result");
    const buttons = [...host.querySelectorAll("button")].map(button => button.textContent);
    for (const label of ["C", "⌫", "="]) expect(buttons).toContain(label);
    expect(guide.instruction.join(" ")).toContain("Expression");
});

it.each([
    ["01:50", "add", "00:20", "02:10"],
    ["50:00", "add", "50:00", "100:00"],
    ["02:00", "subtract", "00:45", "01:15"],
    ["01:30", "subtract", "01:30", "00:00"],
    ["120:05", "add", "00:00", "120:05"],
] as const)("verifies time arithmetic example %s %s %s = %s through calculateTime", (left, operation, right, value) => {
    expect(calculateTime(left, operation, right)).toEqual({ ok: true, value });
    const prose = getToolGuide("time-arithmetic")!.section.map(section => section.text).join(" ");
    expect(prose).toContain(value);
});

it("verifies time arithmetic validation claims", () => {
    expect(calculateTime("01:5", "add", "00:20")).toEqual({ ok: false, error: "invalid-left" });
    expect(calculateTime("01:60", "add", "00:20")).toEqual({ ok: false, error: "invalid-left" });
    expect(calculateTime("-1:00", "add", "00:20")).toEqual({ ok: false, error: "invalid-left" });
    expect(calculateTime("01:00", "add", "-0:30")).toEqual({ ok: false, error: "invalid-right" });
    expect(calculateTime("00:45", "subtract", "02:00")).toEqual({ ok: false, error: "negative-result" });
    expect(calculateTime("150119987579016:32", "add", "00:00")).toEqual({ ok: false, error: "invalid-left" });
    expect(calculateTime("150119987579016:31", "add", "00:01")).toEqual({ ok: false, error: "result-out-of-range" });
    expect(getToolGuide("time-arithmetic")!.section.map(section => section.text).join(" ")).toContain("150119987579016:31");
    expect(calculateTime("25:00", "add", "00:00")).toEqual({ ok: true, value: "25:00" });
    expect(calculateTime("9:05", "add", "00:00")).toEqual({ ok: true, value: "09:05" });
});

it("verifies the time arithmetic labels, result placeholder and negative-result alert in the real component", async () => {
    await act(async () => root.render(createElement(TimeArithmeticTool, { toolId: "time-arithmetic" })));
    const guide = getToolGuide("time-arithmetic")!;
    expect([...host.querySelectorAll("label")].map(label => label.textContent!.trim())).toEqual(["Time A", "Operation", "Time B"]);
    expect([...host.querySelectorAll("option")].map(option => option.textContent)).toEqual(["+ Add", "- Subtract"]);
    expect(host.textContent).toContain("--:--");
    const setValue = async (element: HTMLInputElement | HTMLSelectElement, value: string, eventName: string, prototype: object) => {
        await act(async () => {
            Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
            element.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
    };
    const [a, b] = [...host.querySelectorAll("input")];
    await setValue(a, "01:50", "input", HTMLInputElement.prototype);
    await setValue(b, "00:20", "input", HTMLInputElement.prototype);
    expect(host.textContent).toContain("02:10");
    await setValue(host.querySelector("select")!, "subtract", "change", HTMLSelectElement.prototype);
    await setValue(a, "00:45", "input", HTMLInputElement.prototype);
    await setValue(b, "02:00", "input", HTMLInputElement.prototype);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Subtraction cannot produce a negative time value.");
    await setValue(a, "01:5", "input", HTMLInputElement.prototype);
    expect(host.textContent).toContain("Use HH:MM with two-digit minutes");
    expect(host.textContent).toContain("--:--");
    expect(guide.instruction.join(" ")).toContain("Time A");
    expect(guide.section.map(section => section.text).join(" ")).toContain("negative time value");
});

const proseOf = (id: string) => getToolGuide(id)!.section.map(section => section.text).join(" ");
async function typeInto(element: HTMLTextAreaElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function pressButton(name: string) {
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === name)!.click(); });
}

it("verifies the JSON Formatter guide example keeps every token exactly as written, unlike parse and re-serialize", async () => {
    await act(async () => root.render(createElement(JsonFormatterTool, { toolId: "json-formatter" })));
    const guide = getToolGuide("json-formatter")!;
    const output = () => host.querySelector<HTMLTextAreaElement>("#json-output")!.value;
    // The page shows short member tokens that can wrap on a phone; together they are exactly the document the tool is run on below.
    expect(proseOf("json-formatter")).toContain(JSON_GUIDE_MEMBER.join(", "));
    expect(JSON_GUIDE_EXAMPLE).toBe(`{${JSON_GUIDE_MEMBER.join(",")}}`);
    for (const member of JSON_GUIDE_MEMBER) expect(member.length, member).toBeLessThan(30);
    await typeInto(host.querySelector<HTMLTextAreaElement>("#json-input")!, JSON_GUIDE_EXAMPLE);
    await pressButton("Minify JSON");
    expect(output()).toBe(JSON_GUIDE_EXAMPLE);
    await pressButton("Format JSON");
    expect(output().split("\n")).toEqual(["{", `  "id": 12345678901234567890,`, `  "n": 1.50E+2,`, String.raw`  "s": "\u00e9",`, `  "s": 2`, "}"]);
    expect(formatJson(JSON_GUIDE_EXAMPLE)).toEqual({ ok: true, output: output() });
    expect(minifyJson(output())).toEqual({ ok: true, output: JSON_GUIDE_EXAMPLE });
    // A JavaScript parse and re-serialize would have changed all four tokens, which is what the guide says this tool avoids.
    expect(JSON.stringify(JSON.parse(JSON_GUIDE_EXAMPLE))).not.toBe(JSON_GUIDE_EXAMPLE);
    expect(JSON.stringify(JSON.parse(JSON_GUIDE_EXAMPLE))).toBe(`{"id":12345678901234567000,"n":150,"s":2}`);
    const prose = proseOf("json-formatter");
    for (const token of ["12345678901234567890", "1.50E+2", String.raw`\u00e9`, `repeated "s" member name`]) expect(prose).toContain(token);
    for (const label of ["Format JSON", "Minify JSON", "Copy result"]) {
        expect(guide.instruction.join(" ")).toContain(label);
        expect([...host.querySelectorAll("button")].map(button => button.textContent)).toContain(label);
    }
});

it("verifies the JSON Formatter guide error example at its stated line and column", () => {
    const result = formatJson(`{"a":1,}`);
    expect(result).toMatchObject({ ok: false, error: { code: "trailing-comma", message: "Trailing commas are not allowed.", line: 1, column: 8 } });
    expect(minifyJson(`{"a":1}`)).toEqual({ ok: true, output: `{"a":1}` });
    const prose = proseOf("json-formatter");
    expect(prose).toContain("Trailing commas are not allowed.");
    expect(prose).toContain("line 1, column 8");
    expect(prose).toContain(`{"a":1,}`);
});

it.each([
    ["Don’t", { Words: "1", Characters: "5", "Characters excluding whitespace": "5", Lines: "1" }],
    [COUNTER_GUIDE_DECOMPOSED, { Words: "1", Characters: "1", "Characters excluding whitespace": "1", Lines: "1" }],
    [COUNTER_GUIDE_FAMILY, { Words: "0", Characters: "1", "Characters excluding whitespace": "1", Lines: "1" }],
    [`Hello world${"\n"}`, { Words: "2", Characters: "12", "Characters excluding whitespace": "10", Lines: "2" }],
])("verifies the Word and Character Counter guide example %j through the real component", async (text, expected) => {
    await act(async () => root.render(createElement(WordCharacterCounterTool, { toolId: "word-character-counter" })));
    await typeInto(host.querySelector<HTMLTextAreaElement>("#counter-input")!, text);
    const shown = Object.fromEntries([...host.querySelectorAll("dt")].map(term => [term.textContent, term.nextElementSibling!.textContent]));
    expect(shown).toEqual(expected);
    expect(measureText(text)).toMatchObject({ ok: true, metric: { wordCount: Number(expected.Words), characterCount: Number(expected.Characters), lineCount: Number(expected.Lines) } });
});

it("states the Word and Character Counter worked example in the same terms the tool counts", async () => {
    const prose = proseOf("word-character-counter");
    for (const text of ["Don’t is 1 word and 5 characters", COUNTER_GUIDE_DECOMPOSED, COUNTER_GUIDE_FAMILY, "is 1 character but 0 words", "2 words, 12 characters, 10 characters excluding whitespace and 2 lines", "trailing line break starts a second, empty line"]) expect(prose).toContain(text);
    expect(COUNTER_GUIDE_DECOMPOSED).toHaveLength(2);
    expect(COUNTER_GUIDE_FAMILY.split("\u200D")).toHaveLength(3);
    await act(async () => root.render(createElement(WordCharacterCounterTool, { toolId: "word-character-counter" })));
    expect([...host.querySelectorAll("label")].map(label => label.textContent!.trim())).toEqual(["Text"]);
    expect([...host.querySelectorAll("dt")].map(term => term.textContent)).toEqual(["Words", "Characters", "Characters excluding whitespace", "Lines"]);
});

it("verifies the QR Code Generator guide example decodes, with an independent reader, to exactly the entered text", () => {
    const result = generateQrRaster(QR_GUIDE_EXAMPLE);
    if (!result.ok) throw new Error(result.error.message);
    expect([result.raster.width, result.raster.height]).toEqual([512, 512]);
    expect(jsQR(result.raster.data, result.raster.width, result.raster.height)?.data).toBe(QR_GUIDE_EXAMPLE);
    // The recovery advice rests on these facts: the text is encoded as typed, and a stray space is part of the payload.
    const spaced = generateQrRaster(`${QR_GUIDE_EXAMPLE} `);
    if (!spaced.ok) throw new Error(spaced.error.message);
    expect(jsQR(spaced.raster.data, spaced.raster.width, spaced.raster.height)?.data).toBe(`${QR_GUIDE_EXAMPLE} `);
    const prose = proseOf("qr-code-generator");
    for (const text of [QR_GUIDE_EXAMPLE, "512 × 512 pixel PNG", "stray space", "encoded exactly as entered"]) expect(prose).toContain(text);
});

it("verifies the QR Code Generator size limit, its error message and its controls", async () => {
    expect(generateQrRaster("x".repeat(QR_MAX_PAYLOAD_BYTES)).ok).toBe(true);
    expect(generateQrRaster("x".repeat(QR_MAX_PAYLOAD_BYTES + 1))).toEqual({ ok: false, error: { code: "input-too-large", message: "QR code text must be 2,048 UTF-8 bytes or less." } });
    expect(proseOf("qr-code-generator")).toContain("QR code text must be 2,048 UTF-8 bytes or less.");
    await act(async () => root.render(createElement(QrCodeGeneratorTool, { toolId: "qr-code-generator" })));
    const guide = getToolGuide("qr-code-generator")!;
    expect([...host.querySelectorAll("label")].map(label => label.textContent!.trim())).toEqual(["Text or URL"]);
    const buttons = [...host.querySelectorAll("button")].map(button => button.textContent);
    for (const label of ["Generate QR code", "Reset"]) { expect(buttons).toContain(label); expect(guide.instruction.join(" ")).toContain(label); }
    expect(guide.instruction.join(" ")).toContain("Download PNG");
});
