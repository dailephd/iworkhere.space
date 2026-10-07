/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JsonFormatterTool } from "./JsonFormatterTool";
import { JSON_MAX_INPUT_BYTES } from "./jsonFormat";

const obs = vi.hoisted(() => ({ trackEvent: vi.fn(), captureError: vi.fn(), logEvent: vi.fn() }));
vi.mock("@/module/observability", () => obs);

const SECRET = "PRIVATE-JSON-VALUE";
let host: HTMLDivElement, root: Root;
const setQuery = vi.fn(), writeText = vi.fn(), fetchMock = vi.fn(), setItem = vi.spyOn(Storage.prototype, "setItem");

const input = () => host.querySelector<HTMLTextAreaElement>("#json-input")!;
const output = () => host.querySelector<HTMLTextAreaElement>("#json-output")!;
const alertText = () => host.querySelector('[role="alert"]')!.textContent;
const button = (name: string) => [...host.querySelectorAll("button")].find(value => value.textContent === name)!;
async function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); });
}
async function click(name: string) { await act(async () => button(name).click()); }
const everythingObserved = () => JSON.stringify([obs.trackEvent.mock.calls, obs.captureError.mock.calls, obs.logEvent.mock.calls]);

beforeEach(async () => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } }); writeText.mockResolvedValue(undefined);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(JsonFormatterTool, { toolId: "json-formatter", setQuery })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("starts empty with labeled controls and no alert text", () => {
    expect(host.querySelector('label[for="json-input"]')?.textContent).toBe("JSON input");
    expect(host.querySelector('label[for="json-output"]')?.textContent).toBe("JSON output");
    expect(input().value).toBe(""); expect(output().readOnly).toBe(true); expect(output().value).toBe("");
    expect(alertText()).toBe(""); expect(button("Copy result")).toHaveProperty("disabled", true);
    for (const name of ["Format JSON", "Minify JSON", "Reset"]) expect(button(name)).toBeDefined();
});

it("formats valid JSON with two-space indentation and preserves lexemes", async () => {
    await type('{"n":12345678901234567890123,"e":1E+2,"d":1,"d":2}'); await click("Format JSON");
    expect(output().value).toBe('{\n  "n": 12345678901234567890123,\n  "e": 1E+2,\n  "d": 1,\n  "d": 2\n}');
    expect(alertText()).toBe("");
});

it("minifies valid JSON", async () => {
    await type('{ "a" : [ 1 , 2 ] }'); await click("Minify JSON");
    expect(output().value).toBe('{"a":[1,2]}');
});

it("shows an alert with line and column, leaves no output, and clears prior output on failure", async () => {
    await type("[1, 2]"); await click("Format JSON"); expect(output().value).not.toBe("");
    await type('{\n  "a": tru\n}'); expect(output().value).toBe(""); await click("Format JSON");
    expect(output().value).toBe(""); expect(alertText()).toBe("Invalid literal. Use true, false or null. Line 2, column 8.");
    expect(button("Copy result")).toHaveProperty("disabled", true);
});

it("clears stale output, copied state and errors when the input is edited", async () => {
    await type("[1]"); await click("Format JSON"); await click("Copy result");
    expect(button("Copied!")).toBeDefined();
    await type("[1, 2]"); expect(output().value).toBe(""); expect(button("Copy result")).toHaveProperty("disabled", true);
    await type("[1,]"); await click("Minify JSON"); expect(alertText()).toContain("Trailing commas");
    await type("[1]"); expect(alertText()).toBe("");
});

it("copies exactly the displayed output and reports success", async () => {
    await type('{"a":1}'); await click("Format JSON"); await click("Copy result");
    expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}'); expect(button("Copied!")).toBeDefined();
    expect(obs.trackEvent).toHaveBeenCalledWith("tool_result_copied", { toolId: "json-formatter", slug: "json-formatter" });
});

it("reports a clipboard failure safely without exposing content", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    await type(`{"a":"${SECRET}"}`); await click("Format JSON"); await click("Copy result");
    expect(alertText()).toBe("Failed to copy to clipboard."); expect(alertText()).not.toContain(SECRET);
    expect(obs.captureError).toHaveBeenCalledWith(expect.any(Error), { toolId: "json-formatter", boundary: "JsonFormatterTool.handleCopy" });
    expect(everythingObserved()).not.toContain(SECRET);
});

it("resets input, output, error and copied state and refocuses the input", async () => {
    await type("[1]"); await click("Format JSON"); await click("Copy result"); await click("Reset");
    expect(input().value).toBe(""); expect(output().value).toBe(""); expect(alertText()).toBe("");
    expect(button("Copy result")).toHaveProperty("disabled", true); expect(document.activeElement).toBe(input());
    await type("["); await click("Format JSON"); expect(alertText()).not.toBe(""); await click("Reset"); expect(alertText()).toBe("");
});

it("rejects input over 1 MiB of UTF-8 with bounded feedback and no output", async () => {
    await type(`"${"a".repeat(JSON_MAX_INPUT_BYTES - 1)}"`); await click("Minify JSON");
    expect(output().value).toBe(""); expect(alertText()).toBe("Input is larger than the 1 MiB limit.");
    await click("Reset"); await type(`"${"é".repeat(524_288)}"`); await click("Format JSON");
    expect(alertText()).toBe("Input is larger than the 1 MiB limit.");
});

it("accepts exactly 1 MiB", async () => {
    await type(`"${"a".repeat(JSON_MAX_INPUT_BYTES - 2)}"`); await click("Minify JSON");
    expect(alertText()).toBe(""); expect(output().value.length).toBe(JSON_MAX_INPUT_BYTES);
});

it("keeps JSON local: no network, storage or query state, and identity-only observability", async () => {
    await type(`{"k":"${SECRET}"}`); await click("Format JSON"); await click("Minify JSON"); await click("Copy result");
    await type(`{"k":"${SECRET}",}`); await click("Format JSON");
    expect(fetchMock).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled(); expect(setQuery).not.toHaveBeenCalled();
    expect(location.search).toBe("");
    for (const call of obs.trackEvent.mock.calls) expect(call[1]).toEqual({ toolId: "json-formatter", slug: "json-formatter" });
    expect(obs.trackEvent.mock.calls.map(call => call[0])).toEqual(["tool_executed", "tool_executed", "tool_result_copied"]);
    expect(obs.captureError).not.toHaveBeenCalled(); expect(obs.logEvent).not.toHaveBeenCalled();
    expect(everythingObserved()).not.toContain(SECRET);
});
