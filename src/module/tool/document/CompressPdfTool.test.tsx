/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompressPdfTool } from "./CompressPdfTool";
import { PdfFileError } from "./pdfFile";
import { CompressPdfVerificationError, type CompressPdfOutcome } from "./compressPdf.client";
const work = vi.hoisted(() => ({ inspect: vi.fn(), compress: vi.fn(), track: vi.fn() }));
vi.mock("./pdfFile.client", () => ({ inspectPdfFile: work.inspect }));
vi.mock("./compressPdf.client", async original => ({ ...await original<typeof import("./compressPdf.client")>(), compressPdf: work.compress }));
vi.mock("@/module/observability", () => ({ trackEvent: work.track }));
let host: HTMLDivElement, root: Root;
const createUrl = vi.fn(), revokeUrl = vi.fn(), setQuery = vi.fn();
const bytes = new Uint8Array(100), inspected = { bytes, inspection: { pageCount: 1, page: [{ width: 320, height: 240, rotation: 0 }] } };
const smaller: CompressPdfOutcome = { status: "smaller", bytes: new Uint8Array(60), savedBytes: 40, percentage: 40 };
const input = () => host.querySelector<HTMLInputElement>('input[type="file"]')!;
const action = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function select() { Object.defineProperty(input(), "files", { configurable: true, value: [new File([bytes], "PRIVATE.pdf")] }); await act(async () => input().dispatchEvent(new Event("change", { bubbles: true }))); }
async function reset() { await act(async () => [...host.querySelectorAll("button")].find(value => value.textContent === "Reset")!.click()); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(async () => {
    vi.resetAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl }); createUrl.mockReturnValue("blob:result");
    work.inspect.mockResolvedValue(inspected); work.compress.mockResolvedValue(smaller);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(createElement(CompressPdfTool, { toolId: "compress-pdf", setQuery })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("enables only after inspection and exposes actual size/savings, PDF download and safe telemetry", async () => {
    expect(action().disabled).toBe(true); await select(); expect(action().disabled).toBe(false); await submit();
    expect(host.textContent).toContain("100 B"); expect(host.textContent).toContain("60 B"); expect(host.textContent).toContain("40 bytes"); expect(host.textContent).toContain("40.00%");
    const link = host.querySelector('a')!; expect(link.download).toBe("PRIVATE-compressed.pdf"); expect(link.href).toBe("blob:result"); expect(createUrl.mock.calls[0][0].type).toBe("application/pdf");
    expect(document.activeElement?.textContent).toBe("Smaller PDF ready"); expect(work.track.mock.calls).toEqual([["tool_executed", { toolId: "compress-pdf", slug: "compress-pdf" }]]); expect(setQuery).not.toHaveBeenCalled();
});
it("announces neutral no reduction with no URL/download/telemetry and retains source", async () => {
    work.compress.mockResolvedValue({ status: "no-reduction" }); await select(); await submit();
    expect(document.activeElement?.textContent).toBe("NO REDUCTION ACHIEVED"); expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.querySelector('a')).toBeNull(); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled(); expect(action().disabled).toBe(false); expect(host.textContent).toContain("PRIVATE.pdf"); await reset(); expect(host.textContent).not.toContain("NO REDUCTION ACHIEVED"); expect(document.activeElement).toBe(input());
});
it.each(["source", "reset", "unmount", "new-compression"])("revokes successful result on %s", async mutation => {
    await select(); await submit();
    if (mutation === "source") await select(); else if (mutation === "reset") await reset(); else if (mutation === "unmount") await act(async () => root.unmount()); else await submit();
    expect(revokeUrl).toHaveBeenCalledOnce(); if (mutation !== "new-compression") expect(host.querySelector('a')).toBeNull();
});
it.each(["source", "reset", "unmount"])("cancels pending work and ignores stale smaller/no-reduction outcomes on %s", async mutation => {
    for (const output of [smaller, { status: "no-reduction" } as const]) {
        await select(); let done!: (value: CompressPdfOutcome) => void; work.compress.mockReturnValueOnce(new Promise(resolve => { done = resolve; })); await submit();
        const signal = work.compress.mock.calls.at(-1)![1] as AbortSignal; expect(action().disabled).toBe(true); expect(host.querySelector('[role="status"]')!.textContent).toContain("Compressing");
        if (mutation === "source") await select(); else if (mutation === "reset") await reset(); else await act(async () => root.unmount());
        expect(signal.aborted).toBe(true); await act(async () => done(output)); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled(); expect(host.textContent).not.toContain("NO REDUCTION ACHIEVED");
        if (mutation === "unmount") break;
    }
});
it("cancels inspection and ignores late selection on Reset", async () => {
    let done!: (value: typeof inspected) => void; work.inspect.mockReturnValueOnce(new Promise(resolve => { done = resolve; })); await select(); const signal = work.inspect.mock.calls[0][1] as AbortSignal;
    expect(action().disabled).toBe(true); await reset(); expect(signal.aborted).toBe(true); await act(async () => done(inspected)); expect(action().disabled).toBe(true);
});
it.each(["encrypted", "malformed", "signature", "source-limit", "page-limit"] as const)("focuses inherited %s source rejection", async category => {
    work.inspect.mockRejectedValueOnce(new PdfFileError(category)); await select(); expect(action().disabled).toBe(true); expect(document.activeElement).toBe(host.querySelector('[role="alert"]')); expect(createUrl).not.toHaveBeenCalled();
});
it.each([new CompressPdfVerificationError(), new Error("private pointer /input.pdf")])("keeps source on bounded operation failure", async failure => {
    await select(); work.compress.mockRejectedValueOnce(failure); await submit(); expect(document.activeElement).toBe(host.querySelector('[role="alert"]')); expect(host.textContent).not.toContain("private pointer"); expect(host.textContent).toContain("PRIVATE.pdf"); expect(action().disabled).toBe(false); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled();
});
