/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WordCharacterCounterTool } from "./WordCharacterCounterTool";
import { TEXT_MAX_INPUT_BYTES } from "./textMetric";

const obs = vi.hoisted(() => ({ trackEvent: vi.fn(), captureError: vi.fn(), logEvent: vi.fn() }));
vi.mock("@/module/observability", () => obs);

const SECRET = "PRIVATE-TEXT-VALUE";
let host: HTMLDivElement, root: Root;
const fetchMock = vi.fn(), beaconMock = vi.fn(), setItem = vi.spyOn(Storage.prototype, "setItem");
const originalSegmenter = Intl.Segmenter;

const input = () => host.querySelector<HTMLTextAreaElement>("#counter-input")!;
const alertText = () => host.querySelector('[role="alert"]')!.textContent;
const reset = () => [...host.querySelectorAll("button")].find(value => value.textContent === "Reset")!;
function metrics(): Record<string, string> {
    return Object.fromEntries([...host.querySelectorAll("dl > div")].map(row => [row.querySelector("dt")!.textContent!, row.querySelector("dd")!.textContent!]));
}
async function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); });
}
const zero = { "Words": "0", "Characters": "0", "Characters excluding whitespace": "0", "Lines": "0" };
const unavailable = { "Words": "—", "Characters": "—", "Characters excluding whitespace": "—", "Lines": "—" };

beforeEach(async () => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beaconMock });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(WordCharacterCounterTool)));
});
afterEach(async () => {
    Object.defineProperty(Intl, "Segmenter", { value: originalSegmenter, configurable: true, writable: true });
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

it("starts with a labeled input, four labeled zero metrics, an empty alert and a Reset button", () => {
    expect(host.querySelector('label[for="counter-input"]')?.textContent).toBe("Text");
    expect(metrics()).toEqual(zero);
    expect(Object.keys(metrics())).toEqual(["Words", "Characters", "Characters excluding whitespace", "Lines"]);
    expect(alertText()).toBe("");
    expect(reset()).toBeDefined();
    expect(host.querySelector("dl")).not.toBeNull();
});

it("updates every metric live as the text changes, with no action button", async () => {
    await type("Hello world");
    expect(metrics()).toEqual({ "Words": "2", "Characters": "11", "Characters excluding whitespace": "10", "Lines": "1" });
    await type("Hello world\n");
    expect(metrics()).toEqual({ "Words": "2", "Characters": "12", "Characters excluding whitespace": "10", "Lines": "2" });
    expect([...host.querySelectorAll("button")].map(value => value.textContent)).toEqual(["Reset"]);
});

it("counts graphemes as single characters and joins apostrophes through the pure module", async () => {
    await type("👩‍💻 é don’t");
    expect(metrics()).toEqual({ "Words": "2", "Characters": "9", "Characters excluding whitespace": "7", "Lines": "1" });
});

it("resets the text, errors and metrics and refocuses the input", async () => {
    await type("Hello world");
    await act(async () => reset().click());
    expect(input().value).toBe(""); expect(metrics()).toEqual(zero); expect(alertText()).toBe("");
    expect(document.activeElement).toBe(input());
});

it("keeps over-limit input, shows a bounded error and no stale or misleading metrics, then recovers", async () => {
    await type("Hello world");
    const over = "a".repeat(TEXT_MAX_INPUT_BYTES + 1);
    await type(over);
    expect(input().value).toBe(over);
    expect(alertText()).toBe("Text is larger than the 1 MiB limit.");
    expect(metrics()).toEqual(unavailable);
    await type("a".repeat(TEXT_MAX_INPUT_BYTES));
    expect(alertText()).toBe(""); expect(metrics().Characters).toBe(String(TEXT_MAX_INPUT_BYTES));
    await type(over); await act(async () => reset().click());
    expect(input().value).toBe(""); expect(alertText()).toBe(""); expect(metrics()).toEqual(zero);
});

it("shows an unsupported-browser message instead of approximate counts when Intl.Segmenter is missing", async () => {
    Object.defineProperty(Intl, "Segmenter", { value: undefined, configurable: true, writable: true });
    await type("é");
    expect(alertText()).toBe("This browser does not support the Unicode character segmentation required by this tool.");
    expect(metrics()).toEqual(unavailable); expect(input().value).toBe("é");
    await act(async () => reset().click());
    expect(metrics()).toEqual(zero); expect(alertText()).toBe("");
    expect(obs.captureError).not.toHaveBeenCalled();
});

it("keeps text local: no network, storage or query state, and no observability on edits or errors", async () => {
    await type(`${SECRET} one two`); await type(`${SECRET}\nline`);
    await type("a".repeat(TEXT_MAX_INPUT_BYTES + 1)); await type(SECRET);
    await act(async () => reset().click());
    expect(fetchMock).not.toHaveBeenCalled(); expect(beaconMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled(); expect(location.search).toBe("");
    expect(obs.trackEvent).not.toHaveBeenCalled(); expect(obs.captureError).not.toHaveBeenCalled(); expect(obs.logEvent).not.toHaveBeenCalled();
});
