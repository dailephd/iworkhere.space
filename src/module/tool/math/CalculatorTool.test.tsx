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
