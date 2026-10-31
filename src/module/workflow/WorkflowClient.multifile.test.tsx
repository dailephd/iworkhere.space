/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectWorkflowSource, runWorkflow } from "./runner.client";
import { WorkflowClient } from "./WorkflowClient";
import type { WorkflowRequest, WorkflowRunOption, WorkflowRunResult, WorkflowSlug } from "./type";

vi.mock("./runner.client", () => ({ inspectWorkflowSource: vi.fn(), runWorkflow: vi.fn() }));

let host: HTMLDivElement;
let root: Root;
let urlCounter = 0;
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void }
function defer<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

async function render(slug: WorkflowSlug) { await act(async () => root.render(<WorkflowClient slug={slug} />)); }
const byId = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
const buttons = () => [...host.querySelectorAll("button")];
const buttonNamed = (name: string) => buttons().find(button => button.textContent === name || button.getAttribute("aria-label") === name);
const processButton = (label: string) => buttons().find(button => button.textContent === label || button.textContent === "Processing...")!;
const statusText = () => host.querySelector("[data-workflow-status]")?.textContent ?? "";
const hint = () => host.querySelector("[data-workflow-hint]")?.textContent ?? "";
const click = async (button: HTMLElement | undefined) => { await act(async () => { button!.click(); }); };

async function pickFiles(id: string, files: File[]) {
    const input = byId<HTMLInputElement>(id);
    Object.defineProperty(input, "files", { value: files, configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function typeInto(id: string, value: string) {
    const input = byId<HTMLInputElement>(id);
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function choose(id: string, value: string) {
    const select = byId<HTMLSelectElement>(id);
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

const file = (name: string, type = "", size = 10) => new File([new Uint8Array(size)], name, { type });
const withSize = (value: File, size: number) => { Object.defineProperty(value, "size", { value: size }); return value; };

function lastRequest<S extends WorkflowSlug>(slug: S): Extract<WorkflowRequest, { slug: S }> {
    const call = vi.mocked(runWorkflow).mock.calls.at(-1);
    expect(call?.[0].slug).toBe(slug);
    return call![0] as Extract<WorkflowRequest, { slug: S }>;
}
const lastOption = (): WorkflowRunOption => vi.mocked(runWorkflow).mock.calls.at(-1)![1];

function pdfResult(slug: "heic-photos-to-pdf" | "assemble-pdf-packet", name: string): WorkflowRunResult {
    return {
        ok: true,
        slug,
        outputs: [{ name, mimeType: "application/pdf", blob: new Blob(["%PDF-"], { type: "application/pdf" }), sizeBytes: 5 }],
        checks: [{ name: "Page count", expected: 2, observed: 2, passed: true }],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    urlCounter = 0;
    createObjectURL.mockImplementation(() => `blob:multi-${++urlCounter}`);
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe("HEIC photos to PDF client", () => {
    it("starts empty: nothing runs, Process is disabled with a reason, every stage is pending", async () => {
        await render("heic-photos-to-pdf");
        expect(runWorkflow).not.toHaveBeenCalled();
        expect(inspectWorkflowSource).not.toHaveBeenCalled();
        expect(processButton("Create PDF").disabled).toBe(true);
        expect(hint()).toContain("Add at least one HEIC photo");
        expect(processButton("Create PDF").getAttribute("aria-describedby")).toBe("workflow-process-hint");
        expect(statusText()).toContain("Nothing has run yet");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(host.querySelector("[data-workflow-empty]")?.textContent).toBe("No photos yet.");
        expect(host.textContent).toContain("Everything happens in your browser");
    });

    it("labels every control and shows the quality slider only for JPEG", async () => {
        await render("heic-photos-to-pdf");
        for (const id of ["heic-photos", "heic-format", "heic-quality"]) {
            expect(host.querySelector(`label[for="${id}"]`), id).not.toBeNull();
        }
        expect(byId<HTMLInputElement>("heic-photos").multiple).toBe(true);
        expect(byId<HTMLInputElement>("heic-quality").min).toBe("10");
        expect(byId<HTMLInputElement>("heic-quality").step).toBe("5");
        expect(host.querySelector('label[for="heic-quality"]')?.textContent).toBe("JPEG quality: 90%");
        await choose("heic-format", "png");
        expect(host.querySelector("#heic-quality")).toBeNull();
        expect(host.textContent).toContain("no quality setting");
    });

    it("keeps the chosen order, supports move and remove, and runs once with the exact order", async () => {
        const done = defer<WorkflowRunResult>();
        vi.mocked(runWorkflow).mockReturnValue(done.promise);
        await render("heic-photos-to-pdf");
        const [a, b, c] = [file("a.heic"), file("b.heic"), file("c.heic")];
        await pickFiles("heic-photos", [a, b]);
        await pickFiles("heic-photos", [c]);
        const items = () => [...host.querySelectorAll("[data-workflow-list] li p")].map(node => node.textContent);
        expect(items().map(text => text?.split(" (")[0])).toEqual(["Page 1: a.heic", "Page 2: b.heic", "Page 3: c.heic"]);

        await click(buttonNamed("Move photo 3, c.heic, up"));
        await click(buttonNamed("Move photo 1, a.heic, down"));
        await click(buttonNamed("Remove photo 2, a.heic"));
        expect(items().map(text => text?.split(" (")[0])).toEqual(["Page 1: c.heic", "Page 2: b.heic"]);
        expect(buttonNamed("Move photo 1, c.heic, up")?.hasAttribute("disabled")).toBe(true);
        expect(buttonNamed("Move photo 2, b.heic, down")?.hasAttribute("disabled")).toBe(true);

        await typeInto("heic-quality", "70");
        await click(processButton("Create PDF"));
        expect(runWorkflow).toHaveBeenCalledTimes(1);
        expect(lastRequest("heic-photos-to-pdf")).toEqual({ slug: "heic-photos-to-pdf", sourcesInPageOrder: [c, b], intermediateFormat: "jpeg", quality: 70 });
        done.resolve(pdfResult("heic-photos-to-pdf", "heic-photos.pdf"));
    });

    it("sends the slider value for JPEG and the PNG choice without a changed quality", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(pdfResult("heic-photos-to-pdf", "heic-photos.pdf"));
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic")]);
        await typeInto("heic-quality", "65");
        await click(processButton("Create PDF"));
        expect(lastRequest("heic-photos-to-pdf")).toMatchObject({ intermediateFormat: "jpeg", quality: 65 });
        await choose("heic-format", "png");
        await click(processButton("Create PDF"));
        expect(lastRequest("heic-photos-to-pdf")).toMatchObject({ intermediateFormat: "png" });
    });

    it("limits the list to 20 photos and says how many were not added", async () => {
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", Array.from({ length: 22 }, (_, index) => file(`p${index}.heic`)));
        expect(host.querySelectorAll("[data-workflow-list] li")).toHaveLength(20);
        const alert = host.querySelector('[role="alert"]');
        expect(alert?.textContent).toContain("at most 20 photos");
        expect(alert?.textContent).toContain("2 photos were not added");
    });

    it("blocks Process with an alert for an oversize photo, an empty photo and an aggregate over 25 MiB", async () => {
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [withSize(file("big.heic"), 26_214_401)]);
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("at most 25 MiB");
        expect(processButton("Create PDF").disabled).toBe(true);
        await click(buttonNamed("Remove photo 1, big.heic"));
        await pickFiles("heic-photos", [new File([], "empty.heic")]);
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("is empty");
        await click(buttonNamed("Remove photo 1, empty.heic"));
        await pickFiles("heic-photos", [withSize(file("one.heic"), 14_000_000), withSize(file("two.heic"), 14_000_000)]);
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("All photos together can be at most 25 MiB");
        expect(processButton("Create PDF").disabled).toBe(true);
        expect(runWorkflow).not.toHaveBeenCalled();
    });

    it("shows live progress, one Cancel, and a single download link only after a verified success", async () => {
        const done = defer<WorkflowRunResult>();
        vi.mocked(runWorkflow).mockReturnValue(done.promise);
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic"), file("b.heic")]);
        await click(processButton("Create PDF"));

        expect(processButton("Create PDF").disabled).toBe(true);
        expect(buttonNamed("Cancel")).toBeDefined();
        expect(buttonNamed("Reset")?.hasAttribute("disabled")).toBe(true);
        expect(byId<HTMLInputElement>("heic-photos").disabled).toBe(true);
        await act(async () => { lastOption().onProgress?.({ stage: "convert", state: "running", completed: 2, total: 6, description: "Converting photo 2 of 2 to JPEG" }); });
        expect(statusText()).toContain("Convert: Converting photo 2 of 2 to JPEG (2 of 6 stages finished)");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();

        await act(async () => { done.resolve(pdfResult("heic-photos-to-pdf", "heic-photos.pdf")); });
        const link = host.querySelector<HTMLAnchorElement>("[data-workflow-download]")!;
        expect(link.getAttribute("href")).toBe("blob:multi-1");
        expect(link.getAttribute("download")).toBe("heic-photos.pdf");
        expect(host.querySelectorAll("[data-workflow-download]")).toHaveLength(1);
        expect(host.querySelector("[data-workflow-output]")?.textContent).toContain("heic-photos.pdf: 2 pages, 5 bytes");
        expect(statusText()).toBe("Done. The file passed 1 check.");
        expect(buttons().filter(button => button.textContent === "Create PDF")).toHaveLength(1);
    });

    it("revokes the download URL and removes the result when the inputs change or the form resets", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(pdfResult("heic-photos-to-pdf", "heic-photos.pdf"));
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic")]);
        await click(processButton("Create PDF"));
        expect(host.querySelector("[data-workflow-download]")).not.toBeNull();

        await pickFiles("heic-photos", [file("b.heic")]);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:multi-1");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(statusText()).toContain("Nothing has run yet");

        await click(processButton("Create PDF"));
        expect(host.querySelector("[data-workflow-download]")).not.toBeNull();
        await click(buttonNamed("Reset"));
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:multi-2");
        expect(host.querySelector("[data-workflow-empty]")).not.toBeNull();
        expect(processButton("Create PDF").disabled).toBe(true);
    });

    it("shows a typed failure as an alert with the stage and reason, and offers no download", async () => {
        vi.mocked(runWorkflow).mockResolvedValue({ ok: false, slug: "heic-photos-to-pdf", outputs: [], failure: { code: "UNSUPPORTED_FORMAT", stage: "convert", message: "Photo 2: not valid HEIC", sourceId: "photo-2" } });
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic"), file("b.heic")]);
        await click(processButton("Create PDF"));
        const alert = host.querySelector('[data-workflow-failure="UNSUPPORTED_FORMAT"]')!;
        expect(alert.getAttribute("role")).toBe("alert");
        expect(alert.textContent).toContain("Photo 2: not valid HEIC");
        expect(alert.textContent).toContain("Stopped at: Convert. Reason: UNSUPPORTED_FORMAT.");
        expect(alert.textContent).toContain("No file is offered for download.");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(urlCounter).toBe(0);
        expect(statusText()).toBe("The run stopped without producing a file.");
    });

    it("cancel aborts the run and a result that arrives afterwards is never shown or given a URL", async () => {
        const done = defer<WorkflowRunResult>();
        vi.mocked(runWorkflow).mockReturnValue(done.promise);
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic")]);
        await click(processButton("Create PDF"));
        const signal = lastOption().signal;
        await click(buttonNamed("Cancel"));
        expect(signal.aborted).toBe(true);
        await act(async () => { done.resolve(pdfResult("heic-photos-to-pdf", "heic-photos.pdf")); });
        expect(host.querySelector("[data-workflow-cancelled]")).not.toBeNull();
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(urlCounter).toBe(0);
        expect(statusText()).toBe("Cancelled. No file was produced.");
        expect(processButton("Create PDF").disabled).toBe(false);
    });

    it("reset during a run is blocked, and unmount aborts the run and creates no URL for a late result", async () => {
        const done = defer<WorkflowRunResult>();
        vi.mocked(runWorkflow).mockReturnValue(done.promise);
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic")]);
        await click(processButton("Create PDF"));
        const signal = lastOption().signal;
        await act(async () => root.unmount());
        expect(signal.aborted).toBe(true);
        done.resolve(pdfResult("heic-photos-to-pdf", "heic-photos.pdf"));
        await act(async () => { await done.promise; });
        expect(urlCounter).toBe(0);
        root = createRoot(host);
    });

    it("ignores a repeated submit while a run is in flight", async () => {
        vi.mocked(runWorkflow).mockReturnValue(defer<WorkflowRunResult>().promise);
        await render("heic-photos-to-pdf");
        await pickFiles("heic-photos", [file("a.heic")]);
        await click(processButton("Create PDF"));
        const form = host.querySelector("form")!;
        await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
        expect(runWorkflow).toHaveBeenCalledTimes(1);
    });
});

describe("PDF packet client", () => {
    const pdfA = () => file("a.pdf", "application/pdf");
    const pdfB = () => file("b.pdf", "application/pdf");
    const png = () => file("scan.png", "image/png");

    it("explains what is missing until files and pages exist, and never runs on its own", async () => {
        await render("assemble-pdf-packet");
        expect(runWorkflow).not.toHaveBeenCalled();
        expect(processButton("Assemble packet").disabled).toBe(true);
        expect(hint()).toContain("Add at least one PDF or image");
        await pickFiles("packet-files", [pdfA()]);
        expect(hint()).toContain("Add at least one page");
        expect(processButton("Assemble packet").disabled).toBe(true);
        for (const id of ["packet-files", "packet-add-source", "packet-add-pages", "packet-compress"]) {
            expect(host.querySelector(`label[for="${id}"]`), id).not.toBeNull();
        }
    });

    it("rejects files that are not PDF, JPEG or PNG with a visible alert and keeps the others", async () => {
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", [file("notes.txt", "text/plain"), pdfA(), file("pic.webp", "image/webp")]);
        const alert = host.querySelector('[role="alert"]')!;
        expect(alert.textContent).toContain("notes.txt");
        expect(alert.textContent).toContain("pic.webp");
        expect(host.querySelectorAll("[data-workflow-source-list] li")).toHaveLength(1);
    });

    it("builds stable ids independent of file names and lists pages in the exact order, repeats included", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(pdfResult("assemble-pdf-packet", "assembled-packet.pdf"));
        await render("assemble-pdf-packet");
        const [a, b, image] = [pdfA(), pdfB(), png()];
        await pickFiles("packet-files", [a, b, image]);

        await choose("packet-add-source", "source-2");
        await typeInto("packet-add-pages", "3, 1-2");
        await click(buttonNamed("Add page"));
        await choose("packet-add-source", "source-3");
        await click(buttonNamed("Add page"));
        await choose("packet-add-source", "source-2");
        await typeInto("packet-add-pages", "3");
        await click(buttonNamed("Add page"));

        const entries = () => [...host.querySelectorAll("[data-workflow-list] li p")].map(node => node.textContent);
        expect(entries()).toEqual([
            "Packet page 1: source 2, page 3", "Packet page 2: source 2, page 1", "Packet page 3: source 2, page 2",
            "Packet page 4: source 3, page 1", "Packet page 5: source 2, page 3",
        ]);
        await click(buttonNamed("Move packet page 5 up"));
        await click(buttonNamed("Remove packet page 1"));
        expect(entries().map(text => text?.split(": ")[1])).toEqual(["source 2, page 1", "source 2, page 2", "source 2, page 3", "source 3, page 1"]);

        await click(host.querySelector<HTMLInputElement>("#packet-compress")!);
        await click(processButton("Assemble packet"));
        const request = lastRequest("assemble-pdf-packet");
        expect(request.sources).toEqual([
            { id: "source-1", kind: "pdf", file: a }, { id: "source-2", kind: "pdf", file: b }, { id: "source-3", kind: "png", file: image },
        ]);
        expect(request.pageOrder).toEqual([
            { sourceId: "source-2", pageNumber: 1 }, { sourceId: "source-2", pageNumber: 2 },
            { sourceId: "source-2", pageNumber: 3 }, { sourceId: "source-3", pageNumber: 1 },
        ]);
        expect(request.tryLosslessCompression).toBe(true);
    });

    it("explains an invalid page expression next to the field and adds nothing", async () => {
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", [pdfA()]);
        await typeInto("packet-add-pages", "two");
        await click(buttonNamed("Add page"));
        expect(byId("packet-add-pages").getAttribute("aria-invalid")).toBe("true");
        expect(byId("packet-add-pages").getAttribute("aria-describedby")).toBe("packet-add-error");
        expect(byId("packet-add-error").textContent).toContain("page numbers and ranges");
        expect(host.querySelector("[data-workflow-list]")).toBeNull();
        await typeInto("packet-add-pages", "5-2");
        await click(buttonNamed("Add page"));
        expect(byId("packet-add-error").textContent).toContain("lower page to a higher page");
        await typeInto("packet-add-pages", "0");
        await click(buttonNamed("Add page"));
        expect(byId("packet-add-error").textContent).toContain("start at 1");
        await typeInto("packet-add-pages", "1-101");
        await click(buttonNamed("Add page"));
        expect(byId("packet-add-error").textContent).toContain("at most 100 pages");
    });

    it("adds an image as page 1 with no page field and removing a file removes its pages", async () => {
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", [png(), pdfA()]);
        expect(host.querySelector("#packet-add-pages")).toBeNull();
        expect(host.textContent).toContain("An image is one page");
        await click(buttonNamed("Add page"));
        await choose("packet-add-source", "source-2");
        await typeInto("packet-add-pages", "1,2");
        await click(buttonNamed("Add page"));
        expect(host.querySelectorAll("[data-workflow-list] li")).toHaveLength(3);
        await click(buttonNamed("Remove source 2, a.pdf"));
        expect(host.querySelectorAll("[data-workflow-list] li")).toHaveLength(1);
        expect(processButton("Assemble packet").disabled).toBe(false);
    });

    it("blocks Process when the file counts or total size exceed the limits", async () => {
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", Array.from({ length: 11 }, (_, index) => file(`p${index}.pdf`, "application/pdf")));
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("at most 10 PDFs");
        expect(processButton("Assemble packet").disabled).toBe(true);
        await click(buttonNamed("Reset"));
        await pickFiles("packet-files", Array.from({ length: 21 }, (_, index) => file(`i${index}.png`, "image/png")));
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("at most 20 images");
        await click(buttonNamed("Reset"));
        await pickFiles("packet-files", [0, 1, 2].map(index => withSize(file(`big${index}.pdf`, "application/pdf"), 9_000_000)));
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("at most 25 MiB");
    });

    it("limits the packet to 100 pages", async () => {
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", [pdfA()]);
        await typeInto("packet-add-pages", "1-60");
        await click(buttonNamed("Add page"));
        await click(buttonNamed("Add page"));
        expect(byId("packet-add-error").textContent).toContain("You can add 40 more");
        expect(host.querySelectorAll("[data-workflow-list] li")).toHaveLength(60);
    });

    it("shows the packet result with one download and invalidates it when the page list changes", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(pdfResult("assemble-pdf-packet", "assembled-packet.pdf"));
        await render("assemble-pdf-packet");
        await pickFiles("packet-files", [pdfA()]);
        await click(buttonNamed("Add page"));
        await click(processButton("Assemble packet"));
        const link = host.querySelector<HTMLAnchorElement>("[data-workflow-download]")!;
        expect(link.getAttribute("download")).toBe("assembled-packet.pdf");
        expect(link.textContent).toBe("Download packet");
        await click(buttonNamed("Remove packet page 1"));
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:multi-1");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
    });
});

describe("PDF pages for slides client", () => {
    const pdf = () => file("deck.pdf", "application/pdf");
    const slideResult = (pages: number[]): WorkflowRunResult => ({
        ok: true,
        slug: "pdf-pages-for-slides",
        outputs: pages.map(page => ({
            name: `deck-page-${String(page).padStart(3, "0")}.png`, mimeType: "image/png", blob: new Blob(["png"], { type: "image/png" }),
            sizeBytes: 3, sourcePageNumber: page, width: 612, height: 792,
        })),
        checks: pages.map((page, index) => ({ name: `Slide ${index + 1}: page, format and size`, expected: `page ${page}`, observed: `page ${page}`, passed: true })),
    });

    it("starts with Process disabled and a reason, with every field labelled and no JPEG quality for PNG", async () => {
        await render("pdf-pages-for-slides");
        expect(runWorkflow).not.toHaveBeenCalled();
        expect(processButton("Export slide images").disabled).toBe(true);
        expect(hint()).toContain("Choose a PDF");
        for (const id of ["slides-file", "slides-add-pages", "slides-format", "slides-dpi", "slides-bytes"]) {
            expect(host.querySelector(`label[for="${id}"]`), id).not.toBeNull();
        }
        expect(host.querySelector("#slides-quality")).toBeNull();
        await pickFiles("slides-file", [pdf()]);
        expect(hint()).toContain("Add at least one page");
    });

    it("keeps the requested order, rejects a repeated page and builds the typed request", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(slideResult([3, 1, 2, 4]));
        await render("pdf-pages-for-slides");
        const source = pdf();
        await pickFiles("slides-file", [source]);
        await typeInto("slides-add-pages", "3");
        await click(buttonNamed("Add page"));
        await typeInto("slides-add-pages", "1");
        await click(buttonNamed("Add page"));
        await typeInto("slides-add-pages", "3");
        await click(buttonNamed("Add page"));
        expect(byId("slides-add-error").textContent).toBe("Page 3 is already in the list. Each page can be exported once.");
        expect(byId("slides-add-pages").getAttribute("aria-invalid")).toBe("true");
        await typeInto("slides-add-pages", "2-4");
        await click(buttonNamed("Add page"));
        expect(byId("slides-add-error").textContent).toContain("Page 3 is already in the list");
        await typeInto("slides-add-pages", "2, 4");
        await click(buttonNamed("Add page"));

        const items = () => [...host.querySelectorAll("[data-workflow-list] li p")].map(node => node.textContent);
        expect(items()).toEqual(["Slide 1: PDF page 3", "Slide 2: PDF page 1", "Slide 3: PDF page 2", "Slide 4: PDF page 4"]);
        await click(buttonNamed("Move slide 4, page 4, up"));
        await click(buttonNamed("Remove slide 1, page 3"));
        expect(items()).toEqual(["Slide 1: PDF page 1", "Slide 2: PDF page 4", "Slide 3: PDF page 2"]);

        await choose("slides-dpi", "300");
        await click(processButton("Export slide images"));
        expect(lastRequest("pdf-pages-for-slides")).toEqual({
            slug: "pdf-pages-for-slides", source, pageNumbersInOutputOrder: [1, 4, 2], format: "png", dpi: 300, jpegQuality: 0.85,
        });
    });

    it("converts the JPEG percent to the 0.50 to 1.00 fraction and passes an optional byte limit", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(slideResult([1]));
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await click(buttonNamed("Add page"));
        await choose("slides-format", "jpeg");
        expect(byId<HTMLInputElement>("slides-quality").value).toBe("85");
        await typeInto("slides-quality", "60");
        await typeInto("slides-bytes", "250000");
        await click(processButton("Export slide images"));
        expect(lastRequest("pdf-pages-for-slides")).toMatchObject({ format: "jpeg", jpegQuality: 0.6, maxBytesPerImage: 250000 });
        await typeInto("slides-bytes", "");
        await click(processButton("Export slide images"));
        expect("maxBytesPerImage" in lastRequest("pdf-pages-for-slides")).toBe(false);
    });

    it.each([["49"], ["101"], ["eighty"], ["85.5"], [""]])("flags JPEG quality %j and keeps Process disabled", async value => {
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await click(buttonNamed("Add page"));
        await choose("slides-format", "jpeg");
        await typeInto("slides-quality", value);
        expect(byId("slides-quality-error").textContent).toContain("whole percent from 50 to 100");
        expect(byId("slides-quality").getAttribute("aria-invalid")).toBe("true");
        expect(processButton("Export slide images").disabled).toBe(true);
    });

    it.each([["abc"], ["0"], ["-5"], ["1.5"], ["99999999999999999999"]])("flags the byte limit %j", async value => {
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await click(buttonNamed("Add page"));
        await typeInto("slides-bytes", value);
        expect(byId("slides-bytes-error").textContent).toContain("positive whole number of bytes");
        expect(processButton("Export slide images").disabled).toBe(true);
    });

    it("accepts the 50 and 100 percent boundaries and caps the list at 20 pages", async () => {
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await typeInto("slides-add-pages", "1-20");
        await click(buttonNamed("Add page"));
        expect(host.querySelectorAll("[data-workflow-list] li")).toHaveLength(20);
        await typeInto("slides-add-pages", "21");
        await click(buttonNamed("Add page"));
        expect(byId("slides-add-error").textContent).toContain("at most 20 pages");
        await choose("slides-format", "jpeg");
        for (const value of ["50", "100"]) {
            await typeInto("slides-quality", value);
            expect(host.querySelector("#slides-quality-error")).toBeNull();
            expect(processButton("Export slide images").disabled).toBe(false);
        }
    });

    it("rejects a PDF over 10 MiB before running", async () => {
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [withSize(pdf(), 10 * 1024 * 1024 + 1)]);
        await click(buttonNamed("Add page"));
        expect(host.querySelector('[role="alert"]')?.textContent).toContain("maximum is 10 MiB");
        expect(processButton("Export slide images").disabled).toBe(true);
    });

    it("lists every output in the requested order with its own download link and revokes all links on reset", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(slideResult([3, 1]));
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await typeInto("slides-add-pages", "3, 1");
        await click(buttonNamed("Add page"));
        await click(processButton("Export slide images"));

        const outputs = [...host.querySelectorAll("[data-workflow-output]")];
        expect(outputs.map(node => node.querySelector("img")?.getAttribute("alt"))).toEqual(["Slide 1: PDF page 3", "Slide 2: PDF page 1"]);
        const links = [...host.querySelectorAll<HTMLAnchorElement>("[data-workflow-download]")];
        expect(links.map(link => link.getAttribute("download"))).toEqual(["deck-page-003.png", "deck-page-001.png"]);
        expect(links.map(link => link.getAttribute("href"))).toEqual(["blob:multi-1", "blob:multi-2"]);
        expect(outputs[0].textContent).toContain("page 3, 612 x 792 px, 3 bytes");
        expect(statusText()).toBe("Done. All 2 files passed 2 checks.");
        await click(buttonNamed("Reset"));
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:multi-1");
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:multi-2");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
    });

    it("shows an unmet byte limit with the failing slides and offers no image", async () => {
        vi.mocked(runWorkflow).mockResolvedValue({
            ok: false, slug: "pdf-pages-for-slides", outputs: [],
            failure: {
                code: "UNMET_REQUIREMENT", stage: "verify", message: "2 images larger than 100 bytes. No images are offered.",
                unmetChecks: [{ name: "Slide 1: size in bytes", expected: "at most 100", observed: 5000, passed: false }],
            },
        });
        await render("pdf-pages-for-slides");
        await pickFiles("slides-file", [pdf()]);
        await click(buttonNamed("Add page"));
        await click(processButton("Export slide images"));
        const alert = host.querySelector('[data-workflow-failure="UNMET_REQUIREMENT"]')!;
        expect(alert.textContent).toContain("Failed: Slide 1: size in bytes. Expected at most 100, observed 5000.");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(urlCounter).toBe(0);
    });
});

describe("workflow dispatcher", () => {
    it("keeps the one-button image workflow on its own form", async () => {
        await render("prepare-image-for-upload");
        expect(host.querySelector("#workflow-source")).not.toBeNull();
        expect(host.querySelector("#heic-photos")).toBeNull();
        expect(host.querySelector('[data-workflow="prepare-image-for-upload"]')).not.toBeNull();
    });

    it("renders exactly one form per multi-file workflow", async () => {
        for (const [slug, field] of [["heic-photos-to-pdf", "heic-photos"], ["assemble-pdf-packet", "packet-files"], ["pdf-pages-for-slides", "slides-file"]] as const) {
            await render(slug);
            expect(host.querySelectorAll("input[type=file]")).toHaveLength(1);
            expect(host.querySelector(`#${field}`)).not.toBeNull();
            expect(host.querySelector(`[data-workflow="${slug}"]`)).not.toBeNull();
        }
    });
});
