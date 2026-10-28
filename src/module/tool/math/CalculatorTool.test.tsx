/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalculatorTool } from "./CalculatorTool";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});
async function render(expression: string) {
    await act(async () => root.render(<CalculatorTool toolId="calculator" query={{ expr: expression }} />));
}
async function execute(key: string) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    await act(async () => host.querySelector("input")!.dispatchEvent(event));
    return event;
}
describe("calculator execution controls", () => {
    it.each(["Enter", "="])("%s executes without changing the expression", async key => {
        await render("2 + 3 * 4");
        expect((await execute(key)).defaultPrevented).toBe(true);
        expect(host.querySelector("output")?.textContent).toBe("14");
        expect(host.querySelector("input")!.value).toBe("2 + 3 * 4");
    });
    it("the on-screen equals button uses the same calculation", async () => {
        await render("(2 + 3) * 4");
        await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "=")!.click());
        expect(host.querySelector("output")?.textContent).toBe("20");
    });
    it.each(["Enter", "="])("%s preserves malformed expression feedback", async key => {
        await render("2+");
        await execute(key);
        expect(host.querySelector("output")).toBeNull();
        expect(host.textContent).toContain("Invalid expression.");
        expect(host.querySelector("input")!.value).toBe("2+");
    });
    it("ordinary typing keys do not execute", async () => {
        await render("2+3");
        expect((await execute("4")).defaultPrevented).toBe(false);
        expect(host.querySelector("output")).toBeNull();
    });
});

async function calculate(expression: string) {
    await render(expression);
    await execute("Enter");
    return {
        value: host.querySelector("output")?.textContent ?? null,
        error: host.querySelector('[role="alert"]')?.textContent ?? null,
    };
}
describe("calculator grammar", () => {
    it.each([
        ["2 * -3", "-6"],
        ["2 / -2", "-1"],
        ["1--2", "3"],
        ["-(2+3)", "-5"],
        ["2 * (-3)", "-6"],
        ["--2", "2"],
        ["+2", "2"],
        ["2 + 3 * 4", "14"],
        ["(2 + 3) * 4", "20"],
        ["10 - 4 - 3", "3"],
        ["16 / 4 / 2", "2"],
        ["-2 * -3", "6"],
        [".5 + 2.", "2.5"],
        ["0 * -1", "0"],
        ["-0", "0"],
    ])("accepts %s = %s", async (expression, expected) => {
        expect(await calculate(expression)).toEqual({ value: expected, error: null });
    });
    it.each([
        ["", "Enter an expression to calculate."],
        ["   ", "Enter an expression to calculate."],
        [".", "Invalid number."],
        ["2 3", "Invalid expression."],
        ["1.2.3", "Invalid expression."],
        ["2(3)", "Invalid expression."],
        ["(2)(3)", "Invalid expression."],
        ["2 ** 3", "Invalid expression."],
        ["2 +", "Invalid expression."],
        ["* 2", "Invalid expression."],
        ["()", "Invalid expression."],
        ["(2 + 3", "Mismatched parentheses."],
        ["2 + 3)", "Mismatched parentheses."],
        ["1 / 0", "Result is not finite."],
        ["1 / (1 / 0)", "Result is not finite."],
        ["0 / 0", "Result is not finite."],
        ["9".repeat(400), "Invalid number."],
        ["1" + "0".repeat(300) + " * " + "1" + "0".repeat(300), "Result is not finite."],
        ["(".repeat(500) + "1" + ")".repeat(500), "Expression is too deeply nested."],
        ["2 & 3", 'Invalid character: "&"'],
    ])("rejects %j with %s", async (expression, message) => {
        expect(await calculate(expression)).toEqual({ value: null, error: message });
    });
    it("keeps the untouched initial state as a placeholder without an alert", async () => {
        await render("");
        expect(host.querySelector('[role="alert"]')).toBeNull();
        expect(host.textContent).toContain("Run the expression to see result.");
    });
    it("reports empty input when the on-screen equals is pressed", async () => {
        await render("");
        await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "=")!.click());
        expect(host.querySelector('[role="alert"]')?.textContent).toBe("Enter an expression to calculate.");
    });
    it("keeps keypad editing, backspace and clear working", async () => {
        await act(async () => root.render(<CalculatorTool toolId="calculator" />));
        const press = async (label: string) => act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === label)!.click());
        for (const label of ["2", "×", "−", "3"]) await press(label);
        expect(host.querySelector("input")!.value).toBe("2*-3");
        await press("=");
        expect(host.querySelector("output")?.textContent).toBe("-6");
        await press("⌫");
        expect(host.querySelector("input")!.value).toBe("2*-");
        await press("C");
        expect(host.querySelector("input")!.value).toBe("");
        expect(host.querySelector("output")).toBeNull();
    });
    it("updates from external query changes without clearing the current result", async () => {
        const setQuery = vi.fn();
        await act(async () => root.render(
            <CalculatorTool
                toolId="calculator"
                query={{ expr: "2+3", mode: "scientific" }}
                setQuery={setQuery}
            />
        ));
        expect(host.querySelector("input")!.value).toBe("2+3");

        await execute("Enter");
        expect(host.querySelector("output")?.textContent).toBe("5");

        await act(async () => root.render(
            <CalculatorTool
                toolId="calculator"
                query={{ expr: "4*5", mode: "scientific" }}
                setQuery={setQuery}
            />
        ));
        expect(host.querySelector("input")!.value).toBe("4*5");
        expect(host.querySelector("output")?.textContent).toBe("5");
        expect(setQuery).not.toHaveBeenCalled();
    });
    it("treats a non-string query expression as empty", async () => {
        await act(async () => root.render(
            <CalculatorTool
                toolId="calculator"
                query={{ expr: 7 } as unknown as Record<string, string>}
            />
        ));
        expect(host.querySelector("input")!.value).toBe("");
    });
    it("writes the expression to the shareable query", async () => {
        const setQuery = vi.fn();
        await act(async () => root.render(<CalculatorTool toolId="calculator" query={{ expr: "", mode: "scientific" }} setQuery={setQuery} />));
        const input = host.querySelector("input")!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2 * -3");
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(setQuery).toHaveBeenLastCalledWith({ expr: "2 * -3", mode: "scientific" });
    });
});
