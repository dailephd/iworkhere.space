/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SlugifyTool } from "./SlugifyTool";
import { getToolGuide } from "../guide";

let host: HTMLDivElement, root: Root;
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(SlugifyTool, { toolId: "slugify" })));
});
afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

it("associates the visible Text label with a stable input and supplementary placeholder", () => {
    const input = host.querySelector("input")!;
    const label = host.querySelector("label")!;
    expect(label.textContent?.trim()).toBe("Text");
    expect(label.htmlFor).toBe("slugify-input");
    expect(label.control).toBe(input);
    expect(input.labels?.[0]).toBe(label);
    expect(input.placeholder).toBe("Enter text");
});

async function type(value: string) {
    const input = host.querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
        setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
const message = () => host.querySelector('[role="status"]');

it("starts clean: the input and its label only, with no result surface and no no-slug message", () => {
    expect(host.querySelector("input")).not.toBeNull();
    expect(host.querySelector("output")).toBeNull();
    expect(message()).toBeNull();
    expect(host.textContent).not.toContain("Generated slug");
    expect(host.querySelector(".tool-result")).toBeNull();
});

it.each([
    ["Hello World!", "hello-world"],
    ["Ready... Set / Go!", "ready-set-go"],
    ["Café 東京", "caf"],
])("keeps live transformation for %s and shows it under a Generated slug label", async (value, expected) => {
    await type(value);
    const output = host.querySelector("output")!;
    expect(output.textContent).toBe(expected);
    expect(host.querySelector("#slugify-result-label")?.textContent).toBe("Generated slug");
    expect(output.getAttribute("aria-labelledby")).toBe("slugify-result-label");
    expect(output.htmlFor.contains("slugify-input")).toBe(true);
    expect(output.classList.contains("tool-result")).toBe(true);
    expect(message()).toBeNull();
    const prose = getToolGuide("slugify")!.section.map(section => section.text).join(" ");
    expect(prose).toContain(value);
    expect(prose).toContain(expected);
});

it.each(["東京", "!!!", "   ", " ... "])("explains an empty slug from %j without a result surface", async (value) => {
    await type(value);
    expect(host.querySelector("output")).toBeNull();
    expect(host.querySelector(".tool-result")).toBeNull();
    expect(host.textContent).not.toContain("Generated slug");
    expect(message()?.textContent).toContain("No slug was generated");
    expect(message()?.textContent).toContain("ASCII letters and numbers");
    expect(message()?.getAttribute("data-tone")).toBeNull();
});

it("updates live and returns to the initial state when the input is cleared", async () => {
    await type("Hello World!");
    expect(host.querySelector("output")?.textContent).toBe("hello-world");
    await type("Hello World! 2");
    expect(host.querySelector("output")?.textContent).toBe("hello-world-2");
    await type("!!!");
    expect(host.querySelector("output")).toBeNull();
    expect(message()).not.toBeNull();
    await type("");
    expect(host.querySelector("output")).toBeNull();
    expect(message()).toBeNull();
    await type("abc");
    await type("");
    expect(host.querySelector("output")).toBeNull();
    expect(message()).toBeNull();
});
