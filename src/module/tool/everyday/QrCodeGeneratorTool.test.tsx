/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QrCodeGeneratorTool } from "./QrCodeGeneratorTool";
import { generateQrRaster } from "./qrCode";

const mocks = vi.hoisted(() => ({
    track: vi.fn(),
    capture: vi.fn(),
    encoderCalls: [] as unknown[][],
    encoderFailure: null as Error | null,
}));

vi.mock("@/module/observability", () => ({ trackEvent: mocks.track, captureError: mocks.capture }));
vi.mock("uqr", async importOriginal => {
    const actual = await importOriginal<typeof import("uqr")>();
    return {
        ...actual,
        encode: (...args: Parameters<typeof actual.encode>) => {
            mocks.encoderCalls.push(args);
            if (mocks.encoderFailure) throw mocks.encoderFailure;
            return actual.encode(...args);
        },
    };
});

// "PNG" in base64; the component turns it into an image/png Blob.
const PNG_DATA_URL = "data:image/png;base64,UE5H";

const createUrl = vi.fn();
const revokeUrl = vi.fn();
const setQuery = vi.fn();
const putImageData = vi.fn();
const createImageData = vi.fn((width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
let toDataUrl: ReturnType<typeof vi.spyOn>;
let toBlob: ReturnType<typeof vi.spyOn>;
let canvasSizes: Array<[number, number]>;
let host: HTMLDivElement;
let root: Root;

function input() { return host.querySelector<HTMLTextAreaElement>("textarea")!; }
function button(name: string) { return [...host.querySelectorAll("button")].find(item => item.textContent === name)!; }
function preview() { return host.querySelector<HTMLImageElement>('img[alt="Generated QR code preview"]'); }
function download() { return host.querySelector<HTMLAnchorElement>("a[download]"); }
function alertText() { return host.querySelector('[role="alert"]')!.textContent ?? ""; }

async function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
        setter.call(input(), value);
        input().dispatchEvent(new Event("input", { bubbles: true }));
    });
}

// The component loads qrCode.ts through a dynamic import; let that continuation run.
async function settle() {
    await act(async () => {
        await import("./qrCode");
        for (let i = 0; i < 3; i += 1) await Promise.resolve();
    });
}

async function click(name: string) {
    await act(async () => button(name).click());
    if (name === "Generate QR code") await settle();
}

async function generate(text: string) {
    await type(text);
    await click("Generate QR code");
}

describe("QR Code Generator component", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mocks.encoderCalls.length = 0;
        mocks.encoderFailure = null;
        canvasSizes = [];
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        let nextUrl = 0;
        createUrl.mockImplementation(() => `blob:qr-${++nextUrl}`);
        vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
            canvasSizes.push([this.width, this.height]);
            return { createImageData, putImageData } as unknown as CanvasRenderingContext2D;
        });
        toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => PNG_DATA_URL);
        toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        await act(async () => root.render(createElement(QrCodeGeneratorTool, { toolId: "qr-code-generator", setQuery })));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("starts empty with Generate disabled and no preview or download", () => {
        expect(host.querySelector("label")?.textContent).toBe("Text or URL");
        expect(input().value).toBe("");
        expect(button("Generate QR code").disabled).toBe(true);
        expect(preview()).toBeNull();
        expect(download()).toBeNull();
        expect(button("Reset")).toBeDefined();
        expect(alertText()).toBe("");
    });

    it("keeps whitespace-only input valid and generates it", async () => {
        await type("   ");
        expect(button("Generate QR code").disabled).toBe(false);
        await click("Generate QR code");
        expect(preview()).not.toBeNull();
        expect(mocks.encoderCalls[0][0]).toEqual([32, 32, 32]);
    });

    it("generates a 512x512 PNG preview and download link for ordinary text, synchronously after the module loads", async () => {
        await type("hello qr");
        expect(button("Generate QR code").disabled).toBe(false);
        expect(mocks.track).not.toHaveBeenCalled();
        await click("Generate QR code");

        expect(canvasSizes).toEqual([[512, 512]]);
        expect(createImageData).toHaveBeenCalledWith(512, 512);
        const painted = putImageData.mock.calls[0][0] as { data: Uint8ClampedArray };
        const expected = generateQrRaster("hello qr");
        if (!expected.ok) throw new Error("expected a raster");
        expect(Buffer.from(painted.data).equals(Buffer.from(expected.raster.data))).toBe(true);

        // PNG encoding is synchronous: toDataURL is used, never the idle-scheduled toBlob.
        expect(toDataUrl).toHaveBeenCalledWith("image/png");
        expect(toBlob).not.toHaveBeenCalled();
        expect(createUrl).toHaveBeenCalledTimes(1);
        const blob = createUrl.mock.calls[0][0] as Blob;
        expect(blob.type).toBe("image/png");
        expect(Buffer.from(await blob.arrayBuffer()).toString("latin1")).toBe("PNG");

        expect(preview()?.getAttribute("src")).toBe("blob:qr-1");
        expect(download()?.getAttribute("href")).toBe("blob:qr-1");
        expect(download()?.getAttribute("download")).toBe("qr-code.png");
        expect(download()?.textContent).toBe("Download PNG");
        expect(alertText()).toBe("");
    });

    it("emits exactly one identity-only tool_executed after the result is ready", async () => {
        const text = "https://private.example/SECRET?token=abc";
        await type(text);
        expect(mocks.track).not.toHaveBeenCalled();
        await click("Generate QR code");
        expect(mocks.track.mock.calls).toEqual([["tool_executed", { toolId: "qr-code-generator", slug: "qr-code-generator" }]]);
        expect(JSON.stringify(mocks.track.mock.calls)).not.toContain("SECRET");
        expect(JSON.stringify(mocks.track.mock.calls)).not.toContain("blob:");
    });

    it("clears the stale preview and download and revokes the URL when the input is edited", async () => {
        await generate("first");
        expect(download()).not.toBeNull();
        await type("first!");
        expect(revokeUrl).toHaveBeenCalledWith("blob:qr-1");
        expect(preview()).toBeNull();
        expect(download()).toBeNull();
        expect(button("Generate QR code").disabled).toBe(false);
        expect(mocks.track).toHaveBeenCalledTimes(1);
    });

    it("revokes the previous URL when a replacement generation starts", async () => {
        await generate("same text");
        expect(revokeUrl).not.toHaveBeenCalled();
        await click("Generate QR code");
        expect(revokeUrl).toHaveBeenCalledWith("blob:qr-1");
        expect(download()?.getAttribute("href")).toBe("blob:qr-2");
        expect(mocks.track).toHaveBeenCalledTimes(2);
    });

    it("revokes the URL and clears everything on Reset, then focuses the input", async () => {
        await generate("to reset");
        await click("Reset");
        expect(revokeUrl).toHaveBeenCalledWith("blob:qr-1");
        expect(input().value).toBe("");
        expect(preview()).toBeNull();
        expect(download()).toBeNull();
        expect(alertText()).toBe("");
        expect(button("Generate QR code").disabled).toBe(true);
        expect(document.activeElement).toBe(input());
    });

    it("revokes the URL on unmount", async () => {
        await generate("to unmount");
        revokeUrl.mockClear();
        await act(async () => root.unmount());
        expect(revokeUrl).toHaveBeenCalledWith("blob:qr-1");
        root = createRoot(host);
    });

    it("rejects over-limit text, keeps the input, clears the old result and never calls the encoder", async () => {
        await generate("fine");
        mocks.encoderCalls.length = 0;
        const tooLarge = "SECRET".padEnd(2049, "é").slice(0, 1025) + "é".repeat(1024);
        expect(new TextEncoder().encode(tooLarge).length).toBeGreaterThan(2048);
        await type(tooLarge);
        await click("Generate QR code");
        expect(alertText()).toBe("QR code text must be 2,048 UTF-8 bytes or less.");
        expect(alertText()).not.toContain("SECRET");
        expect(input().value).toBe(tooLarge);
        expect(preview()).toBeNull();
        expect(download()).toBeNull();
        expect(mocks.encoderCalls).toHaveLength(0);
        expect(toDataUrl).toHaveBeenCalledTimes(1);
        expect(mocks.track).toHaveBeenCalledTimes(1);
    });

    it("accepts exactly 2048 multibyte bytes", async () => {
        await generate("é".repeat(1024));
        expect(alertText()).toBe("");
        expect(download()).not.toBeNull();
    });

    it("shows a bounded error when the encoder fails and emits no success event", async () => {
        mocks.encoderFailure = new RangeError("Data too long SECRET");
        await type("SECRET");
        await click("Generate QR code");
        expect(alertText()).toBe("Could not generate the QR code.");
        expect(alertText()).not.toContain("SECRET");
        expect(download()).toBeNull();
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it.each([
        ["returns a non-PNG data URL", () => "data:,"],
        ["returns malformed base64", () => "data:image/png;base64,***"],
        ["throws", () => { throw new Error("SECURITY SECRET"); }],
    ])("shows a bounded error and no download when PNG encoding %s", async (_name, behavior) => {
        toDataUrl.mockImplementation(behavior);
        await type("SECRET");
        await click("Generate QR code");
        expect(alertText()).toBe("Could not prepare the QR code PNG.");
        expect(alertText()).not.toContain("SECRET");
        expect(createUrl).not.toHaveBeenCalled();
        expect(preview()).toBeNull();
        expect(download()).toBeNull();
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it("shows the same PNG error when no 2D canvas context is available", async () => {
        vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => null);
        await type("text");
        await click("Generate QR code");
        expect(alertText()).toBe("Could not prepare the QR code PNG.");
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it("clears an error and recovers on the next edit and generation", async () => {
        toDataUrl.mockImplementationOnce(() => "data:,");
        await type("text");
        await click("Generate QR code");
        expect(alertText()).toBe("Could not prepare the QR code PNG.");
        await type("text again");
        expect(alertText()).toBe("");
        await click("Generate QR code");
        expect(download()).not.toBeNull();
        expect(mocks.track).toHaveBeenCalledTimes(1);
    });

    it("sends no network request, writes no storage and no query state", async () => {
        const fetchSpy = vi.fn();
        const xhrOpen = vi.fn();
        const beacon = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        vi.stubGlobal("XMLHttpRequest", class { open = xhrOpen; });
        Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
        const setItem = vi.spyOn(Storage.prototype, "setItem");

        await generate("https://example.com/PRIVATE-PAYLOAD");
        await click("Reset");

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(xhrOpen).not.toHaveBeenCalled();
        expect(beacon).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        expect(window.location.search).toBe("");
        expect(window.location.hash).toBe("");
        expect(setQuery).not.toHaveBeenCalled();
        expect(JSON.stringify(mocks.track.mock.calls)).not.toContain("PRIVATE-PAYLOAD");
    });
});
