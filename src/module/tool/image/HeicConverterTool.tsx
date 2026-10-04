"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ToolComponentProp } from "../type";
import { trackEvent } from "@/module/observability";
import { formatImageFileBytes, validateImageFileSize } from "./imageFile";
import { HEIC_DEFAULT_OUTPUT, HEIC_DEFAULT_QUALITY, HEIC_OUTPUT, heicFilename, type HeicConverterTarget } from "./heicConverter";
import { startHeicOperation, type HeicOperation } from "./heicConverter.client";
import { HeicProcessingError } from "./heicConverter.workerType";

type HeicConverterState = "idle" | "selected" | "processing" | "success" | "validation failure" | "processing failure";
interface HeicSource { file: File; width: number; height: number; url: string }
interface HeicOutcome { bytes: number; target: HeicConverterTarget; url: string; filename: string; width: number; height: number }
const SURFACE_CLASS = "material-raised min-w-0 space-y-4 rounded-xl border border-panel-border bg-panel-bg p-4";

export function HeicConverterTool({ toolId }: ToolComponentProp) {
    const [state, setState] = useState<HeicConverterState>("idle");
    const [source, setSource] = useState<HeicSource | null>(null);
    const [outcome, setOutcome] = useState<HeicOutcome | null>(null);
    const [output, setOutput] = useState<HeicConverterTarget>(HEIC_DEFAULT_OUTPUT);
    const [quality, setQuality] = useState(HEIC_DEFAULT_QUALITY);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState("");
    const generation = useRef(0);
    const active = useRef<HeicOperation | null>(null);
    const sourceUrl = useRef<string | null>(null);
    const resultUrl = useRef<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => () => {
        generation.current += 1;
        active.current?.cancel();
        active.current = null;
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        sourceUrl.current = null;
        resultUrl.current = null;
    }, []);

    function invalidate() {
        generation.current += 1;
        active.current?.cancel();
        active.current = null;
    }

    function clearOutcome() {
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = null;
        setOutcome(null);
    }

    function clearSelection() {
        invalidate();
        clearOutcome();
        if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
        sourceUrl.current = null;
        setSource(null);
        setOutput(HEIC_DEFAULT_OUTPUT);
        setQuality(HEIC_DEFAULT_QUALITY);
        setReading(false);
        setError("");
        setState("idle");
    }

    function reset() {
        clearSelection();
        if (fileInput.current) fileInput.current.value = "";
    }

    async function selectFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        clearSelection();
        if (!file) return;
        const sizeError = validateImageFileSize(file.size);
        if (sizeError) { setError(sizeError); setState("validation failure"); return; }
        const token = generation.current;
        setReading(true);
        setState("processing");
        try {
            const operation = startHeicOperation({ id: token, operation: "inspect", file });
            active.current = operation;
            const response = await operation.promise;
            if (token !== generation.current) return;
            if (response.status !== "inspected") throw new HeicProcessingError("worker-response-invalid");
            const url = URL.createObjectURL(response.previewBlob);
            sourceUrl.current = url;
            setSource({ file, width: response.sourceWidth, height: response.sourceHeight, url });
            setState("selected");
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof HeicProcessingError ? failure.message : "An unexpected browser error occurred while reading this HEIC image. Reset the tool and try again.");
            setState("validation failure");
        } finally {
            if (token === generation.current) { active.current = null; setReading(false); }
        }
    }

    function clearConfiguredResult() {
        invalidate();
        clearOutcome();
        setError("");
        setState(source ? "selected" : "idle");
    }

    async function convert(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!source || reading || active.current) return;
        clearOutcome();
        setError("");
        const token = ++generation.current;
        setState("processing");
        try {
            const operation = startHeicOperation({ id: token, operation: "convert", file: source.file, target: output,
                ...(output === "jpeg" ? { quality } : {}) });
            active.current = operation;
            const response = await operation.promise;
            if (token !== generation.current) return;
            if (response.status !== "converted" || response.sourceWidth !== source.width || response.sourceHeight !== source.height) {
                throw new HeicProcessingError("worker-response-invalid");
            }
            const url = URL.createObjectURL(response.blob);
            resultUrl.current = url;
            setOutcome({ bytes: response.blob.size, target: output, url, filename: heicFilename(source.file.name, output), width: response.sourceWidth, height: response.sourceHeight });
            setState("success");
            trackEvent("tool_executed", { toolId, slug: "heic-converter" });
        } catch (failure) {
            if (token !== generation.current) return;
            setError(failure instanceof HeicProcessingError ? failure.message : "An unexpected browser error occurred while converting this HEIC image. Reset the tool and try again.");
            setState("processing failure");
        } finally { if (token === generation.current) active.current = null; }
    }

    const busy = state === "processing";
    return <div className="min-w-0 space-y-4">
        <p className="text-sm text-accent-secondary">Processed locally in your browser. Your image is not uploaded.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start">
        <div className="contents order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <div className="order-1 min-w-0 lg:order-none">
        <section className="min-w-0 space-y-4 rounded-xl border border-card-border bg-card-bg p-4" aria-labelledby="heic-source-title">
            <h2 id="heic-source-title" className="font-semibold text-category-image">Source HEIC image</h2>
            <label className="block space-y-2"><span className="block font-medium">Choose HEIC image</span>
                <input ref={fileInput} type="file" accept=".heic,.heif,image/heic,image/heif" onChange={selectFile}
                    className="block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-[var(--contrast)]" />
            </label>
            <p className="text-sm text-text-muted">Accepts supported HEIC and HEIF images. Maximum 25 MiB and 30 megapixels.</p>
            {reading && <p role="status" className="text-sm">Reading HEIC…</p>}
            {source && <div className="space-y-3">
                <p className="break-all text-sm">{source.file.name}</p>
                <p className="text-sm">Source: {source.width} × {source.height} px · {formatImageFileBytes(source.file.size)} ({source.file.size} bytes) · HEIC / HEIF</p>
            </div>}
        </section>
        </div>
        <form onSubmit={convert} className={`order-3 ${SURFACE_CLASS} lg:order-none`} aria-labelledby="heic-controls-title" noValidate>
            <h2 id="heic-controls-title" className="font-semibold text-category-image">Conversion settings</h2>
            <div className="space-y-2"><label htmlFor="heic-output-format" className="block font-medium">Output format</label>
                <select id="heic-output-format" value={output} disabled={!source || busy} onChange={event => { clearConfiguredResult(); setOutput(event.target.value as HeicConverterTarget); }}
                    className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text">
                    {HEIC_OUTPUT.map(target => <option key={target} value={target}>{target === "jpeg" ? "JPEG" : "PNG"}</option>)}
                </select>
            </div>
            {output === "jpeg" && <>
                <label className="block space-y-2"><span className="block font-medium">Quality</span>
                    <input type="range" min="10" max="100" step="5" value={quality} disabled={!source || busy}
                        onChange={event => { clearConfiguredResult(); setQuality(Number(event.target.value)); }} className="block w-full accent-accent" />
                </label>
                <p className="text-sm">Current quality: {quality}</p>
                <p className="text-sm text-text-muted">Lower quality may reduce visual fidelity. Transparent pixels are placed on a white background for JPEG.</p>
            </>}
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!source || busy} className="material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50">{busy && !reading ? "Converting…" : "Convert image"}</button>
                <button type="button" onClick={reset} className="material-secondary min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2">Reset</button>
            </div>
            <p className="text-sm text-text-muted">The output keeps the original dimensions. Metadata preservation is not guaranteed.</p>
        </form>
        </div>
        <div className="contents order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:flex lg:flex-col lg:gap-4">
        <section aria-label="Image preview and result" data-surface={outcome?.url ? "result-stage" : "preview-stage"} className={`material-glass order-2 flex min-h-[300px] min-w-0 items-center justify-center overflow-hidden rounded-xl border ${outcome?.url ? "border-result-border bg-result-bg" : "border-preview-border bg-preview-bg"} p-3 sm:min-h-[380px] lg:min-h-[440px] lg:order-none lg:p-6`}>
            {outcome?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outcome.url} alt="Converted image preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : source ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.url} alt="Selected HEIC source preview" className="block max-h-[min(50vh,480px)] w-full object-contain" />
            ) : <p className="max-w-xs text-center text-sm text-text-muted">Choose an image to see its preview here. Your image stays in this browser.</p>}
        </section>

        {error && <div role="alert" className="order-5 rounded-xl border border-danger bg-danger-soft p-4 text-danger lg:order-none">{error}</div>}
        {outcome && source && <section className="material-raised order-4 min-w-0 space-y-4 rounded-xl border border-result-border bg-result-bg p-4 lg:order-none" aria-labelledby="heic-result-title" aria-live="polite">
            <h2 id="heic-result-title" className="font-semibold text-category-image">Converted image ready</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-text-muted">Source format</dt><dd>HEIC / HEIF</dd></div>
                <div><dt className="text-text-muted">Output format</dt><dd>{outcome.target === "jpeg" ? "JPEG" : "PNG"}</dd></div>
                <div><dt className="text-text-muted">Source dimensions</dt><dd>{source.width} × {source.height} px</dd></div>
                <div><dt className="text-text-muted">Output dimensions</dt><dd>{outcome.width} × {outcome.height} px</dd></div>
                <div><dt className="text-text-muted">Source size</dt><dd>{formatImageFileBytes(source.file.size)} ({source.file.size} bytes)</dd></div>
                <div><dt className="text-text-muted">Output size</dt><dd>{formatImageFileBytes(outcome.bytes)} ({outcome.bytes} bytes)</dd></div>
            </dl>
            <a href={outcome.url} download={outcome.filename} className="material-primary inline-block min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)]">Download converted image</a>
        </section>}
        </div>
        </div>
    </div>;
}
