/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getToolGuide } from "./guide";
import { LengthConverterTool } from "./everyday/LengthConverterTool";
import { WeightConverterTool } from "./everyday/WeightConverterTool";
import { extractHtmlText } from "./text/extractHtmlText";

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
    expect(host.textContent).toContain("Invalid input");
    expect(prose).toContain("Invalid input");
});

it("verifies the HTML guide example and CSS visibility limitation through the real parser", () => {
    const html = "<p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script>";
    const prose = getToolGuide("html-text-extractor")!.section.map(section => section.text).join(" ");
    expect(prose).toContain(html);
    expect(extractHtmlText(html)).toBe("Hello world\nNext line");
    expect(extractHtmlText('<p style="display:none">Hidden</p><style>p{color:red}</style><p>Shown</p>')).toBe("Hidden\nShown");
    expect(extractHtmlText(" ")).toBe("");
});
