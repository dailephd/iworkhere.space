/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageResizerTool } from "./ImageResizerTool";

const operation = vi.hoisted(() => ({ track: vi.fn(), inspect: vi.fn(), resize: vi.fn(), format: vi.fn() }));
vi.mock("@/module/observability", () => ({ trackEvent: operation.track }));
vi.mock("./imageFile.client", () => ({
    ImageFileError: class extends Error {}, inspectImageFile: operation.inspect, readImageFileFormat: operation.format,
}));
vi.mock("./imageResizer.client", () => ({ resizeImage: operation.resize }));

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

describe("Image Resizer local lifecycle and telemetry", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
        let nextUrl = 0;
        createUrl.mockImplementation(() => `blob:local-${++nextUrl}`);
        operation.format.mockResolvedValue("jpeg");
        operation.inspect.mockResolvedValue({ width: 80, height: 60 });
        operation.resize.mockResolvedValue(new Blob(["output"], { type: "image/jpeg" }));
        host = document.createElement("div"); document.body.append(host); root = createRoot(host);
        await act(async () => root.render(createElement(ImageResizerTool, { toolId: "image-resizer", setQuery })));
    });
    afterEach(async () => {
        await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
    });

    it("emits exactly one metadata-free event per successful resize and never opens or writes queries", async () => {
        expect(operation.track).not.toHaveBeenCalled();
        await select(); await submit(); await submit();
        expect(operation.track.mock.calls).toEqual([
            ["tool_executed", { toolId: "image-resizer", slug: "image-resizer" }],
            ["tool_executed", { toolId: "image-resizer", slug: "image-resizer" }],
        ]);
        expect(setQuery).not.toHaveBeenCalled();
        expect(revokeUrl).toHaveBeenCalledWith("blob:local-2");
        expect(host.querySelector("a")?.getAttribute("download")).toBe("PRIVATE_NAME-80x60.jpg");
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
        expect(host.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("");
    });

    it("keeps unexpected browser operation failures recoverable without telemetry or query writes", async () => {
        await select(); operation.resize.mockRejectedValueOnce(new Error("private browser details")); await submit();
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("unexpected browser error occurred while resizing");
        expect(host.textContent).not.toContain("private browser details");
        expect(operation.track).not.toHaveBeenCalled(); expect(setQuery).not.toHaveBeenCalled();
        expect(createUrl).toHaveBeenCalledTimes(1);
    });
});
