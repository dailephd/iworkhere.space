/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImagesToPdfTool } from "./ImagesToPdfTool";
import { ImageFileError } from "../image/imageFile.client";
import type { ImagesToPdfSource } from "./imagesToPdf";
const work = vi.hoisted(() => ({ inspect: vi.fn(), start: vi.fn(), verify: vi.fn(), track: vi.fn(), cancel: vi.fn() }));
vi.mock("./imagesToPdf.client", () => ({ inspectImagesToPdfFile: work.inspect }));
vi.mock("./pdfLib.client", () => ({ startImagesToPdfOperation: work.start }));
vi.mock("./pdfLibVerification.client", () => ({ verifyPdfLibOutput: work.verify }));
vi.mock("@/module/observability", () => ({ trackEvent: work.track }));
let host: HTMLDivElement, root: Root;
const createUrl = vi.fn(), revokeUrl = vi.fn(), setQuery = vi.fn();
const bytes = new TextEncoder().encode("%PDF-1.7\n");
const metadata = (width = 80): ImagesToPdfSource => ({ bytes, format: "png", width, height: 60 });
const file = (name = "PRIVATE.png", size = 10) => { const value = new File([bytes], name); Object.defineProperty(value, "size", { value: size }); return value; };
const input = () => host.querySelector<HTMLInputElement>('input[type="file"]')!;
const action = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function select(files: File[] = [file()]) {
    Object.defineProperty(input(), "files", { configurable: true, value: files });
    await act(async () => input().dispatchEvent(new Event("change", { bubbles: true })));
}
async function click(name: string) {
    const button = [...host.querySelectorAll("button")].find(value => (value.getAttribute("aria-label") ?? value.textContent) === name)!;
    await act(async () => button.click());
}
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(async () => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl }); let index = 0; createUrl.mockImplementation(() => `blob:result-${++index}`);
    work.inspect.mockImplementation(async () => metadata()); work.verify.mockResolvedValue(undefined);
    work.start.mockImplementation(() => ({ promise: Promise.resolve(bytes), cancel: work.cancel }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(createElement(ImagesToPdfTool, { toolId: "images-to-pdf", setQuery })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("adds additional batches and intentional duplicates, displays metadata, and uses ordered transitions", async () => {
    expect(action().disabled).toBe(true); expect(host.querySelector('label[for="images-pdf-source"]')).not.toBeNull();
    work.inspect.mockResolvedValueOnce(metadata(81)).mockResolvedValueOnce(metadata(82));
    await select([file("one.png"), file("two.png")]); await select([file("one.png")]);
    expect(host.querySelectorAll("li")).toHaveLength(3); expect(host.textContent).toContain("PNG · 81 × 60"); expect(action().disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Move up image 1: one.png"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Move down image 3: one.png"]')!.disabled).toBe(true);
    await click("Move down image 1: one.png"); await submit();
    expect(work.start.mock.calls[0][0].map((value: ImagesToPdfSource) => value.width)).toEqual([82, 81, 80]);
    expect(work.verify.mock.calls[0][1]).toEqual([{ width: 82, height: 60, rotation: 0 }, { width: 81, height: 60, rotation: 0 }, { width: 80, height: 60, rotation: 0 }]);
    expect(document.activeElement?.textContent).toBe("PDF ready"); expect(host.querySelector("a")!.download).toBe("images-to-pdf.pdf");
    await click("Move up image 2: one.png"); expect(host.querySelector("a")).toBeNull(); expect(revokeUrl).toHaveBeenCalledOnce();
    await click("Remove image 3: one.png"); expect(host.querySelectorAll("li")).toHaveLength(2); expect(document.activeElement).toBe(input());
    expect(work.track.mock.calls).toEqual([["tool_executed", { toolId: "images-to-pdf", slug: "images-to-pdf" }]]); expect(setQuery).not.toHaveBeenCalled();
});
it("rejects count/aggregate limits before decoding, including the accepted 20-image boundary", async () => {
    await select(Array(20).fill(file())); expect(host.querySelectorAll("li")).toHaveLength(20);
    work.inspect.mockClear(); await select(); expect(work.inspect).not.toHaveBeenCalled(); expect(host.textContent).toContain("20 images");
    await click("Reset"); await select([file("large.png", 25 * 1024 * 1024 + 1)]); expect(work.inspect).not.toHaveBeenCalled(); expect(host.textContent).toContain("25 MiB");
});
it("keeps accepted collection unchanged when any new file fails and focuses the accessible error", async () => {
    await select(); work.inspect.mockResolvedValueOnce(metadata()).mockRejectedValueOnce(new ImageFileError("WebP is unsupported. Choose JPEG or PNG."));
    await select([file("good.png"), file("bad.webp")]); expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("WebP"); expect(document.activeElement).toBe(host.querySelector('[role="alert"]'));
});
it("revokes on add, remove, new operation, Reset and unmount", async () => {
    await select(); await submit(); await select(); expect(host.querySelector("a")).toBeNull();
    await submit(); await submit(); await click("Remove image 2: PRIVATE.png"); expect(host.querySelector("a")).toBeNull();
    await submit(); await click("Reset"); expect(document.activeElement).toBe(input()); expect(action().disabled).toBe(true); expect(host.querySelectorAll("li")).toHaveLength(0);
    await select(); await submit(); await act(async () => root.unmount()); expect(revokeUrl.mock.calls.length).toBe(createUrl.mock.calls.length);
});
it("aborts inspection and ignores stale completions after Reset", async () => {
    let done!: (value: ImagesToPdfSource) => void;
    work.inspect.mockReturnValueOnce(new Promise(resolve => { done = resolve; })); await select();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Inspecting"); expect(action().disabled).toBe(true);
    const signal = work.inspect.mock.calls[0][1] as AbortSignal; await click("Reset"); expect(signal.aborted).toBe(true);
    await act(async () => done(metadata())); expect(host.querySelectorAll("li")).toHaveLength(0); expect(host.querySelector('[role="alert"]')).toBeNull();
});
it.each(["move", "remove", "add", "reset", "unmount"])("cancels generation and rejects stale work on %s", async mutation => {
    await select([file("one.png"), file("two.png")]); let done!: (value: Uint8Array) => void;
    work.start.mockReturnValueOnce({ promise: new Promise(resolve => { done = resolve; }), cancel: work.cancel }); await submit();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Creating"); expect(action().disabled).toBe(true);
    if (mutation === "move") await click("Move down image 1: one.png");
    else if (mutation === "remove") await click("Remove image 1: one.png");
    else if (mutation === "add") await select();
    else if (mutation === "reset") await click("Reset");
    else await act(async () => root.unmount());
    expect(work.cancel).toHaveBeenCalledOnce(); await act(async () => done(bytes)); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
});
it("aborts stale independent verification without adopting a URL", async () => {
    await select(); let done!: () => void; work.verify.mockReturnValueOnce(new Promise<void>(resolve => { done = resolve; })); await submit();
    const signal = work.verify.mock.calls[0][2] as AbortSignal; await click("Reset"); expect(signal.aborted).toBe(true);
    await act(async () => done()); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
});
it.each(["worker", "verification"])("bounds %s failures and exposes no download or telemetry", async stage => {
    await select();
    if (stage === "worker") work.start.mockReturnValueOnce({ promise: Promise.reject(new Error("PRIVATE diagnostic")), cancel: work.cancel });
    else work.verify.mockRejectedValueOnce(new Error("PRIVATE diagnostic"));
    await submit(); expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.textContent).not.toContain("PRIVATE diagnostic"); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
});
