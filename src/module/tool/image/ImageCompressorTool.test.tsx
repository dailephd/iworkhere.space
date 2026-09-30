/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageCompressorTool } from "./ImageCompressorTool";

const operation = vi.hoisted(() => ({ track: vi.fn(), inspect: vi.fn(), compress: vi.fn(), format: vi.fn() }));
vi.mock("@/module/observability", () => ({ trackEvent: operation.track }));
vi.mock("./imageFile.client", () => ({
    ImageFileError: class extends Error {}, inspectImageFile: operation.inspect, readImageFileFormat: operation.format,
}));
vi.mock("./imageCompressor.client", () => ({ compressImage: operation.compress }));

let host: HTMLDivElement;
let root: Root;
const setQuery = vi.fn();
const createUrl = vi.fn();
const revokeUrl = vi.fn();

async function select() {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["private bytes"], "PRIVATE_NAME.jpg", { type: "image/jpeg" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

async function submit() {
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("Image Compressor local lifecycle and telemetry", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
        let nextUrl = 0;
        createUrl.mockImplementation(() => `blob:local-${++nextUrl}`);
        operation.format.mockResolvedValue("jpeg");
        operation.inspect.mockResolvedValue({ width: 80, height: 60 });
        operation.compress.mockResolvedValue(new Blob(["output"], { type: "image/jpeg" }));
        host = document.createElement("div"); document.body.append(host); root = createRoot(host);
        await act(async () => root.render(createElement(ImageCompressorTool, { toolId: "image-compressor", setQuery })));
    });
    afterEach(async () => {
        await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
    });

    it("emits exactly one metadata-free event per successful compress and never opens or writes queries", async () => {
        expect(operation.track).not.toHaveBeenCalled();
        await select(); await submit(); await submit();
        expect(operation.track.mock.calls).toEqual([
            ["tool_executed", { toolId: "image-compressor", slug: "image-compressor" }],
            ["tool_executed", { toolId: "image-compressor", slug: "image-compressor" }],
        ]);
        expect(setQuery).not.toHaveBeenCalled();
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-2");
        expect(host.querySelector("a")?.getAttribute("download")).toBe("PRIVATE_NAME-compressed.jpg");
    });

    it("reports no reduction without a result URL but emits one safe completed-execution event", async () => {
        await select(); operation.compress.mockResolvedValueOnce(new Blob(["a candidate larger than the source"], { type: "image/jpeg" })); await submit();
        expect(host.textContent).toContain("No smaller file produced");
        expect(host.querySelector("a")).toBeNull();
        expect(createUrl).toHaveBeenCalledTimes(1);
        expect(operation.track.mock.calls).toEqual([["tool_executed", { toolId: "image-compressor", slug: "image-compressor" }]]);
        expect(setQuery).not.toHaveBeenCalled();
    });

    it("does not adopt or track a stale encode after Reset", async () => {
        await select();
        let complete!: (value: Blob) => void;
        operation.compress.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
        await submit();
        await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Reset")!.click());
        await act(async () => complete(new Blob(["small"], { type: "image/jpeg" })));
        expect(host.querySelector("img")).toBeNull();
        expect(operation.track).not.toHaveBeenCalled();
        expect(createUrl).toHaveBeenCalledTimes(1);
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-1");
    });

    it("does not adopt a pending selection after Reset", async () => {
        let complete!: (value: { width: number; height: number }) => void;
        operation.inspect.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
        await select();
        await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Reset")!.click());
        await act(async () => complete({ width: 80, height: 60 }));
        expect(host.querySelector("img")).toBeNull();
        expect(createUrl).not.toHaveBeenCalled();
        expect(operation.track).not.toHaveBeenCalled();
        expect(host.querySelector<HTMLInputElement>('input[type="range"]')).toBeNull();
    });

    it("keeps unexpected browser operation failures recoverable without telemetry or query writes", async () => {
        await select(); operation.compress.mockRejectedValueOnce(new Error("private browser details")); await submit();
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be compressed");
        expect(host.textContent).not.toContain("private browser details");
        expect(operation.track).not.toHaveBeenCalled(); expect(setQuery).not.toHaveBeenCalled();
        expect(createUrl).toHaveBeenCalledTimes(1);
    });
});
