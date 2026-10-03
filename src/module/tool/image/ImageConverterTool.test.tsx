/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageConverterTool } from "./ImageConverterTool";

const operation = vi.hoisted(() => ({ track: vi.fn(), inspect: vi.fn(), convert: vi.fn(), format: vi.fn() }));
vi.mock("@/module/observability", () => ({ trackEvent: operation.track }));
vi.mock("./imageFile.client", () => ({
    ImageFileError: class extends Error {}, inspectImageFile: operation.inspect, readImageFileFormat: operation.format,
}));
vi.mock("./imageConverter.client", () => ({ convertImage: operation.convert }));

let host: HTMLDivElement;
let root: Root;
const setQuery = vi.fn();
const createUrl = vi.fn();
const revokeUrl = vi.fn();

async function select() {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["private bytes"], "PRIVATE_NAME.jpg", { type: "image/png" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

async function submit() {
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("Image Converter local lifecycle and telemetry", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
        let nextUrl = 0;
        createUrl.mockImplementation(() => `blob:local-${++nextUrl}`);
        operation.format.mockResolvedValue("jpeg");
        operation.inspect.mockResolvedValue({ width: 80, height: 60 });
        operation.convert.mockResolvedValue(new Blob(["output"], { type: "image/png" }));
        host = document.createElement("div"); document.body.append(host); root = createRoot(host);
        await act(async () => root.render(createElement(ImageConverterTool, { toolId: "image-converter", setQuery })));
    });
    afterEach(async () => {
        await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
    });

    it("emits exactly one metadata-free event per successful convert and never opens or writes queries", async () => {
        expect(operation.track).not.toHaveBeenCalled();
        await select(); await submit(); await submit();
        expect(operation.track.mock.calls).toEqual([
            ["tool_executed", { toolId: "image-converter", slug: "image-converter" }],
            ["tool_executed", { toolId: "image-converter", slug: "image-converter" }],
        ]);
        expect(setQuery).not.toHaveBeenCalled();
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-2");
        expect(host.querySelector("a")?.getAttribute("download")).toBe("PRIVATE_NAME-converted.png");
    });

    it("clears and revokes results on output changes, preserving quality", async () => {
        await select(); await submit();
        const output = host.querySelector("select")!;
        await act(async () => { output.value = "webp"; output.dispatchEvent(new Event("change", { bubbles: true })); });
        expect(host.querySelector("a")).toBeNull();
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-2");
        expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("90");
        await submit();
        await act(async () => { output.value = "png"; output.dispatchEvent(new Event("change", { bubbles: true })); });
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-3");
    });

    it("quality edits invalidate and revoke the previous result", async () => {
        operation.format.mockResolvedValueOnce("png"); await select(); await submit();
        const input = host.querySelector<HTMLInputElement>('input[type="range"]')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "60");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(host.querySelector("a")).toBeNull();
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-2");
    });

    it("validation errors emit no event", async () => {
        operation.format.mockRejectedValueOnce(new Error("private details"));
        await select(); await submit();
        expect(host.querySelector('[role="alert"]')).not.toBeNull();
        expect(operation.track).not.toHaveBeenCalled(); expect(createUrl).not.toHaveBeenCalled();
    });

    it("does not adopt or track a stale encode after Reset", async () => {
        await select();
        let complete!: (value: Blob) => void;
        operation.convert.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
        await submit();
        await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Reset")!.click());
        await act(async () => complete(new Blob(["small"], { type: "image/png" })));
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
        await select(); operation.convert.mockRejectedValueOnce(new Error("private browser details")); await submit();
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("unexpected browser error occurred while converting");
        expect(host.textContent).not.toContain("private browser details");
        expect(operation.track).not.toHaveBeenCalled(); expect(setQuery).not.toHaveBeenCalled();
        expect(createUrl).toHaveBeenCalledTimes(1);
    });
});
