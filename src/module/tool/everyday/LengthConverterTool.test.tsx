/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LengthConverterTool } from "./LengthConverterTool";

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock("@/module/observability", () => ({ trackEvent }));

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    trackEvent.mockClear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<LengthConverterTool toolId="length-converter" />));
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function enter(value: string) {
    const input = host.querySelector("input")!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function choose(id: string, unit: string) {
    const select = host.querySelector<HTMLSelectElement>(`#length-${id}`)!;
    await act(async () => {
        select.value = unit;
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
}
function shown() {
    return {
        value: host.querySelector("div.text-2xl")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        error: host.querySelector('[role="alert"]')?.textContent ?? null,
    };
}

describe("LengthConverterTool", () => {
    it("converts the default value and exposes it as plain text", () => {
        expect(shown()).toEqual({ value: "3.28084 ft", error: null });
    });

    it.each([["1", "m", "ft", "3.28084 ft"], ["2", "km", "m", "2000 m"], ["1", "mile", "km", "1.609344 km"], ["12", "inch", "ft", "1 ft"], ["3", "ft", "yd", "1 yd"], ["100", "cm", "m", "1 m"], ["1", "m", "mm", "1000 mm"]])("converts %s %s to %s as %s", async (value, from, to, expected) => {
        await choose("from", from);
        await choose("to", to);
        await enter(value);
        expect(shown()).toEqual({ value: expected, error: null });
    });

    it("accepts zero, negatives, leading signs, decimals and exponents", async () => {
        await choose("from", "m");
        await choose("to", "m");
        for (const [value, expected] of [["0", "0 m"], ["-5", "-5 m"], [".5", "0.5 m"], ["1e3", "1000 m"], ["007", "7 m"]]) {
            await enter(value);
            expect(shown()).toEqual({ value: expected, error: null });
        }
    });

    it("rounds to at most six decimals and shows zero for tiny values", async () => {
        await choose("from", "m");
        await choose("to", "m");
        await enter("0.1234567");
        expect(shown().value).toBe("0.123457 m");
        await enter("1e-10");
        expect(shown().value).toBe("0 m");
        await enter("-1e-10");
        expect(shown().value).toBe("0 m");
    });

    it("keeps the largest finite value representable for same-unit conversion", async () => {
        for (const unit of ["m", "km", "cm", "mm", "inch", "ft", "yd", "mile"]) {
            await choose("from", unit);
            await choose("to", unit);
            await enter("1e308");
            expect(shown()).toEqual({ value: `1e+308 ${unit}`, error: null });
            await enter("-1e308");
            expect(shown()).toEqual({ value: `-1e+308 ${unit}`, error: null });
        }
    });

    it("rejects a real out-of-range conversion with an accessible error", async () => {
        await choose("from", "mile");
        await choose("to", "mm");
        await enter("1e308");
        const result = shown();
        expect(result.value).toBeNull();
        expect(result.error).toBe("Result is out of range for this conversion.");
        expect(host.textContent).not.toMatch(/Infinity|NaN/);
    });

    it("rejects blank and non-finite input with an accessible error", async () => {
        await enter("");
        expect(shown()).toEqual({ value: null, error: "Invalid input: enter a number." });
        await enter("   ");
        expect(shown().error).toBe("Invalid input: enter a number.");
        // A browser number field reports unparsable text such as "1e" or "1e999" as an empty value.
        await enter("1e999");
        expect(shown()).toEqual({ value: null, error: "Invalid input: enter a number." });
        expect(host.textContent).not.toMatch(/Infinity|NaN/);
    });

    it("recovers when a valid value replaces an error", async () => {
        await enter("");
        expect(shown().error).not.toBeNull();
        await enter("1");
        expect(shown().error).toBeNull();
        expect(shown().value).not.toBeNull();
    });

    it("tracks only tool identity, never the entered value", async () => {
        await enter("123456");
        for (const call of trackEvent.mock.calls) {
            expect(call[1]).toEqual({ toolId: "length-converter", slug: "length-converter" });
        }
        expect(trackEvent).toHaveBeenCalledWith("tool_opened", expect.anything());
        expect(trackEvent).toHaveBeenCalledWith("tool_executed", expect.anything());
    });
});
