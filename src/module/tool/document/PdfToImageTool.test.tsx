/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PdfToImageTool } from "./PdfToImageTool";
import { PdfFileError } from "./pdfFile";
import { PdfToImageError, type PdfToImageOutput } from "./pdfToImage";
const work = vi.hoisted(() => ({ inspect: vi.fn(), convert: vi.fn(), track: vi.fn() }));
vi.mock("./pdfFile.client", () => ({ inspectPdfFile: work.inspect }));
vi.mock("./pdfToImage.client", () => ({ convertPdfToImages: work.convert }));
vi.mock("@/module/observability", () => ({ trackEvent: work.track }));
let host: HTMLDivElement, root: Root;
const createUrl = vi.fn(), revokeUrl = vi.fn(), setQuery = vi.fn();
const bytes = new TextEncoder().encode("%PDF-1.7\n");
const inspected = { bytes, inspection: { pageCount: 30, page: Array(30).fill({ width: 320, height: 240, rotation: 0 }) } };
const output = (pageNumber = 1): PdfToImageOutput => ({ pageNumber, format: "png", width: 667, height: 501, blob: new Blob(["encoded"], { type: "image/png" }) });
const input = () => host.querySelector<HTMLInputElement>('input[type="file"]')!;
const action = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function select() { Object.defineProperty(input(), "files", { configurable: true, value: [new File([bytes], "PRIVATE.pdf")] }); await act(async () => input().dispatchEvent(new Event("change", { bubbles: true }))); }
async function edit(id: string, value: string) {
    const element = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    await act(async () => { const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLInputElement ? "input" : "change", { bubbles: true })); });
}
async function reset() { await act(async () => [...host.querySelectorAll("button")].find(value => value.textContent === "Reset")!.click()); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(async () => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revokeUrl }); let index = 0; createUrl.mockImplementation(() => `blob:result-${++index}`);
    work.inspect.mockResolvedValue(inspected); work.convert.mockImplementation(async (_bytes, page: number[]) => page.map(value => output(value)));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(createElement(PdfToImageTool, { toolId: "pdf-to-image", setQuery })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("initializes explicit page 1, PNG/150 DPI and JPEG-only default quality", async () => {
    expect(action().disabled).toBe(true); await select(); expect(host.querySelector<HTMLInputElement>('#pdf-image-pages')!.value).toBe("1"); expect(action().disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>('#pdf-image-format')!.value).toBe("png"); expect(host.querySelector<HTMLSelectElement>('#pdf-image-dpi')!.value).toBe("150"); expect([...host.querySelectorAll('#pdf-image-dpi option')].map(value => value.getAttribute("value"))).toEqual(["72", "150", "300"]);
    expect(host.querySelector('#pdf-image-quality')).toBeNull(); await edit('pdf-image-format', 'jpeg'); expect(host.querySelector<HTMLInputElement>('#pdf-image-quality')!.value).toBe("0.85"); await edit('pdf-image-quality', '0.49'); expect(action().disabled).toBe(true); expect(host.querySelector('#pdf-image-quality-help')!.getAttribute('role')).toBe('alert'); await edit('pdf-image-format', 'png'); expect(action().disabled).toBe(false);
});
it("uses actual parser sequence/cap and exposes ordered page downloads only after conversion", async () => {
    await select(); for (const expression of ["31", "1-21", "1--3", ""]) { await edit('pdf-image-pages', expression); expect(action().disabled).toBe(true); expect(host.querySelector('[role="alert"]')).not.toBeNull(); }
    await edit('pdf-image-pages', '3,1,3'); await submit(); expect(work.convert.mock.calls[0][1]).toEqual([3, 1]); expect(work.convert.mock.calls[0][2]).toEqual({ format: "png", dpi: 150, quality: .85 });
    expect([...host.querySelectorAll('a')].map(value => value.download)).toEqual(['PRIVATE-page-003.png', 'PRIVATE-page-001.png']); expect(host.querySelector('li')!.textContent).toContain('Page 3'); expect(document.activeElement?.textContent).toBe('Page images ready');
    expect(work.track.mock.calls).toEqual([['tool_executed', { toolId: 'pdf-to-image', slug: 'pdf-to-image' }]]); expect(setQuery).not.toHaveBeenCalled();
});
it.each(['pages', 'format', 'dpi', 'quality', 'source', 'reset', 'unmount', 'new-conversion'])('revokes every prior result on %s', async mutation => {
    await select(); if (mutation === 'quality') await edit('pdf-image-format', 'jpeg'); await edit('pdf-image-pages', '3,1'); await submit();
    if (mutation === 'pages') await edit('pdf-image-pages', '2'); else if (mutation === 'format') await edit('pdf-image-format', 'jpeg'); else if (mutation === 'dpi') await edit('pdf-image-dpi', '72'); else if (mutation === 'quality') await edit('pdf-image-quality', '0.5'); else if (mutation === 'source') await select(); else if (mutation === 'reset') await reset(); else if (mutation === 'unmount') await act(async () => root.unmount()); else await submit();
    expect(revokeUrl).toHaveBeenCalledTimes(2); if (mutation !== 'new-conversion') expect(host.querySelectorAll('a')).toHaveLength(0);
});
it("keeps results for unchanged settings and resets all defaults with source focus", async () => {
    await select(); await submit(); await edit('pdf-image-format', 'png'); await edit('pdf-image-dpi', '150'); expect(revokeUrl).not.toHaveBeenCalled(); expect(host.querySelectorAll('a')).toHaveLength(1);
    await edit('pdf-image-format', 'jpeg'); await edit('pdf-image-quality', '0.5'); await edit('pdf-image-dpi', '300'); await reset(); expect(document.activeElement).toBe(input()); expect(action().disabled).toBe(true); expect(host.querySelector<HTMLInputElement>('#pdf-image-pages')!.value).toBe(''); expect(host.querySelector<HTMLSelectElement>('#pdf-image-format')!.value).toBe('png'); expect(host.querySelector<HTMLSelectElement>('#pdf-image-dpi')!.value).toBe('150'); await select(); await edit('pdf-image-format', 'jpeg'); expect(host.querySelector<HTMLInputElement>('#pdf-image-quality')!.value).toBe('0.85');
});
it.each(['settings', 'source', 'reset', 'unmount'])('aborts pending conversion and ignores stale success on %s', async mutation => {
    await select(); let done!: (value: PdfToImageOutput[]) => void; work.convert.mockReturnValueOnce(new Promise(resolve => { done = resolve; })); await submit(); expect(action().disabled).toBe(true); expect(host.querySelector('[role="status"]')!.textContent).toContain('Rendering'); const signal = work.convert.mock.calls[0][3] as AbortSignal;
    if (mutation === 'settings') await edit('pdf-image-dpi', '72'); else if (mutation === 'source') await select(); else if (mutation === 'reset') await reset(); else await act(async () => root.unmount()); expect(signal.aborted).toBe(true); await act(async () => done([output()])); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled(); expect(host.querySelector('[role="alert"]')).toBeNull();
});
it("aborts inspection on Reset and ignores its late source", async () => {
    let done!: (value: typeof inspected) => void; work.inspect.mockReturnValueOnce(new Promise(resolve => { done = resolve; })); await select(); const signal = work.inspect.mock.calls[0][1] as AbortSignal; expect(host.querySelector('[role="status"]')!.textContent).toContain('Inspecting'); await reset(); expect(signal.aborted).toBe(true); await act(async () => done(inspected)); expect(action().disabled).toBe(true);
});
it.each(['render-limit', 'runtime', 'encoding', 'verification'])('announces bounded %s failure without partial URLs or telemetry', async category => {
    await select(); work.convert.mockRejectedValueOnce(category === 'encoding' || category === 'verification' ? new PdfToImageError(category) : new PdfFileError(category as 'render-limit' | 'runtime')); await submit(); expect(createUrl).not.toHaveBeenCalled(); expect(work.track).not.toHaveBeenCalled(); const alert = host.querySelector('[role="alert"]')!; expect(document.activeElement).toBe(alert); if (category === 'render-limit') expect(alert.textContent).toContain('lower DPI');
});
it.each(['encrypted', 'malformed'] as const)('announces inherited %s source rejection', async category => {
    work.inspect.mockRejectedValueOnce(new PdfFileError(category)); await select(); expect(action().disabled).toBe(true); expect(document.activeElement).toBe(host.querySelector('[role="alert"]')); expect(work.track).not.toHaveBeenCalled();
});
