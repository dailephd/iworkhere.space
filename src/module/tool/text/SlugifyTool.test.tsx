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

it.each([
    ["Hello World!", "hello-world"],
    ["Ready... Set / Go!", "ready-set-go"],
    ["Café 東京", "caf"],
    ["東京", ""],
    ["!!!", ""],
    ["", ""],
])("keeps live transformation for %s", async (value, expected) => {
    const input = host.querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
        setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector("output")!.textContent).toBe(expected);
    const prose = getToolGuide("slugify")!.section.map(section => section.text).join(" ");
    if (value) expect(prose).toContain(value);
    if (expected) expect(prose).toContain(expected);
});
