"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { StageStepper, type StageStepperItem } from "@/component/workflow/StageStepper";
import { ToolSurface, toolSurfaceClassName } from "@/component/tool/ToolSurface";
import { HeicPhotosToPdfForm } from "./HeicPhotosToPdfForm";
import { PdfPacketForm } from "./PdfPacketForm";
import { PdfPagesForSlidesForm } from "./PdfPagesForSlidesForm";
import { getWorkflow } from "./registry";
import { inspectWorkflowSource, runWorkflow } from "./runner.client";
import type {
    WorkflowArtifact,
    WorkflowCheck,
    WorkflowFailure,
    WorkflowProgress,
    WorkflowRequest,
    WorkflowSlug,
    WorkflowStageId,
    WorkflowStageState,
} from "./type";

export interface WorkflowClientProp {
    slug: WorkflowSlug;
}

/** What a form reports: the typed request when the inputs are complete and valid, or a hint saying what is missing. */
export interface WorkflowDraft {
    request: WorkflowRequest | null;
    hint: string;
}

/** Forms own fields, ordering and request construction only. Running, cancelling and output URLs stay in the client. */
export interface WorkflowFormProp {
    disabled: boolean;
    onEdit: () => void;
    onDraft: (draft: WorkflowDraft) => void;
}

type RunPhase = "idle" | "running" | "success" | "failure" | "cancelled";
type TargetFormat = "jpeg" | "png" | "webp";

interface SourceView {
    file: File;
    format: TargetFormat;
    width: number;
    height: number;
    sizeBytes: number;
}

interface ResultView {
    artifact: WorkflowArtifact;
    checkList: readonly WorkflowCheck[];
    url: string;
}

interface FieldErrorView {
    maxWidth?: string;
    maxHeight?: string;
    maxBytes?: string;
}

type StageViewMap = Partial<Record<WorkflowStageId, { state: WorkflowStageState; description: string }>>;

const STAGE_LABEL: Record<WorkflowStageId, string> = {
    validate: "Validate",
    inspect: "Inspect",
    convert: "Convert",
    resize: "Resize",
    compress: "Compress",
    "select-pages": "Select pages",
    assemble: "Assemble",
    render: "Render",
    verify: "Verify",
    complete: "Complete",
};

const FORMAT_LABEL: Record<TargetFormat, string> = { jpeg: "JPEG", png: "PNG", webp: "WebP" };
const MIME_FORMAT_LABEL: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };

/* Illustrative starting values only; they are not a site-independent upload rule. */
const DEFAULT_MAX_WIDTH = "800";
const DEFAULT_MAX_HEIGHT = "600";
const DEFAULT_MAX_BYTES = "100000";

const PENDING_DESCRIPTION = "Not started.";

/* Existing tokens only: the muted text token gives these field boundaries at least 3:1 in every appearance, including One Dark. */
const CONTROL_CLASS = "tool-control border-[var(--text-muted)]! aria-[invalid=true]:border-[var(--danger)]!";

function formatCount(value: number): string {
    return value.toLocaleString("en-US");
}

function parseWholeNumber(value: string, label: string): { value: number } | { error: string } {
    const text = value.trim();
    if (text === "") return { error: `Enter ${label}.` };
    if (!/^[0-9]+$/.test(text)) return { error: `${label} must be a positive whole number with digits only.` };
    const number = Number(text);
    if (!Number.isSafeInteger(number) || number <= 0) return { error: `${label} must be a positive whole number.` };
    return { value: number };
}

function PrepareImageWorkflow({ slug }: WorkflowClientProp) {
    const definition = getWorkflow(slug);
    const stageIdList = definition?.stageList ?? [];

    const [source, setSource] = useState<SourceView | null>(null);
    const [selecting, setSelecting] = useState(false);
    const [sourceError, setSourceError] = useState("");
    const [targetFormat, setTargetFormat] = useState<TargetFormat>("jpeg");
    const [maxWidth, setMaxWidth] = useState(DEFAULT_MAX_WIDTH);
    const [maxHeight, setMaxHeight] = useState(DEFAULT_MAX_HEIGHT);
    const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX_BYTES);
    const [fieldError, setFieldError] = useState<FieldErrorView>({});
    const [phase, setPhase] = useState<RunPhase>("idle");
    const [stageView, setStageView] = useState<StageViewMap>({});
    const [latest, setLatest] = useState<WorkflowProgress | null>(null);
    const [result, setResult] = useState<ResultView | null>(null);
    const [failure, setFailure] = useState<WorkflowFailure | null>(null);

    const generation = useRef(0);
    const running = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const resultUrl = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    function releaseResult() {
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
        setResult(null);
    }

    /** Ends any in-flight run so its late completion can never be shown. */
    function abandonRun() {
        generation.current += 1;
        controller.current?.abort();
        controller.current = null;
        running.current = false;
    }

    function clearRunView() {
        releaseResult();
        setFailure(null);
        setLatest(null);
        setStageView({});
        setPhase("idle");
    }

    useEffect(() => () => {
        generation.current += 1;
        controller.current?.abort();
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
    }, []);

    /** Any edit after a run invalidates the previous output; the original file is untouched. */
    function edit(update: () => void) {
        update();
        setFieldError({});
        if (!running.current) clearRunView();
    }

    async function selectFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        abandonRun();
        clearRunView();
        setSource(null);
        setSourceError("");
        setSelecting(false);
        if (!file) return;
        const token = generation.current;
        setSelecting(true);
        const outcome = await inspectWorkflowSource(file);
        if (token !== generation.current) return;
        setSelecting(false);
        if (!outcome.ok) {
            setSourceError(outcome.message);
            return;
        }
        const { format, width, height, sizeBytes } = outcome.source;
        setSource({ file, format, width, height, sizeBytes });
    }

    function reset() {
        abandonRun();
        clearRunView();
        setSource(null);
        setSourceError("");
        setSelecting(false);
        setTargetFormat("jpeg");
        setMaxWidth(DEFAULT_MAX_WIDTH);
        setMaxHeight(DEFAULT_MAX_HEIGHT);
        setMaxBytes(DEFAULT_MAX_BYTES);
        setFieldError({});
        if (fileInput.current) fileInput.current.value = "";
    }

    function cancel() {
        controller.current?.abort();
    }

    async function process(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (running.current || selecting || !source || slug !== "prepare-image-for-upload") return;

        const width = parseWholeNumber(maxWidth, "a maximum width in pixels");
        const height = parseWholeNumber(maxHeight, "a maximum height in pixels");
        const bytes = parseWholeNumber(maxBytes, "a maximum file size in bytes");
        const errors: FieldErrorView = {
            maxWidth: "error" in width ? width.error : undefined,
            maxHeight: "error" in height ? height.error : undefined,
            maxBytes: "error" in bytes ? bytes.error : undefined,
        };
        setFieldError(errors);
        if ("error" in width || "error" in height || "error" in bytes) return;

        releaseResult();
        setFailure(null);
        setStageView({});
        setLatest(null);
        const token = ++generation.current;
        const runController = new AbortController();
        controller.current = runController;
        running.current = true;
        setPhase("running");

        const request: WorkflowRequest = {
            slug,
            source: source.file,
            targetFormat,
            maxWidth: width.value,
            maxHeight: height.value,
            maxBytes: bytes.value,
        };
        const outcome = await runWorkflow(request, {
            signal: runController.signal,
            onProgress: progress => {
                if (token !== generation.current) return;
                setLatest(progress);
                setStageView(previous => ({ ...previous, [progress.stage]: { state: progress.state, description: progress.description } }));
            },
        }).catch((): null => null);
        if (token !== generation.current) return;

        running.current = false;
        controller.current = null;
        if (runController.signal.aborted) {
            /* Cancel wins over a result that raced it: nothing from a cancelled run is shown. */
            setFailure(null);
            setPhase("cancelled");
            return;
        }
        if (outcome && outcome.ok) {
            const [artifact] = outcome.outputs;
            const url = URL.createObjectURL(artifact.blob);
            resultUrl.current = url;
            setResult({ artifact, checkList: outcome.checks, url });
            setPhase("success");
            return;
        }
        const unexpected: WorkflowFailure = { code: "PROCESSING_FAILED", stage: "validate", message: "The browser could not process this image. Reset the form and try again." };
        const reported = outcome && !outcome.ok ? outcome.failure : unexpected;
        setFailure(reported);
        setPhase(reported.code === "CANCELLED" ? "cancelled" : "failure");
    }

    if (!definition) return null;

    const busy = phase === "running";
    const stepperItem: StageStepperItem[] = stageIdList.map(id => {
        const view = stageView[id];
        return { id, label: STAGE_LABEL[id], state: view?.state ?? "pending", description: view?.description ?? PENDING_DESCRIPTION };
    });
    const targetLabel = FORMAT_LABEL[targetFormat];
    const statusText = busy
        ? (latest ? `${STAGE_LABEL[latest.stage]}: ${latest.description} (${latest.completed} of ${latest.total} stages finished)` : "Starting.")
        : phase === "success" && result ? `Done. The prepared image passed ${result.checkList.length} checks.`
            : phase === "cancelled" ? "Cancelled. No file was produced."
                : phase === "failure" ? "The run stopped without producing a file."
                    : "Nothing has run yet. Choose an image, set your requirements and select Process image.";

    return (
        <div className="min-w-0 space-y-4" data-workflow={slug}>
            <p className="text-sm text-text-muted">Everything happens in your browser. Your image is not uploaded and is not stored.</p>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:items-start">
                <form onSubmit={process} noValidate className={toolSurfaceClassName("work", "space-y-4")} aria-labelledby="workflow-form-title">
                    <h2 id="workflow-form-title" className="tool-heading">Your image and requirements</h2>
                    <div className="space-y-2">
                        <label htmlFor="workflow-source" className="block font-medium">Source image (JPEG, PNG or WebP)</label>
                        <input id="workflow-source" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} disabled={busy} className={CONTROL_CLASS} />
                        {selecting && <p className="text-sm text-text-muted">Reading image...</p>}
                        {source && (
                            <p data-workflow-source className="break-words text-sm text-text-muted">
                                {source.file.name}: {FORMAT_LABEL[source.format]}, {source.width} x {source.height} px, {formatCount(source.sizeBytes)} bytes
                            </p>
                        )}
                        {sourceError && <p role="alert" data-tone="error" className="tool-feedback text-sm">{sourceError}</p>}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="workflow-format" className="block font-medium">Output format</label>
                        <select id="workflow-format" value={targetFormat} disabled={busy} className={CONTROL_CLASS}
                            onChange={event => edit(() => setTargetFormat(event.target.value as TargetFormat))}>
                            <option value="jpeg">JPEG</option>
                            <option value="png">PNG</option>
                            <option value="webp">WebP</option>
                        </select>
                        <p className="text-sm text-text-muted">
                            The output stays {targetLabel}. If the limits cannot be met in {targetLabel}, the run fails instead of switching format.
                            {targetFormat === "png" ? " PNG is lossless, so only smaller dimensions can reduce its size." : ""}
                        </p>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <label className="space-y-2" htmlFor="workflow-max-width"><span className="block font-medium">Maximum width (pixels)</span>
                            <input id="workflow-max-width" type="text" inputMode="numeric" value={maxWidth} disabled={busy} className={CONTROL_CLASS}
                                aria-invalid={fieldError.maxWidth ? true : undefined} aria-describedby={fieldError.maxWidth ? "workflow-max-width-error" : undefined}
                                onChange={event => edit(() => setMaxWidth(event.target.value))} />
                            {fieldError.maxWidth && <span id="workflow-max-width-error" className="block text-sm text-danger">{fieldError.maxWidth}</span>}
                        </label>
                        <label className="space-y-2" htmlFor="workflow-max-height"><span className="block font-medium">Maximum height (pixels)</span>
                            <input id="workflow-max-height" type="text" inputMode="numeric" value={maxHeight} disabled={busy} className={CONTROL_CLASS}
                                aria-invalid={fieldError.maxHeight ? true : undefined} aria-describedby={fieldError.maxHeight ? "workflow-max-height-error" : undefined}
                                onChange={event => edit(() => setMaxHeight(event.target.value))} />
                            {fieldError.maxHeight && <span id="workflow-max-height-error" className="block text-sm text-danger">{fieldError.maxHeight}</span>}
                        </label>
                    </div>
                    <label className="block space-y-2" htmlFor="workflow-max-bytes"><span className="block font-medium">Maximum file size (bytes)</span>
                        <input id="workflow-max-bytes" type="text" inputMode="numeric" value={maxBytes} disabled={busy} className={CONTROL_CLASS}
                            aria-invalid={fieldError.maxBytes ? true : undefined} aria-describedby={fieldError.maxBytes ? "workflow-max-bytes-error" : "workflow-max-bytes-hint"}
                            onChange={event => edit(() => setMaxBytes(event.target.value))} />
                        <span id="workflow-max-bytes-hint" className="block text-sm text-text-muted">Whole bytes, not KB or MB. The limit you type is exact.</span>
                        {fieldError.maxBytes && <span id="workflow-max-bytes-error" className="block text-sm text-danger">{fieldError.maxBytes}</span>}
                    </label>
                    <p className="text-sm text-text-muted">The starting values (800 x 600 pixels, 100000 bytes) are examples, not a rule that every site accepts. Use the limits your destination states.</p>
                    <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={!source || selecting || busy} className="tool-action-primary">{busy ? "Processing..." : "Process image"}</button>
                        {busy && <button type="button" onClick={cancel} className="tool-action-secondary">Cancel</button>}
                        <button type="button" onClick={reset} disabled={busy} className="tool-action-secondary">Reset</button>
                    </div>
                </form>

                <div className="min-w-0 space-y-4">
                    <ToolSurface kind="work" title="Progress">
                        <p role="status" data-workflow-status className="text-sm text-text">{statusText}</p>
                        <StageStepper stageList={stepperItem} label="Prepare image stages" />
                    </ToolSurface>

                    {failure && phase === "failure" && (
                        <div role="alert" data-tone="error" data-workflow-failure={failure.code} className="tool-feedback space-y-2">
                            <p><strong>{failure.message}</strong></p>
                            <p className="text-sm">Stopped at: {STAGE_LABEL[failure.stage]}. Reason: {failure.code}.</p>
                            {failure.unmetChecks && failure.unmetChecks.length > 0 && (
                                <ul className="list-disc space-y-1 pl-5 text-sm">
                                    {failure.unmetChecks.map(check => (
                                        <li key={check.name}>Failed: {check.name}. Expected {check.expected}, observed {check.observed}.</li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-sm">No file is offered for download.</p>
                        </div>
                    )}

                    {phase === "cancelled" && (
                        <div role="status" data-tone="warning" data-workflow-cancelled className="tool-feedback text-sm">Cancelled. No file was produced. You can adjust the settings and process again.</div>
                    )}

                    {result && source && phase === "success" && (
                        <ToolSurface kind="result" tone="success" title="Prepared image ready" aria-live="polite">
                            <table data-workflow-comparison className="w-full min-w-0 text-left text-sm">
                                <caption className="sr-only">Source and prepared image</caption>
                                <thead><tr><th scope="col">Image</th><th scope="col">Format</th><th scope="col">Dimensions</th><th scope="col">Size</th></tr></thead>
                                <tbody>
                                    <tr><th scope="row">Source</th><td>{FORMAT_LABEL[source.format]}</td><td>{source.width} x {source.height} px</td><td>{formatCount(source.sizeBytes)} bytes</td></tr>
                                    <tr data-workflow-prepared><th scope="row">Prepared</th><td>{MIME_FORMAT_LABEL[result.artifact.mimeType] ?? result.artifact.mimeType}</td><td>{result.artifact.width} x {result.artifact.height} px</td><td>{formatCount(result.artifact.sizeBytes)} bytes</td></tr>
                                </tbody>
                            </table>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={result.url} alt="Prepared image preview" className="block max-h-[min(40vh,360px)] max-w-full object-contain" />
                            <ul data-workflow-check-list className="space-y-1 text-sm">
                                {result.checkList.map(check => (
                                    <li key={check.name}>{check.passed ? "Passed" : "Failed"}: {check.name}. Expected {check.expected}, observed {check.observed}.</li>
                                ))}
                            </ul>
                            <a href={result.url} download={result.artifact.name} data-workflow-download className="tool-action-primary">Download prepared image</a>
                        </ToolSurface>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------- Multi-file workflows: HEIC photos to PDF, PDF packet, PDF pages for slides ---------- */

type FileSetSlug = Exclude<WorkflowSlug, "prepare-image-for-upload">;

interface FileSetCopy {
    formTitle: string;
    stepperLabel: string;
    processLabel: string;
    resultTitle: string;
    downloadLabel: string;
    idleStatus: string;
    unexpected: string;
}

const FILE_SET_COPY: Record<FileSetSlug, FileSetCopy> = {
    "heic-photos-to-pdf": {
        formTitle: "Your photos and settings",
        stepperLabel: "HEIC photos to PDF stages",
        processLabel: "Create PDF",
        resultTitle: "PDF ready",
        downloadLabel: "Download PDF",
        idleStatus: "Nothing has run yet. Add your photos, set the order and select Create PDF.",
        unexpected: "The browser could not process these photos. Reset the form and try again.",
    },
    "assemble-pdf-packet": {
        formTitle: "Your files and page order",
        stepperLabel: "PDF packet stages",
        processLabel: "Assemble packet",
        resultTitle: "Packet ready",
        downloadLabel: "Download packet",
        idleStatus: "Nothing has run yet. Add your files, list the pages in order and select Assemble packet.",
        unexpected: "The browser could not assemble these files. Reset the form and try again.",
    },
    "pdf-pages-for-slides": {
        formTitle: "Your PDF and slide settings",
        stepperLabel: "PDF pages for slides stages",
        processLabel: "Export slide images",
        resultTitle: "Slide images ready",
        downloadLabel: "Download",
        idleStatus: "Nothing has run yet. Choose a PDF, list the pages and select Export slide images.",
        unexpected: "The browser could not export these pages. Reset the form and try again.",
    },
};

interface OutputView {
    artifact: WorkflowArtifact;
    url: string;
}

interface OutputSetView {
    outputList: readonly OutputView[];
    checkList: readonly WorkflowCheck[];
}

function observedPageCount(checkList: readonly WorkflowCheck[]): string {
    const check = checkList.find(entry => entry.name === "Page count");
    if (!check) return "";
    return `${check.observed} ${check.observed === 1 ? "page" : "pages"}`;
}

function FileSetWorkflow({ slug }: { slug: FileSetSlug }) {
    const definition = getWorkflow(slug);
    const stageIdList = definition?.stageList ?? [];
    const copy = FILE_SET_COPY[slug];

    const [draft, setDraft] = useState<WorkflowDraft>({ request: null, hint: "" });
    const [formKey, setFormKey] = useState(0);
    const [phase, setPhase] = useState<RunPhase>("idle");
    const [stageView, setStageView] = useState<StageViewMap>({});
    const [latest, setLatest] = useState<WorkflowProgress | null>(null);
    const [result, setResult] = useState<OutputSetView | null>(null);
    const [failure, setFailure] = useState<WorkflowFailure | null>(null);

    const generation = useRef(0);
    const running = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const urlList = useRef<string[]>([]);

    const handleDraft = useCallback((next: WorkflowDraft) => setDraft(next), []);

    function releaseResult() {
        for (const url of urlList.current) URL.revokeObjectURL(url);
        urlList.current = [];
        setResult(null);
    }

    function abandonRun() {
        generation.current += 1;
        controller.current?.abort();
        controller.current = null;
        running.current = false;
    }

    function clearRunView() {
        releaseResult();
        setFailure(null);
        setLatest(null);
        setStageView({});
        setPhase("idle");
    }

    useEffect(() => () => {
        generation.current += 1;
        controller.current?.abort();
        for (const url of urlList.current) URL.revokeObjectURL(url);
        urlList.current = [];
    }, []);

    /** Any edit after a run invalidates the previous outputs; the original files are untouched. */
    function edit() {
        if (!running.current) clearRunView();
    }

    function reset() {
        abandonRun();
        clearRunView();
        setDraft({ request: null, hint: "" });
        setFormKey(key => key + 1);
    }

    function cancel() {
        controller.current?.abort();
    }

    async function process(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const request = draft.request;
        if (running.current || !request || request.slug !== slug) return;

        releaseResult();
        setFailure(null);
        setStageView({});
        setLatest(null);
        const token = ++generation.current;
        const runController = new AbortController();
        controller.current = runController;
        running.current = true;
        setPhase("running");

        const outcome = await runWorkflow(request, {
            signal: runController.signal,
            onProgress: progress => {
                if (token !== generation.current) return;
                setLatest(progress);
                setStageView(previous => ({ ...previous, [progress.stage]: { state: progress.state, description: progress.description } }));
            },
        }).catch((): null => null);
        if (token !== generation.current) return;

        running.current = false;
        controller.current = null;
        if (runController.signal.aborted) {
            /* Cancel wins over a result that raced it: nothing from a cancelled run is shown. */
            setFailure(null);
            setPhase("cancelled");
            return;
        }
        if (outcome && outcome.ok) {
            const outputList = outcome.outputs.map(artifact => ({ artifact, url: URL.createObjectURL(artifact.blob) }));
            urlList.current = outputList.map(output => output.url);
            setResult({ outputList, checkList: outcome.checks });
            setPhase("success");
            return;
        }
        const unexpected: WorkflowFailure = { code: "PROCESSING_FAILED", stage: "validate", message: copy.unexpected };
        const reported = outcome && !outcome.ok ? outcome.failure : unexpected;
        setFailure(reported);
        setPhase(reported.code === "CANCELLED" ? "cancelled" : "failure");
    }

    if (!definition) return null;

    const busy = phase === "running";
    const stepperItem: StageStepperItem[] = stageIdList.map(id => {
        const view = stageView[id];
        return { id, label: STAGE_LABEL[id], state: view?.state ?? "pending", description: view?.description ?? PENDING_DESCRIPTION };
    });
    const statusText = busy
        ? (latest ? `${STAGE_LABEL[latest.stage]}: ${latest.description} (${latest.completed} of ${latest.total} stages finished)` : "Starting.")
        : phase === "success" && result ? `Done. ${result.outputList.length === 1 ? "The file passed" : `All ${result.outputList.length} files passed`} ${result.checkList.length} ${result.checkList.length === 1 ? "check" : "checks"}.`
            : phase === "cancelled" ? "Cancelled. No file was produced."
                : phase === "failure" ? "The run stopped without producing a file."
                    : copy.idleStatus;
    const ready = draft.request !== null && draft.request.slug === slug;

    return (
        <div className="min-w-0 space-y-4" data-workflow={slug}>
            <p className="text-sm text-text-muted">Everything happens in your browser. Your files are not uploaded and are not stored.</p>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:items-start">
                <form onSubmit={process} noValidate className={toolSurfaceClassName("work", "space-y-4")} aria-labelledby="workflow-form-title">
                    <h2 id="workflow-form-title" className="tool-heading">{copy.formTitle}</h2>
                    {slug === "heic-photos-to-pdf" && <HeicPhotosToPdfForm key={formKey} disabled={busy} onEdit={edit} onDraft={handleDraft} />}
                    {slug === "assemble-pdf-packet" && <PdfPacketForm key={formKey} disabled={busy} onEdit={edit} onDraft={handleDraft} />}
                    {slug === "pdf-pages-for-slides" && <PdfPagesForSlidesForm key={formKey} disabled={busy} onEdit={edit} onDraft={handleDraft} />}
                    {!ready && draft.hint && <p id="workflow-process-hint" data-workflow-hint className="text-sm text-text-muted">{draft.hint}</p>}
                    <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={!ready || busy} aria-describedby={!ready && draft.hint ? "workflow-process-hint" : undefined} className="tool-action-primary">
                            {busy ? "Processing..." : copy.processLabel}
                        </button>
                        {busy && <button type="button" onClick={cancel} className="tool-action-secondary">Cancel</button>}
                        <button type="button" onClick={reset} disabled={busy} className="tool-action-secondary">Reset</button>
                    </div>
                </form>

                <div className="min-w-0 space-y-4">
                    <ToolSurface kind="work" title="Progress">
                        <p role="status" data-workflow-status className="text-sm text-text">{statusText}</p>
                        <StageStepper stageList={stepperItem} label={copy.stepperLabel} />
                    </ToolSurface>

                    {failure && phase === "failure" && (
                        <div role="alert" data-tone="error" data-workflow-failure={failure.code} className="tool-feedback space-y-2">
                            <p><strong>{failure.message}</strong></p>
                            <p className="text-sm">Stopped at: {STAGE_LABEL[failure.stage]}. Reason: {failure.code}.</p>
                            {failure.unmetChecks && failure.unmetChecks.length > 0 && (
                                <ul className="list-disc space-y-1 pl-5 text-sm">
                                    {failure.unmetChecks.map(check => (
                                        <li key={check.name}>Failed: {check.name}. Expected {check.expected}, observed {check.observed}.</li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-sm">No file is offered for download.</p>
                        </div>
                    )}

                    {phase === "cancelled" && (
                        <div role="status" data-tone="warning" data-workflow-cancelled className="tool-feedback text-sm">Cancelled. No file was produced. You can adjust the settings and process again.</div>
                    )}

                    {result && phase === "success" && (
                        <ToolSurface kind="result" tone="success" title={copy.resultTitle} aria-live="polite">
                            {slug === "pdf-pages-for-slides" ? (
                                <ol data-workflow-output-list aria-label="Slide images in output order" className="grid min-w-0 gap-3 sm:grid-cols-2">
                                    {result.outputList.map((output, index) => (
                                        <li key={output.artifact.name} data-workflow-output className="min-w-0 space-y-2 rounded border border-[var(--card-border)] p-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={output.url} alt={`Slide ${index + 1}: PDF page ${output.artifact.sourcePageNumber}`} className="block max-h-48 max-w-full object-contain" />
                                            <p className="break-words text-sm">
                                                Slide {index + 1}: page {output.artifact.sourcePageNumber}, {output.artifact.width} x {output.artifact.height} px, {formatCount(output.artifact.sizeBytes)} bytes
                                            </p>
                                            <a href={output.url} download={output.artifact.name} data-workflow-download className="tool-action-primary">
                                                {copy.downloadLabel} {output.artifact.name}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                result.outputList.map(output => (
                                    <div key={output.artifact.name} data-workflow-output className="min-w-0 space-y-2">
                                        <p className="break-words text-sm">
                                            {output.artifact.name}: {observedPageCount(result.checkList)}, {formatCount(output.artifact.sizeBytes)} bytes
                                        </p>
                                        <a href={output.url} download={output.artifact.name} data-workflow-download className="tool-action-primary">{copy.downloadLabel}</a>
                                    </div>
                                ))
                            )}
                            <ul data-workflow-check-list className="space-y-1 text-sm">
                                {result.checkList.map(check => (
                                    <li key={check.name}>{check.passed ? "Passed" : "Failed"}: {check.name}. Expected {check.expected}, observed {check.observed}.</li>
                                ))}
                            </ul>
                        </ToolSurface>
                    )}
                </div>
            </div>
        </div>
    );
}

export function WorkflowClient({ slug }: WorkflowClientProp) {
    if (slug === "prepare-image-for-upload") return <PrepareImageWorkflow slug={slug} />;
    return <FileSetWorkflow slug={slug} />;
}
