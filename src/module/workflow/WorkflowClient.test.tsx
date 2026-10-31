/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectWorkflowSource, runWorkflow } from "./runner.client";
import { WorkflowClient } from "./WorkflowClient";
import type { WorkflowRunOption, WorkflowRunResult } from "./type";

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

const SOURCE_FACT = { format: "png" as const, width: 400, height: 300, sizeBytes: 1234 };
const GOOD_RESULT: WorkflowRunResult = {
    ok: true,
    slug: "prepare-image-for-upload",
    outputs: [{ name: "photo-prepared.jpg", mimeType: "image/jpeg", blob: new Blob(["x"], { type: "image/jpeg" }), sizeBytes: 900, width: 400, height: 300 }],
    checks: [{ name: "Output format", expected: "image/jpeg", observed: "image/jpeg", passed: true }],
};
const UNMET_RESULT: WorkflowRunResult = {
    ok: false,
    slug: "prepare-image-for-upload",
    outputs: [],
    failure: {
        code: "UNMET_REQUIREMENT",
        stage: "compress",
        message: "No JPEG output within 10 bytes was found.",
        unmetChecks: [{ name: "Output size in bytes", expected: "at most 10", observed: 4321, passed: false }],
    },
};

async function render() { await act(async () => root.render(<WorkflowClient slug="prepare-image-for-upload" />)); }
const byId = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
const processButton = () => [...host.querySelectorAll("button")].find(button => /Process image|Processing/.test(button.textContent ?? ""))!;
const buttonNamed = (name: string) => [...host.querySelectorAll("button")].find(button => button.textContent === name);

async function chooseFile() {
    const input = byId<HTMLInputElement>("workflow-source");
    Object.defineProperty(input, "files", { value: [new File(["png"], "photo.png", { type: "image/png" })], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function typeInto(id: string, value: string) {
    const input = byId<HTMLInputElement>(id);
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function process() { await act(async () => { processButton().click(); }); }

beforeEach(() => {
    vi.clearAllMocks();
    urlCounter = 0;
    createObjectURL.mockImplementation(() => `blob:test-${++urlCounter}`);
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(inspectWorkflowSource).mockResolvedValue({ ok: true, source: SOURCE_FACT });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe("WorkflowClient before Process", () => {
    it("shows editable illustrative defaults, a bytes label, all stages pending and no claim of execution", async () => {
        await render();
        expect(byId<HTMLInputElement>("workflow-max-width").value).toBe("800");
        expect(byId<HTMLInputElement>("workflow-max-height").value).toBe("600");
        expect(byId<HTMLInputElement>("workflow-max-bytes").value).toBe("100000");
        expect(host.textContent).toContain("Maximum file size (bytes)");
        expect(host.textContent).toContain("examples, not a rule that every site accepts");
        const stage = [...host.querySelectorAll("[data-stage]")];
        expect(stage.map(item => item.getAttribute("data-stage"))).toEqual(["validate", "inspect", "convert", "resize", "compress", "verify", "complete"]);
        expect(stage.every(item => item.getAttribute("data-state") === "pending")).toBe(true);
        expect(host.querySelector("[data-workflow-status]")!.textContent).toContain("Nothing has run yet");
        expect(processButton().disabled).toBe(true);
        expect(runWorkflow).not.toHaveBeenCalled();
    });

    it("shows only public source facts once the file is inspected and enables Process", async () => {
        await render();
        await chooseFile();
        expect(host.querySelector("[data-workflow-source]")!.textContent).toBe("photo.png: PNG, 400 x 300 px, 1,234 bytes");
        expect(processButton().disabled).toBe(false);
    });

    it("shows the inspection failure as an alert and keeps Process disabled", async () => {
        vi.mocked(inspectWorkflowSource).mockResolvedValue({ ok: false, code: "UNSUPPORTED_FORMAT", message: "This file is not valid JPEG, PNG, or WebP image content." });
        await render();
        await chooseFile();
        expect(host.querySelector('[role="alert"]')!.textContent).toContain("not valid JPEG, PNG, or WebP");
        expect(processButton().disabled).toBe(true);
    });

    it("blocks the run with field errors for blank, fractional and zero values", async () => {
        await render();
        await chooseFile();
        await typeInto("workflow-max-bytes", "");
        await typeInto("workflow-max-width", "12.5");
        await typeInto("workflow-max-height", "0");
        await process();
        expect(runWorkflow).not.toHaveBeenCalled();
        expect(byId("workflow-max-bytes-error").textContent).toContain("Enter a maximum file size in bytes");
        expect(byId("workflow-max-width-error").textContent).toContain("digits only");
        expect(byId("workflow-max-height-error").textContent).toContain("positive whole number");
        expect(byId("workflow-max-width").getAttribute("aria-invalid")).toBe("true");
    });
});

describe("WorkflowClient run lifecycle", () => {
    it("starts exactly one run for repeated activation, shows live progress and a Cancel action", async () => {
        const pending = defer<WorkflowRunResult>();
        let captured: WorkflowRunOption | undefined;
        vi.mocked(runWorkflow).mockImplementation((_request, option) => { captured = option; return pending.promise; });
        await render();
        await chooseFile();
        await process();
        await process();
        await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
        expect(runWorkflow).toHaveBeenCalledOnce();
        expect(processButton().disabled).toBe(true);
        expect(buttonNamed("Cancel")).toBeDefined();
        await act(async () => captured!.onProgress!({ stage: "convert", state: "running", completed: 2, total: 7, description: "Converting PNG to JPEG" }));
        expect(host.querySelector("[data-workflow-status]")!.textContent).toContain("Convert: Converting PNG to JPEG (2 of 7 stages finished)");
        expect(host.querySelector('[data-stage="convert"]')!.getAttribute("data-state")).toBe("running");
        expect(host.querySelector('[data-stage="convert"]')!.getAttribute("aria-current")).toBe("step");
        expect(host.querySelector('[data-stage="compress"]')!.getAttribute("data-state")).toBe("pending");
        await act(async () => pending.resolve(UNMET_RESULT));
    });

    it("sends the parsed whole-number requirement and the selected format to the runner", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(GOOD_RESULT);
        await render();
        await chooseFile();
        await typeInto("workflow-max-bytes", " 54321 ");
        await act(async () => { const select = byId<HTMLSelectElement>("workflow-format"); select.value = "webp"; select.dispatchEvent(new Event("change", { bubbles: true })); });
        await process();
        const request = vi.mocked(runWorkflow).mock.calls[0][0];
        expect(request).toMatchObject({ slug: "prepare-image-for-upload", targetFormat: "webp", maxWidth: 800, maxHeight: 600, maxBytes: 54321 });
    });

    it("offers one download link and the observed checks after a verified success", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(GOOD_RESULT);
        await render();
        await chooseFile();
        await process();
        const link = host.querySelector<HTMLAnchorElement>("[data-workflow-download]")!;
        expect(host.querySelectorAll("[data-workflow-download]")).toHaveLength(1);
        expect(link.getAttribute("href")).toBe("blob:test-1");
        expect(link.getAttribute("download")).toBe("photo-prepared.jpg");
        expect(host.querySelector("[data-workflow-check-list]")!.textContent).toContain("Passed: Output format");
        expect(host.querySelector("[data-workflow-prepared]")!.textContent).toContain("400 x 300 px");
        expect(host.querySelector("[data-workflow-failure]")).toBeNull();
    });

    it("shows specific unmet checks and no download after an unmet requirement", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(UNMET_RESULT);
        await render();
        await chooseFile();
        await process();
        const alert = host.querySelector('[data-workflow-failure="UNMET_REQUIREMENT"]')!;
        expect(alert.getAttribute("role")).toBe("alert");
        expect(alert.textContent).toContain("Failed: Output size in bytes. Expected at most 10, observed 4321.");
        expect(alert.textContent).toContain("No file is offered for download.");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("aborts the run signal on Cancel and ends as cancelled with no download", async () => {
        vi.mocked(runWorkflow).mockImplementation((_request, option) => new Promise<WorkflowRunResult>(done => {
            option.signal.addEventListener("abort", () => done({ ok: false, slug: "prepare-image-for-upload", outputs: [], failure: { code: "CANCELLED", stage: "convert", message: "The run was cancelled. No file was produced." } }));
        }));
        await render();
        await chooseFile();
        await process();
        await act(async () => { buttonNamed("Cancel")!.click(); });
        expect(host.querySelector("[data-workflow-cancelled]")).not.toBeNull();
        expect(host.querySelector("[data-workflow-status]")!.textContent).toContain("Cancelled");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(buttonNamed("Cancel")).toBeUndefined();
        expect(processButton().disabled).toBe(false);
    });

    it("allows a retry after a cancel and starts a second, independent run", async () => {
        vi.mocked(runWorkflow)
            .mockImplementationOnce((_request, option) => new Promise<WorkflowRunResult>(done => {
                option.signal.addEventListener("abort", () => done({ ok: false, slug: "prepare-image-for-upload", outputs: [], failure: { code: "CANCELLED", stage: "validate", message: "cancelled" } }));
            }))
            .mockResolvedValueOnce(GOOD_RESULT);
        await render();
        await chooseFile();
        await process();
        await act(async () => { buttonNamed("Cancel")!.click(); });
        await process();
        expect(runWorkflow).toHaveBeenCalledTimes(2);
        expect(host.querySelector("[data-workflow-download]")).not.toBeNull();
    });
});

describe("WorkflowClient invalidation and cleanup", () => {
    it("revokes the result URL and clears the output when a requirement is edited", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(GOOD_RESULT);
        await render();
        await chooseFile();
        await process();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        await typeInto("workflow-max-width", "700");
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:test-1");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(host.querySelector("[data-workflow-status]")!.textContent).toContain("Nothing has run yet");
        expect([...host.querySelectorAll("[data-stage]")].every(item => item.getAttribute("data-state") === "pending")).toBe(true);
    });

    it("revokes the previous URL when a new file is chosen and when the form is reset", async () => {
        vi.mocked(runWorkflow).mockResolvedValue(GOOD_RESULT);
        await render();
        await chooseFile();
        await process();
        await chooseFile();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
        await process();
        expect(host.querySelector("[data-workflow-download]")!.getAttribute("href")).toBe("blob:test-2");
        await act(async () => { buttonNamed("Reset")!.click(); });
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-2");
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(byId<HTMLInputElement>("workflow-max-bytes").value).toBe("100000");
    });

    it("ignores a success that races Cancel: no result, no URL, cancelled state", async () => {
        const pending = defer<WorkflowRunResult>();
        let captured: WorkflowRunOption | undefined;
        vi.mocked(runWorkflow).mockImplementation((_request, option) => { captured = option; return pending.promise; });
        await render();
        await chooseFile();
        await process();
        await act(async () => { buttonNamed("Cancel")!.click(); });
        expect(captured!.signal.aborted).toBe(true);
        await act(async () => pending.resolve(GOOD_RESULT));
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(host.querySelector("[data-workflow-cancelled]")).not.toBeNull();
        expect(processButton().disabled).toBe(false);
    });

    it("never shows a result from a superseded run", async () => {
        const first = defer<WorkflowRunResult>();
        let firstOption: WorkflowRunOption | undefined;
        vi.mocked(runWorkflow).mockImplementationOnce((_request, option) => { firstOption = option; return first.promise; });
        await render();
        await chooseFile();
        await process();
        await chooseFile();
        expect(firstOption!.signal.aborted).toBe(true);
        await act(async () => first.resolve(GOOD_RESULT));
        await act(async () => firstOption!.onProgress!({ stage: "verify", state: "running", completed: 5, total: 7, description: "late" }));
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(host.querySelector("[data-workflow-download]")).toBeNull();
        expect(host.querySelector("[data-workflow-status]")!.textContent).toContain("Nothing has run yet");
    });

    it("aborts an in-flight run and revokes the live URL on unmount", async () => {
        vi.mocked(runWorkflow).mockResolvedValueOnce(GOOD_RESULT);
        await render();
        await chooseFile();
        await process();
        await act(async () => root.unmount());
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
        root = createRoot(host);

        const pending = defer<WorkflowRunResult>();
        let option: WorkflowRunOption | undefined;
        vi.mocked(runWorkflow).mockImplementationOnce((_request, runOption) => { option = runOption; return pending.promise; });
        await render();
        await chooseFile();
        await process();
        await act(async () => root.unmount());
        expect(option!.signal.aborted).toBe(true);
        await act(async () => pending.resolve(GOOD_RESULT));
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        root = createRoot(host);
    });
});
