/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
    release: undefined as undefined | (() => void),
    promise: Promise.resolve(),
    failure: null as Error | null,
    requested: 0,
}));
const mocks = vi.hoisted(() => ({ track: vi.fn(), capture: vi.fn() }));

vi.mock("@/module/observability", () => ({ trackEvent: mocks.track, captureError: mocks.capture }));
// Registered per test (not hoisted) so every test gets a fresh, gated module instance.
function registerGatedQrCodeModule() {
    vi.doMock("./qrCode", async () => {
        gate.requested += 1;
        await gate.promise;
        if (gate.failure) throw gate.failure;
        return vi.importActual<typeof import("./qrCode")>("./qrCode");
    });
}

const createUrl = vi.fn();
const revokeUrl = vi.fn();
let toDataUrl: ReturnType<typeof vi.spyOn>;
let host: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;
const realUrlStatics = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

function holdModule() {
    gate.promise = new Promise<void>(resolve => { gate.release = resolve; });
}

// Release the gated module and wait until the mocked module itself has settled, then let the
// component continuations that were waiting on it run.
async function releaseModule() {
    await act(async () => {
        gate.release?.();
        await import("./qrCode").catch(() => undefined);
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
}

function input() { return host.querySelector<HTMLTextAreaElement>("textarea")!; }
function button(name: string) { return [...host.querySelectorAll("button")].find(item => item.textContent === name)!; }
function alertText() { return host.querySelector('[role="alert"]')!.textContent ?? ""; }

async function type(value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
        setter.call(input(), value);
        input().dispatchEvent(new Event("input", { bubbles: true }));
    });
}

async function click(name: string) {
    await act(async () => button(name).click());
}

async function mount() {
    const { QrCodeGeneratorTool } = await import("./QrCodeGeneratorTool");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(QrCodeGeneratorTool, { toolId: "qr-code-generator" })));
    await vi.waitFor(() => expect(gate.requested).toBe(1));
}

describe("QR Code Generator dynamic module loading", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        registerGatedQrCodeModule();
        gate.failure = null;
        gate.requested = 0;
        gate.promise = Promise.resolve();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        let nextUrl = 0;
        createUrl.mockImplementation(() => `blob:qr-${++nextUrl}`);
        URL.createObjectURL = createUrl;
        URL.revokeObjectURL = revokeUrl;
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
            createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData: vi.fn(),
        }) as unknown as CanvasRenderingContext2D);
        toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/png;base64,UE5H");
        consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(async () => {
        await act(async () => root?.unmount());
        host?.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        URL.createObjectURL = realUrlStatics.create;
        URL.revokeObjectURL = realUrlStatics.revoke;
    });

    it("requests the encoder only when the QR component renders and uses no payload, event or error for the preload", async () => {
        expect(gate.requested).toBe(0);
        await mount();
        expect(mocks.track).not.toHaveBeenCalled();
        expect(mocks.capture).not.toHaveBeenCalled();
        expect(alertText()).toBe("");
        expect(host.querySelector("img")).toBeNull();
    });

    it("waits for the module before generating, then completes exactly as before", async () => {
        holdModule();
        await mount();
        await type("waiting text");
        await click("Generate QR code");
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(createUrl).not.toHaveBeenCalled();
        expect(mocks.track).not.toHaveBeenCalled();
        await releaseModule();
        await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
        expect(host.querySelector("a[download]")?.getAttribute("download")).toBe("qr-code.png");
        expect(mocks.track.mock.calls).toEqual([["tool_executed", { toolId: "qr-code-generator", slug: "qr-code-generator" }]]);
    });

    it("ignores a module-load continuation after the input is edited", async () => {
        holdModule();
        await mount();
        await type("old text");
        await click("Generate QR code");
        await type("new text");
        await releaseModule();
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(createUrl).not.toHaveBeenCalled();
        expect(host.querySelector("a[download]")).toBeNull();
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it("ignores a module-load continuation after Reset", async () => {
        holdModule();
        await mount();
        await type("text");
        await click("Generate QR code");
        await click("Reset");
        await releaseModule();
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(input().value).toBe("");
        expect(mocks.track).not.toHaveBeenCalled();
    });

    it("lets only the newest of two generations started during module load continue", async () => {
        holdModule();
        await mount();
        await type("text");
        await click("Generate QR code");
        await click("Generate QR code");
        await releaseModule();
        await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
        await releaseModule();
        expect(createUrl).toHaveBeenCalledTimes(1);
        expect(toDataUrl).toHaveBeenCalledTimes(1);
    });

    it("does not touch state or the canvas when the component unmounts during module load", async () => {
        holdModule();
        await mount();
        await type("text");
        await click("Generate QR code");
        await act(async () => root.unmount());
        await releaseModule();
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(createUrl).not.toHaveBeenCalled();
        expect(mocks.track).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
        root = createRoot(host);
    });

    it("shows a bounded error without payload or success event when the module fails to load", async () => {
        gate.failure = new Error("Loading chunk failed SECRET-PAYLOAD");
        await mount();
        await type("SECRET-PAYLOAD");
        await click("Generate QR code");
        await releaseModule();
        expect(alertText()).toBe("Could not generate the QR code.");
        expect(alertText()).not.toContain("SECRET");
        expect(host.querySelector("img")).toBeNull();
        expect(host.querySelector("a[download]")).toBeNull();
        expect(toDataUrl).not.toHaveBeenCalled();
        expect(mocks.track).not.toHaveBeenCalled();
        expect(mocks.capture).toHaveBeenCalledTimes(1);
        expect(mocks.capture.mock.calls[0][1]).toEqual({ toolId: "qr-code-generator", boundary: "QrCodeGeneratorTool.loadQrCodeModule" });
        expect(JSON.stringify(mocks.capture.mock.calls[0][1])).not.toContain("SECRET");
    });

    it("does not report a module-load failure that finishes after the input changed", async () => {
        holdModule();
        gate.failure = new Error("chunk failed");
        await mount();
        await type("text");
        await click("Generate QR code");
        await type("text!");
        await releaseModule();
        expect(alertText()).toBe("");
        expect(mocks.capture).not.toHaveBeenCalled();
    });
});
