/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MergePdfTool } from "./MergePdfTool";
import { SplitPdfTool } from "./SplitPdfTool";
import { PdfFileError, MAX_SINGLE_PDF_BYTES } from "./pdfFile";

const work = vi.hoisted(() => ({ inspect: vi.fn(), merge: vi.fn(), split: vi.fn(), verify: vi.fn(), track: vi.fn(), cancel: vi.fn() }));
vi.mock("./pdfFile.client", () => ({ inspectPdfFile: work.inspect }));
vi.mock("./pdfLib.client", () => ({ startMergePdfOperation: work.merge, startSplitPdfOperation: work.split }));
vi.mock("./pdfLibVerification.client", () => ({ verifyPdfLibOutput: work.verify }));
vi.mock("@/module/observability", () => ({ trackEvent: work.track }));
let host: HTMLDivElement, root: Root;
const createUrl = vi.fn(), revokeUrl = vi.fn(), setQuery = vi.fn();
const bytes = new TextEncoder().encode("%PDF-1.7\n");
const inspection = (count = 3) => ({ bytes, inspection: { pageCount: count, page: Array.from({ length: count }, (_, index) => ({ width: 320 + index, height: 240, rotation: index === 1 ? 90 : 0 })) } });
const file = (name = "PRIVATE.pdf", size = 10) => { const value = new File([bytes], name); Object.defineProperty(value, "size", { value: size }); return value; };
async function select(input: File[] = [file()]) {
    const element = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(element, "files", { configurable: true, value: input });
    await act(async () => element.dispatchEvent(new Event("change", { bubbles: true })));
}
async function click(name: string) {
    const button = [...host.querySelectorAll("button")].find(value => (value.getAttribute("aria-label") ?? value.textContent) === name)!;
    await act(async () => button.click());
}
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
async function edit(index: number, text: string) {
    const element = host.querySelectorAll<HTMLInputElement>('input:not([type="file"])')[index];
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, text);
        element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
    });
}
const action = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    let index = 0; createUrl.mockImplementation(() => `blob:result-${++index}`);
    work.inspect.mockImplementation(async () => inspection()); work.verify.mockResolvedValue(undefined);
    work.merge.mockImplementation(() => ({ promise: Promise.resolve(bytes), cancel: work.cancel }));
    work.split.mockImplementation((_bytes, group: number[][]) => ({ promise: Promise.resolve(group.map(() => bytes)), cancel: work.cancel }));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("Merge PDF local ownership", () => {
    beforeEach(async () => { await act(async () => root.render(createElement(MergePdfTool, { toolId: "merge-pdf", setQuery }))); });
    it("adds atomically, keeps intentional duplicates, reorders/removes and enables only accepted collections", async () => {
        expect(action().disabled).toBe(true); await select([file("one.pdf")]); expect(action().disabled).toBe(true);
        await select([file("one.pdf"), file("three.pdf")]); expect(host.querySelectorAll("li")).toHaveLength(3); expect(action().disabled).toBe(false);
        await click("Move down PDF 1: one.pdf");
        await submit(); expect(work.merge.mock.calls[0][0]).toHaveLength(3);
        expect(createUrl).toHaveBeenCalledOnce(); expect(document.activeElement?.textContent).toBe("Merged PDF ready");
        await click("Move up PDF 2: one.pdf"); expect(host.querySelector("a")).toBeNull(); expect(revokeUrl).toHaveBeenCalledWith("blob:result-1");
        await click("Remove PDF 3: three.pdf"); expect(document.activeElement).toBe(host.querySelector('input[type="file"]'));
        work.inspect.mockResolvedValueOnce(inspection()).mockRejectedValueOnce(new PdfFileError("encrypted"));
        await select([file("new.pdf"), file("bad.pdf")]); expect(host.querySelectorAll("li")).toHaveLength(2);
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("Encrypted"); expect(document.activeElement).toBe(host.querySelector('[role="alert"]'));
        expect(work.track.mock.calls).toEqual([["tool_executed", { toolId: "merge-pdf", slug: "merge-pdf" }]]); expect(setQuery).not.toHaveBeenCalled();
    });
    it("rejects aggregate count/bytes before inspection and pages after atomic inspection", async () => {
        await select([file(), file()]); work.inspect.mockClear();
        await select(Array(9).fill(file())); expect(work.inspect).not.toHaveBeenCalled(); expect(host.textContent).toContain("10 PDFs");
        await select(Array(3).fill(file("large.pdf", MAX_SINGLE_PDF_BYTES))); expect(work.inspect).not.toHaveBeenCalled(); expect(host.textContent).toContain("25 MiB");
        work.inspect.mockResolvedValueOnce(inspection(95)); await select([file()]); expect(host.textContent).toContain("100 pages"); expect(host.querySelectorAll("li")).toHaveLength(2);
    });
    it("invalidates on accepted add, remove, Reset and unmount, with safe telemetry", async () => {
        await select([file(), file()]); await submit(); await select([file()]); expect(host.querySelector("a")).toBeNull();
        await submit(); await click("Remove PDF 3: PRIVATE.pdf"); expect(host.querySelector("a")).toBeNull();
        await submit(); await click("Reset"); expect(host.querySelectorAll("li")).toHaveLength(0); expect(action().disabled).toBe(true);
        expect(document.activeElement).toBe(host.querySelector('input[type="file"]'));
        await select([file(), file()]); await submit(); await act(async () => root.unmount());
        expect(revokeUrl).toHaveBeenCalledTimes(4);
        expect(work.track.mock.calls.every(call => JSON.stringify(call) === JSON.stringify(["tool_executed", { toolId: "merge-pdf", slug: "merge-pdf" }]))).toBe(true);
    });
    it("aborts pending inspection and rejects stale processing on list mutation/Reset", async () => {
        let inspectDone!: (value: ReturnType<typeof inspection>) => void;
        work.inspect.mockReturnValueOnce(new Promise(resolve => { inspectDone = resolve; })); await select([file()]);
        const signal = work.inspect.mock.calls[0][1] as AbortSignal; await click("Reset"); expect(signal.aborted).toBe(true);
        await act(async () => inspectDone(inspection())); expect(host.querySelectorAll("li")).toHaveLength(0);
        await select([file("one.pdf"), file("two.pdf")]);
        let done!: (value: Uint8Array) => void; work.merge.mockReturnValueOnce({ promise: new Promise(resolve => { done = resolve; }), cancel: work.cancel });
        await submit(); expect(action().disabled).toBe(true); await click("Move down PDF 1: one.pdf"); expect(work.cancel).toHaveBeenCalledOnce();
        await act(async () => done(bytes)); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
    });
    it.each(["processing", "verification"])("discards %s failure without raw diagnostics or telemetry", async stage => {
        await select([file(), file()]);
        if (stage === "processing") work.merge.mockImplementationOnce(() => ({ promise: Promise.reject(new Error("PRIVATE diagnostic")), cancel: work.cancel }));
        else work.verify.mockRejectedValueOnce(new Error("PRIVATE diagnostic"));
        await submit(); expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.textContent).not.toContain("PRIVATE diagnostic"); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
    });
});

describe("Split PDF local ownership", () => {
    beforeEach(async () => { await act(async () => root.render(createElement(SplitPdfTool, { toolId: "split-pdf", setQuery }))); });
    it("parses exact sequence, permits overlap and shows individual verified results", async () => {
        await select(); expect(action().disabled).toBe(true); expect(host.querySelector('[aria-invalid="true"]')).not.toBeNull();
        await edit(0, "1-2"); await click("Add output group"); expect(document.activeElement).toBe(host.querySelectorAll('input:not([type="file"])')[1]);
        await edit(1, "3,1,3"); expect(action().disabled).toBe(false); await submit();
        expect(work.split.mock.calls[0][1]).toEqual([[1, 2], [3, 1]]); expect(work.verify).toHaveBeenCalledTimes(2);
        expect(host.querySelectorAll("a")).toHaveLength(2); expect(host.querySelectorAll("a")[1].download).toBe("PRIVATE-split-02-pages-3_1.pdf");
        expect(document.activeElement?.textContent).toBe("Split PDFs ready");
        expect(work.track.mock.calls).toEqual([["tool_executed", { toolId: "split-pdf", slug: "split-pdf" }]]); expect(setQuery).not.toHaveBeenCalled();
        await edit(1, "4"); expect(action().disabled).toBe(true); expect(host.querySelectorAll("a")).toHaveLength(0); expect(revokeUrl).toHaveBeenCalledTimes(2);
    });
    it("enforces 20 groups, at least one group and intentional remove focus", async () => {
        await select(); await click("Remove output group 1"); expect(host.querySelectorAll('input:not([type="file"])')).toHaveLength(1);
        for (let index = 1; index < 20; index++) await click("Add output group");
        const add = [...host.querySelectorAll("button")].find(value => value.textContent === "Add output group")!; expect(add.disabled).toBe(true);
        await click("Remove output group 20"); expect(add.disabled).toBe(false); expect(document.activeElement).toBe(host.querySelectorAll('input:not([type="file"])')[18]);
    });
    it("revokes results on group add/remove, source replacement, Reset and unmount", async () => {
        await select(); await edit(0, "1"); await submit(); await click("Add output group"); expect(host.querySelectorAll("a")).toHaveLength(0);
        await edit(1, "2"); await submit(); await click("Remove output group 2"); expect(host.querySelectorAll("a")).toHaveLength(0);
        await submit(); await select([file("replacement.pdf")]); expect(action().disabled).toBe(true); expect(host.querySelector<HTMLInputElement>('input:not([type="file"])')?.value).toBe("");
        await edit(0, "1"); await submit(); await click("Reset"); expect(document.activeElement).toBe(host.querySelector('input[type="file"]'));
        await select(); await edit(0, "1"); await submit(); await act(async () => root.unmount()); expect(revokeUrl.mock.calls.length).toBe(createUrl.mock.calls.length);
    });
    it("cancels stale operation on source replacement and group edits", async () => {
        await select(); await edit(0, "1");
        let done!: (value: Uint8Array[]) => void; work.split.mockReturnValueOnce({ promise: new Promise(resolve => { done = resolve; }), cancel: work.cancel });
        await submit(); await edit(0, "2"); expect(work.cancel).toHaveBeenCalledOnce();
        await act(async () => done([bytes])); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
        work.split.mockReturnValueOnce({ promise: new Promise(resolve => { done = resolve; }), cancel: work.cancel }); await submit(); await select();
        await act(async () => done([bytes])); expect(createUrl).not.toHaveBeenCalled();
    });
    it("never publishes a partial set if any verification fails", async () => {
        await select(); await edit(0, "1"); await click("Add output group"); await edit(1, "2");
        work.verify.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("PRIVATE diagnostic")); await submit();
        expect(host.textContent).toContain("could not all be independently verified"); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
    });
    it.each(["encrypted", "malformed", "source-limit", "page-limit"] as const)("announces bounded %s source failure", async category => {
        work.inspect.mockRejectedValueOnce(new PdfFileError(category)); await select(); expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(document.activeElement).toBe(host.querySelector('[role="alert"]')); expect(work.track).not.toHaveBeenCalled();
    });
});
